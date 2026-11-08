/**
 * Veltrox — Firebase Cloud Functions v2 Daily Reminder & Document Expiry Scheduler
 *
 * Runs daily at 07:00 Europe/Sofia:
 * 1. Evaluates scheduled reminders due within <= 7 days or <= 500 km of linked vehicle mileage.
 * 2. Evaluates vehicle vault documents expiring within <= 14 days (deduplicated per expiry cycle).
 * 3. Enforces garage monthly reminder quotas (Free: 50/mo, Pro: 500/mo).
 * 4. Dispatches Email via Resend HTTP (with mock SMS/Viber provider adapters) and writes
 *    in-app `notifications` + immutable `REMINDER_ENGINE_RUN` audit logs.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

if (getApps().length === 0) {
  initializeApp();
}

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
}

export const dailyVeltroxReminderSweep = onSchedule(
  {
    schedule: "every day 07:00",
    timeZone: "Europe/Sofia",
    region: "europe-west1",
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

      const isDue =
        (daysUntil !== null && daysUntil <= 7) ||
        (kmLeft !== null && kmLeft <= 500);
      if (!isDue) continue;

      const ownerId = typeof rem.ownerId === "string" ? rem.ownerId : null;
      const garageId = typeof rem.garageId === "string" ? rem.garageId : null;
      const owner = ownerId ? users.get(ownerId) : undefined;
      if (owner?.suspended === true) continue;

      if (garageId) {
        const g = garages.get(garageId);
        if (!g || g.status !== "approved") continue;
        const quota = typeof g.monthlyReminderQuota === "number" ? g.monthlyReminderQuota : 50;
        const used =
          g.quotaResetMonth === monthKey && typeof g.monthlyRemindersUsed === "number"
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

      const subject = `Veltrox: ${String(rem.title ?? "Service Reminder")}`;
      const body = `Upcoming vehicle milestone${rem.plateNumber ? ` (${String(rem.plateNumber)})` : ""}: ${String(rem.title ?? "")}.`;

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

      const toEmail =
        (typeof rem.recipientEmail === "string" && rem.recipientEmail) ||
        (typeof owner?.email === "string" ? owner.email : null);

      if (toEmail) {
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

      const subject = `Expiring Document: ${String(data.title ?? "Document")}`;
      const body = `${String(data.title ?? "Document")} expires on ${expStr.slice(0, 10)}.`;

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

