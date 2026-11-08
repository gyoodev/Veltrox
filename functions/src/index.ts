/**
 * Veltrox — Firebase Cloud Functions (Gen 2, europe-west1)
 *
 * Configured Functions:
 * 1. `dailyVeltroxReminderSweep` (Scheduled: every day 07:00 Europe/Sofia)
 *    - Evaluates scheduled reminders due within <= 7 days or <= 500 km of linked vehicle mileage.
 *    - Evaluates vehicle vault documents expiring within <= 14 days (idempotent per expiry cycle).
 *    - Enforces garage monthly reminder quotas (Free: 50/mo, Pro: 500/mo).
 *    - Dispatches Email via Resend HTTP (with graceful simulation fallback) + writes in-app
 *      `notifications` and immutable `REMINDER_ENGINE_RUN` audit logs.
 *
 * 2. `onWorkOrderStatusChanged` (Firestore Trigger: `workOrders/{workOrderId}`)
 *    - Cleans up `workOrderPublicStatus/{token}` automatically when a work order is deleted.
 *    - Notifies the linked car owner (`in_app` + optional `email`) when status becomes
 *      `ready` or `completed`.
 *
 * 3. `onOnlineAppointmentRequested` (Firestore Trigger: `appointments/{appointmentId}`)
 *    - Alerts the target workshop (`in_app` + optional `email`) when a car owner submits
 *      a new online appointment request (`status == "requested"`).
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

if (getApps().length === 0) {
  initializeApp();
}

setGlobalOptions({
  region: "europe-west1",
  maxInstances: 10,
});

const MS_PER_DAY = 86_400_000;

function parseUtcMidnight(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const slice = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slice)) return null;
  const ms = Date.parse(`${slice}T00:00:00.000Z`);
  return Number.isNaN(ms) ? null : ms;
}

async function sendEmailIfConfigured(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; simulated: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.NOTIFICATION_FROM_EMAIL?.trim() ||
    "Veltrox <notifications@veltrox.app>";
  if (!apiKey) {
    return { ok: true, simulated: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });
    return { ok: res.ok, simulated: false };
  } catch (err: unknown) {
    logger.error("Email dispatch failed", err);
    return { ok: false, simulated: false };
  }
}

export const dailyVeltroxReminderSweep = onSchedule(
  {
    schedule: "every day 07:00",
    timeZone: "Europe/Sofia",
    memory: "256MiB",
  },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const nowIso = now.toISOString();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const todayUtcMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    const [remindersSnap, vehiclesSnap, usersSnap, garagesSnap, docsSnap, inAppSnap] =
      await Promise.all([
        db.collection("reminders").where("status", "==", "scheduled").get(),
        db.collection("vehicles").get(),
        db.collection("users").get(),
        db.collection("garages").get(),
        db.collection("documents").get(),
        db.collection("notifications").where("channel", "==", "in_app").get(),
      ]);

    const vehicles = new Map(
      vehiclesSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>])
    );
    const users = new Map(
      usersSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>])
    );
    const garages = new Map(
      garagesSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>])
    );
    const deliveredKeys = new Set<string>();
    for (const d of inAppSnap.docs) {
      const k = d.data().deliveryKey;
      if (typeof k === "string") deliveredKeys.add(k);
    }

    let dispatchedReminders = 0;
    let quotaSkippedReminders = 0;

    for (const remDoc of remindersSnap.docs) {
      const rem = remDoc.data();
      const dueDateMs = parseUtcMidnight(rem.dueDate as string | null);
      const daysUntil =
        dueDateMs !== null
          ? Math.round((dueDateMs - todayUtcMs) / MS_PER_DAY)
          : null;

      const veh =
        typeof rem.vehicleId === "string" ? vehicles.get(rem.vehicleId) : undefined;
      const currentKm =
        typeof veh?.currentMileageKm === "number" ? veh.currentMileageKm : null;
      const dueKm =
        typeof rem.dueMileageKm === "number" ? rem.dueMileageKm : null;
      const kmLeft =
        dueKm !== null && currentKm !== null ? dueKm - currentKm : null;

      const complianceTypes = new Set([
        "liability_insurance",
        "vignette",
        "technical_inspection",
        "casco",
        "fire_extinguisher",
        "vehicle_tax",
      ]);
      const leadDays = complianceTypes.has(String(rem.type ?? "")) ? 14 : 7;

      const isDue =
        (daysUntil !== null && daysUntil <= leadDays) ||
        (kmLeft !== null && kmLeft <= 500);
      if (!isDue) continue;

      const ownerId = typeof rem.ownerId === "string" ? rem.ownerId : null;
      const garageId = typeof rem.garageId === "string" ? rem.garageId : null;
      const owner = ownerId ? users.get(ownerId) : undefined;
      if (owner?.suspended === true) continue;

      if (garageId) {
        const g = garages.get(garageId);
        if (!g || g.status !== "approved") continue;
        const quota =
          typeof g.monthlyReminderQuota === "number" ? g.monthlyReminderQuota : 50;
        const used =
          g.quotaResetMonth === monthKey &&
          typeof g.monthlyRemindersUsed === "number"
            ? g.monthlyRemindersUsed
            : 0;
        if (used >= quota) {
          quotaSkippedReminders += 1;
          await remDoc.ref.update({
            lastError: "MONTHLY_QUOTA_EXCEEDED",
            updatedAt: nowIso,
          });
          continue;
        }
        g.monthlyRemindersUsed = used + 1;
        g.quotaResetMonth = monthKey;
        await db.collection("garages").doc(garageId).update({
          monthlyRemindersUsed: used + 1,
          quotaResetMonth: monthKey,
          updatedAt: nowIso,
        });
      }

      const isBg = (owner?.language ?? "bg") === "bg";
      const plateSuffix = rem.plateNumber ? ` (${String(rem.plateNumber)})` : "";
      const subject = isBg
        ? `Напомняне${plateSuffix}: ${String(rem.title ?? "Сервизно обслужване")}`
        : `Service Reminder${plateSuffix}: ${String(rem.title ?? "Scheduled Service")}`;
      const body = isBg
        ? `Предстоящо обслужване${plateSuffix}: ${String(rem.title ?? "")}.`
        : `Upcoming vehicle milestone${plateSuffix}: ${String(rem.title ?? "")}.`;

      await db.collection("notifications").add({
        ownerId,
        garageId,
        reminderId: remDoc.id,
        documentId: null,
        actionUrl: ownerId ? "/app/reminders" : "/garage/work-orders",
        channel: "in_app",
        subject,
        body,
        status: "sent",
        deliveryKey: `reminder:${remDoc.id}`,
        provider: "cloud-functions-v2",
        simulated: false,
        readAt: null,
        createdAt: nowIso,
      });

      const prefs = (owner?.notificationPreferences ?? {}) as Record<string, unknown>;
      const allowEmail = prefs.emailReminders !== false;
      const toEmail =
        (typeof rem.recipientEmail === "string" && rem.recipientEmail) ||
        (typeof owner?.email === "string" ? owner.email : null);

      if (toEmail && allowEmail) {
        const emailRes = await sendEmailIfConfigured({
          to: toEmail,
          subject,
          text: body,
        });
        await db.collection("notifications").add({
          ownerId,
          garageId,
          reminderId: remDoc.id,
          documentId: null,
          actionUrl: ownerId ? "/app/reminders" : "/garage/work-orders",
          channel: "email",
          subject,
          body,
          status: emailRes.ok ? "sent" : "failed",
          deliveryKey: `reminder:${remDoc.id}`,
          provider: emailRes.simulated ? "resend-http:simulated" : "resend-http",
          simulated: emailRes.simulated,
          readAt: null,
          createdAt: nowIso,
        });
      }

      await remDoc.ref.update({
        status: "sent",
        sentAt: nowIso,
        lastError: null,
        updatedAt: nowIso,
      });
      dispatchedReminders += 1;
    }

    let dispatchedDocumentAlerts = 0;
    for (const vDoc of docsSnap.docs) {
      const data = vDoc.data();
      const expStr = typeof data.expiryDate === "string" ? data.expiryDate : null;
      const expMs = parseUtcMidnight(expStr);
      if (expMs === null || !expStr) continue;
      const daysLeft = Math.round((expMs - todayUtcMs) / MS_PER_DAY);
      if (daysLeft > 14 || daysLeft < -3) continue;

      const deliveryKey = `doc-expiry:${vDoc.id}:${expStr.slice(0, 10)}`;
      if (deliveredKeys.has(deliveryKey)) continue;

      const ownerId = typeof data.ownerId === "string" ? data.ownerId : null;
      if (!ownerId) continue;
      const owner = users.get(ownerId);
      if (!owner || owner.suspended === true) continue;

      const prefs = (owner.notificationPreferences ?? {}) as Record<string, unknown>;
      const isBg = (owner.language ?? "bg") === "bg";
      const subject = isBg
        ? `Изтичащ документ: ${String(data.title ?? "Документ")}`
        : `Expiring Document: ${String(data.title ?? "Document")}`;
      const body = isBg
        ? `${String(data.title ?? "Документ")} изтича на ${expStr.slice(0, 10)}.`
        : `${String(data.title ?? "Document")} expires on ${expStr.slice(0, 10)}.`;

      await db.collection("notifications").add({
        ownerId,
        garageId: null,
        reminderId: null,
        documentId: vDoc.id,
        actionUrl: "/app/documents",
        channel: "in_app",
        subject,
        body,
        status: "sent",
        deliveryKey,
        provider: "cloud-functions-v2",
        simulated: false,
        readAt: null,
        createdAt: nowIso,
      });

      if (prefs.documentExpiryAlerts !== false && typeof owner.email === "string") {
        await sendEmailIfConfigured({
          to: owner.email,
          subject,
          text: body,
        });
      }

      deliveredKeys.add(deliveryKey);
      dispatchedDocumentAlerts += 1;
    }

    await db.collection("auditLogs").add({
      action: "REMINDER_ENGINE_RUN",
      actorUid: "cloud-functions-v2",
      actorRole: "SYSTEM",
      targetUid: null,
      targetGarageId: null,
      metadata: {
        evaluatedReminders: remindersSnap.size,
        dispatchedReminders,
        quotaSkippedReminders,
        evaluatedDocuments: docsSnap.size,
        dispatchedDocumentAlerts,
      },
      createdAt: nowIso,
      serverTimestamp: FieldValue.serverTimestamp(),
    });

    logger.info("Daily Veltrox reminder sweep completed", {
      dispatchedReminders,
      quotaSkippedReminders,
      dispatchedDocumentAlerts,
    });
  }
);

export const onWorkOrderStatusChanged = onDocumentWritten(
  "workOrders/{workOrderId}",
  async (event) => {
    const db = getFirestore();
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!afterData && beforeData) {
      const publicToken = beforeData.publicStatusToken;
      if (typeof publicToken === "string" && publicToken.length > 0) {
        await db
          .collection("workOrderPublicStatus")
          .doc(publicToken)
          .delete()
          .catch(() => null);
      }
      return;
    }

    if (!afterData) return;

    const prevStatus = beforeData?.status;
    const nextStatus = afterData.status;
    if (prevStatus === nextStatus) return;

    if (nextStatus !== "ready" && nextStatus !== "completed") return;

    const linkedOwnerId =
      typeof afterData.linkedOwnerId === "string" ? afterData.linkedOwnerId : null;
    if (!linkedOwnerId) return;

    const ownerSnap = await db.collection("users").doc(linkedOwnerId).get();
    if (!ownerSnap.exists) return;
    const owner = ownerSnap.data() ?? {};
    if (owner.suspended === true) return;

    const isBg = (owner.language ?? "bg") === "bg";
    const plate = String(afterData.plateNumber ?? "");
    const vehicleLabel = String(afterData.vehicleLabel ?? plate);
    const nowIso = new Date().toISOString();

    const subject =
      nextStatus === "ready"
        ? isBg
          ? `Автомобилът е готов за получаване (${plate})`
          : `Vehicle Ready for Pickup (${plate})`
        : isBg
          ? `Сервизната поръчка е приключена (${plate})`
          : `Service Work Order Completed (${plate})`;

    const body =
      nextStatus === "ready"
        ? isBg
          ? `${vehicleLabel} (${plate}) е готов за получаване от сервиза.`
          : `${vehicleLabel} (${plate}) is ready for pickup at the workshop.`
        : isBg
          ? `Ремонтът на ${vehicleLabel} (${plate}) е приключен и синхронизиран с Вашия дневник.`
          : `Service on ${vehicleLabel} (${plate}) is completed and synced to your Car Diary.`;

    const actionUrl =
      typeof afterData.vehicleId === "string"
        ? `/app/cars/${afterData.vehicleId}`
        : "/app/cars";

    await db.collection("notifications").add({
      ownerId: linkedOwnerId,
      garageId: typeof afterData.garageId === "string" ? afterData.garageId : null,
      reminderId: null,
      documentId: null,
      actionUrl,
      channel: "in_app",
      subject,
      body,
      status: "sent",
      deliveryKey: `wo-status:${event.params.workOrderId}:${String(nextStatus)}`,
      provider: "cloud-functions-v2",
      simulated: false,
      readAt: null,
      createdAt: nowIso,
    });

    const prefs = (owner.notificationPreferences ?? {}) as Record<string, unknown>;
    if (prefs.serviceUpdates !== false && typeof owner.email === "string") {
      await sendEmailIfConfigured({
        to: owner.email,
        subject,
        text: body,
      });
    }
  }
);

export const onOnlineAppointmentRequested = onDocumentCreated(
  "appointments/{appointmentId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "requested") return;

    const garageId = typeof data.garageId === "string" ? data.garageId : null;
    if (!garageId) return;

    const db = getFirestore();
    const garageSnap = await db.collection("garages").doc(garageId).get();
    if (!garageSnap.exists) return;
    const garage = garageSnap.data() ?? {};

    const plate = String(data.plateNumber ?? "");
    const customerName = String(data.customerName ?? "");
    const serviceRequested = String(data.serviceRequested ?? "");
    const nowIso = new Date().toISOString();

    const subject = `Нова онлайн заявка за час: ${plate}`;
    const body = `${customerName} (${plate}) заяви час за: ${serviceRequested}.`;

    await db.collection("notifications").add({
      ownerId: typeof garage.ownerUid === "string" ? garage.ownerUid : null,
      garageId,
      reminderId: null,
      documentId: null,
      actionUrl: "/garage/appointments",
      channel: "in_app",
      subject,
      body,
      status: "sent",
      deliveryKey: `appt-req:${event.params.appointmentId}`,
      provider: "cloud-functions-v2",
      simulated: false,
      readAt: null,
      createdAt: nowIso,
    });

    if (typeof garage.email === "string" && garage.email.includes("@")) {
      await sendEmailIfConfigured({
        to: garage.email,
        subject,
        text: body,
      });
    }
  }
);
