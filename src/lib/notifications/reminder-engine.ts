import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { dispatchMultiChannelNotification } from "@/lib/notifications/dispatcher";
import {
  evaluateDocumentExpiryAlert,
  evaluateReminderDueState,
  resolveEffectiveChannels,
} from "@/lib/notifications/evaluators";
import {
  buildDocumentExpiryTemplate,
  buildReminderTemplate,
} from "@/lib/notifications/templates";
import type {
  AppLocale,
  AppNotification,
  Garage,
  Reminder,
  UserProfile,
  Vehicle,
  VehicleDocument,
} from "@/types/domain";

export interface ReminderSweepSummary {
  evaluatedReminders: number;
  dispatchedReminders: number;
  quotaSkippedReminders: number;
  evaluatedDocuments: number;
  dispatchedDocumentAlerts: number;
  executedAt: string;
}

/**
 * Executes the scheduled daily Reminder & Document Expiry Sweep:
 * 1. Scans all `reminders` with `status == "scheduled"`, evaluating both due date (`<= 7d`)
 *    and linked vehicle odometer (`<= 500 km`).
 * 2. Scans `documents` for expiry dates within `<= 14d` (deduplicated via `deliveryKey`).
 * 3. Dispatches localized (`bg` / `en`) notifications respecting user preferences and
 *    garage monthly plan quotas, then writes an immutable `REMINDER_ENGINE_RUN` audit log.
 */
export async function runScheduledReminderSweep(options?: {
  now?: Date;
  actorUid?: string;
  actorRole?: "ADMIN" | "SYSTEM";
}): Promise<ReminderSweepSummary> {
  const admin = getFirebaseAdmin();
  const now = options?.now ?? new Date();
  const nowIso = now.toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!admin) {
    return {
      evaluatedReminders: 0,
      dispatchedReminders: 0,
      quotaSkippedReminders: 0,
      evaluatedDocuments: 0,
      dispatchedDocumentAlerts: 0,
      executedAt: nowIso,
    };
  }

  const [remindersSnap, vehiclesSnap, usersSnap, garagesSnap, docsSnap, notifSnap] =
    await Promise.all([
      admin.adminDb
        .collection("reminders")
        .where("status", "==", "scheduled")
        .get(),
      admin.adminDb.collection("vehicles").get(),
      admin.adminDb.collection("users").get(),
      admin.adminDb.collection("garages").get(),
      admin.adminDb.collection("documents").get(),
      admin.adminDb
        .collection("notifications")
        .where("channel", "==", "in_app")
        .get(),
    ]);

  const vehiclesById = new Map<string, Vehicle>();
  for (const d of vehiclesSnap.docs) {
    vehiclesById.set(d.id, { ...(d.data() as Vehicle), id: d.id });
  }

  const usersById = new Map<string, UserProfile>();
  for (const d of usersSnap.docs) {
    usersById.set(d.id, { ...(d.data() as UserProfile), uid: d.id });
  }

  const garagesById = new Map<string, Garage>();
  for (const d of garagesSnap.docs) {
    garagesById.set(d.id, { ...(d.data() as Garage), id: d.id });
  }

  const sentDeliveryKeys = new Set<string>();
  for (const d of notifSnap.docs) {
    const n = d.data() as AppNotification;
    if (n.deliveryKey) {
      sentDeliveryKeys.add(n.deliveryKey);
    }
  }

  let dispatchedReminders = 0;
  let quotaSkippedReminders = 0;

  for (const docSnap of remindersSnap.docs) {
    const reminder = { ...(docSnap.data() as Reminder), id: docSnap.id };
    const vehicle = reminder.vehicleId
      ? (vehiclesById.get(reminder.vehicleId) ?? null)
      : null;
    const evalState = evaluateReminderDueState(
      reminder,
      vehicle?.currentMileageKm ?? null,
      now
    );

    if (!evalState.shouldSend) {
      continue;
    }

    const owner = reminder.ownerId
      ? (usersById.get(reminder.ownerId) ?? null)
      : null;
    if (owner?.suspended) {
      continue;
    }

    const garage = reminder.garageId
      ? (garagesById.get(reminder.garageId) ?? null)
      : null;
    if (garage && garage.status !== "approved") {
      continue;
    }

    const locale: AppLocale = owner?.language ?? "bg";
    const toEmail = reminder.recipientEmail || owner?.email || null;
    const toPhone = reminder.recipientPhone || owner?.phone || null;
    const recipientName =
      reminder.recipientName || owner?.displayName || null;
    const plateNumber = reminder.plateNumber || vehicle?.plateNumber || null;

    const channels = resolveEffectiveChannels({
      requestedChannels: reminder.channels,
      preferences: owner?.notificationPreferences ?? null,
      category: "reminder",
    });

    const actionUrl = owner
      ? `${appUrl}/app/reminders`
      : garage
        ? `${appUrl}/garages/${garage.slug}`
        : appUrl;

    const content = buildReminderTemplate({
      locale,
      recipientName,
      title: reminder.title,
      type: reminder.type,
      plateNumber,
      dueDate: reminder.dueDate,
      dueMileageKm: reminder.dueMileageKm,
      garageName: garage?.name ?? null,
      actionUrl,
    });

    const cycleSuffix =
      reminder.dueDate ??
      (reminder.dueMileageKm !== null && reminder.dueMileageKm !== undefined
        ? String(reminder.dueMileageKm)
        : "once");

    const summary = await dispatchMultiChannelNotification({
      ownerId: reminder.ownerId,
      garageId: reminder.garageId,
      reminderId: reminder.id,
      deliveryKey: `reminder:${reminder.id}:${cycleSuffix}`,
      channels,
      createInAppRecord: true,
      consumeGarageQuota: Boolean(reminder.garageId),
      payload: {
        toEmail,
        toPhone,
        recipientName,
        locale,
        subject: content.subject,
        textBody: content.textBody,
        htmlBody: content.htmlBody,
        actionUrl: owner ? "/app/reminders" : "/garage/work-orders",
      },
    });

    if (summary.quotaExceeded) {
      quotaSkippedReminders += 1;
      await docSnap.ref.update({
        lastError: "MONTHLY_QUOTA_EXCEEDED",
        updatedAt: nowIso,
      });
      continue;
    }

    if (summary.ok) {
      dispatchedReminders += 1;
      await docSnap.ref.update({
        status: "sent",
        sentAt: nowIso,
        lastError: null,
        updatedAt: nowIso,
      });
    } else {
      await docSnap.ref.update({
        lastError: summary.results[0]?.error ?? "DELIVERY_SKIPPED",
        updatedAt: nowIso,
      });
    }
  }

  // 2. Expiring Vault Documents Sweep
  let dispatchedDocumentAlerts = 0;
  for (const docSnap of docsSnap.docs) {
    const vehicleDoc = {
      ...(docSnap.data() as VehicleDocument),
      id: docSnap.id,
    };
    const evalDoc = evaluateDocumentExpiryAlert(vehicleDoc, now);
    if (
      !evalDoc.shouldAlert ||
      evalDoc.daysRemaining === null ||
      !evalDoc.deliveryKey
    ) {
      continue;
    }

    if (sentDeliveryKeys.has(evalDoc.deliveryKey)) {
      continue;
    }

    const owner = usersById.get(vehicleDoc.ownerId) ?? null;
    if (!owner || owner.suspended) {
      continue;
    }

    const channels = resolveEffectiveChannels({
      requestedChannels: ["email"],
      preferences: owner.notificationPreferences,
      category: "document_expiry",
    });

    const vehicle = vehiclesById.get(vehicleDoc.vehicleId) ?? null;
    const content = buildDocumentExpiryTemplate({
      locale: owner.language ?? "bg",
      recipientName: owner.displayName,
      docTitle: vehicleDoc.title,
      docType: vehicleDoc.docType,
      plateNumber: vehicle?.plateNumber ?? null,
      expiryDate: vehicleDoc.expiryDate ?? "",
      daysRemaining: evalDoc.daysRemaining,
      actionUrl: `${appUrl}/app/documents`,
    });

    const summary = await dispatchMultiChannelNotification({
      ownerId: owner.uid,
      garageId: null,
      documentId: vehicleDoc.id,
      deliveryKey: evalDoc.deliveryKey,
      channels,
      createInAppRecord: true,
      consumeGarageQuota: false,
      payload: {
        toEmail: owner.email,
        toPhone: owner.phone,
        recipientName: owner.displayName,
        locale: owner.language ?? "bg",
        subject: content.subject,
        textBody: content.textBody,
        htmlBody: content.htmlBody,
        actionUrl: "/app/documents",
      },
    });

    if (summary.ok) {
      sentDeliveryKeys.add(evalDoc.deliveryKey);
      dispatchedDocumentAlerts += 1;
    }
  }

  await admin.adminDb.collection("auditLogs").add({
    action: "REMINDER_ENGINE_RUN",
    actorUid: options?.actorUid ?? "cron-scheduler",
    actorRole: options?.actorRole ?? "SYSTEM",
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

  return {
    evaluatedReminders: remindersSnap.size,
    dispatchedReminders,
    quotaSkippedReminders,
    evaluatedDocuments: docsSnap.size,
    dispatchedDocumentAlerts,
    executedAt: nowIso,
  };
}

/**
 * Evaluates a newly created or renewed user reminder immediately upon save.
 * If the expiry date is already within the alert window (<= 14 days for compliance
 * obligations such as Liability Insurance, Vignette, GTP, Casco, Fire Extinguisher,
 * and Vehicle Tax; <= 7 days or <= 500 km for service reminders), dispatches an
 * immediate In-App Bell + Email notification without waiting for tomorrow's cron.
 */
export async function dispatchImmediateReminderAlertIfDue(params: {
  reminder: Reminder;
  vehicle: Vehicle | null;
  owner: UserProfile;
}): Promise<Reminder> {
  const { reminder, vehicle, owner } = params;
  const admin = getFirebaseAdmin();
  if (!admin || owner.suspended || reminder.status !== "scheduled") {
    return reminder;
  }

  const evalState = evaluateReminderDueState(
    reminder,
    vehicle?.currentMileageKm ?? null
  );
  if (!evalState.shouldSend) {
    return reminder;
  }

  const cycleSuffix =
    reminder.dueDate ??
    (reminder.dueMileageKm !== null && reminder.dueMileageKm !== undefined
      ? String(reminder.dueMileageKm)
      : "once");
  const deliveryKey = `reminder:${reminder.id}:${cycleSuffix}`;

  // Avoid duplicate dispatch if already notified for this exact due date / mileage cycle
  const existingSnap = await admin.adminDb
    .collection("notifications")
    .where("ownerId", "==", owner.uid)
    .get();
  const alreadyDelivered = existingSnap.docs.some(
    (d) => (d.data() as AppNotification).deliveryKey === deliveryKey
  );
  if (alreadyDelivered) {
    return reminder;
  }

  const locale: AppLocale = owner.language ?? "bg";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const channels = resolveEffectiveChannels({
    requestedChannels: reminder.channels,
    preferences: owner.notificationPreferences,
    category: "reminder",
  });

  const content = buildReminderTemplate({
    locale,
    recipientName: owner.displayName,
    title: reminder.title,
    type: reminder.type,
    plateNumber: vehicle?.plateNumber ?? reminder.plateNumber ?? null,
    dueDate: reminder.dueDate,
    dueMileageKm: reminder.dueMileageKm,
    garageName: null,
    actionUrl: `${appUrl}/app/reminders`,
  });

  const summary = await dispatchMultiChannelNotification({
    ownerId: owner.uid,
    garageId: null,
    reminderId: reminder.id,
    deliveryKey,
    channels,
    createInAppRecord: true,
    consumeGarageQuota: false,
    payload: {
      toEmail: owner.email,
      toPhone: owner.phone,
      recipientName: owner.displayName,
      locale,
      subject: content.subject,
      textBody: content.textBody,
      htmlBody: content.htmlBody,
      actionUrl: "/app/reminders",
    },
  });

  if (!summary.ok) {
    return reminder;
  }

  const nowIso = new Date().toISOString();
  const sentReminder: Reminder = {
    ...reminder,
    status: "sent",
    sentAt: nowIso,
    lastError: null,
    updatedAt: nowIso,
  };
  await admin.adminDb
    .collection("reminders")
    .doc(reminder.id)
    .set(sentReminder, { merge: true });

  return sentReminder;
}

