import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import { EmailNotificationProvider } from "@/lib/notifications/email-provider";
import { MockSmsNotificationProvider } from "@/lib/notifications/sms-provider";
import type {
  NotificationChannel,
  NotificationProvider,
  OutboundMessagePayload,
  ProviderDeliveryResult,
} from "@/lib/notifications/types";
import { MockViberNotificationProvider } from "@/lib/notifications/viber-provider";
import type { AppNotification, Garage } from "@/types/domain";

const PROVIDERS: Record<NotificationChannel, NotificationProvider> = {
  email: new EmailNotificationProvider(),
  sms: new MockSmsNotificationProvider(),
  viber: new MockViberNotificationProvider(),
};

export interface DispatchNotificationInput {
  ownerId: string | null;
  garageId: string | null;
  reminderId?: string | null;
  documentId?: string | null;
  deliveryKey?: string | null;
  channels: ReadonlyArray<NotificationChannel>;
  createInAppRecord?: boolean;
  consumeGarageQuota?: boolean;
  payload: OutboundMessagePayload;
}

export interface DispatchNotificationSummary {
  ok: boolean;
  quotaExceeded: boolean;
  inAppNotificationId: string | null;
  results: ProviderDeliveryResult[];
}

/**
 * Multi-Channel Notification Dispatcher.
 * - Enforces & increments garage monthly reminder quota when `consumeGarageQuota` is true.
 * - Writes an `in_app` notification document in `notifications/{id}` for workspace bell alerts.
 * - Dispatches across requested channels (`email`, `sms`, `viber`) via pluggable providers
 *   and logs channel delivery records.
 */
export async function dispatchMultiChannelNotification(
  input: DispatchNotificationInput
): Promise<DispatchNotificationSummary> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      ok: false,
      quotaExceeded: false,
      inAppNotificationId: null,
      results: [],
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Check & reserve garage monthly reminder quota when applicable
  if (input.consumeGarageQuota && input.garageId) {
    const garageRef = admin.adminDb.collection("garages").doc(input.garageId);
    const quotaAllowed = await admin.adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(garageRef);
      if (!snap.exists) return false;
      const garage = snap.data() as Garage;
      const quotaState = getEffectiveReminderQuota(garage, now);
      if (quotaState.remaining <= 0) {
        return false;
      }
      tx.update(garageRef, {
        monthlyRemindersUsed: quotaState.used + 1,
        quotaResetMonth: quotaState.monthKey,
        updatedAt: nowIso,
      });
      return true;
    });

    if (!quotaAllowed) {
      return {
        ok: false,
        quotaExceeded: true,
        inAppNotificationId: null,
        results: [],
      };
    }
  }

  // 2. Write in-app notification for workspace Bell Center (if recipient has an account or garage)
  let inAppNotificationId: string | null = null;
  if (
    input.createInAppRecord !== false &&
    (input.ownerId || input.garageId)
  ) {
    const inAppRef = admin.adminDb.collection("notifications").doc();
    const inAppDoc: Omit<AppNotification, "id"> = {
      ownerId: input.ownerId,
      garageId: input.garageId,
      reminderId: input.reminderId ?? null,
      documentId: input.documentId ?? null,
      actionUrl: input.payload.actionUrl ?? null,
      channel: "in_app",
      subject: input.payload.subject,
      body: input.payload.textBody,
      status: "sent",
      deliveryKey: input.deliveryKey ?? null,
      provider: "veltrox-in-app",
      simulated: false,
      readAt: null,
      createdAt: nowIso,
    };
    await inAppRef.set(inAppDoc);
    inAppNotificationId = inAppRef.id;
  }

  // 3. Dispatch across outbound channels (Email live/simulated, SMS mock, Viber mock)
  const results: ProviderDeliveryResult[] = [];
  for (const channel of input.channels) {
    const provider = PROVIDERS[channel];
    // Skip SMS/Viber when no phone exists, or skip Email when no email exists
    if (channel === "email" && !input.payload.toEmail) {
      continue;
    }
    if ((channel === "sms" || channel === "viber") && !input.payload.toPhone) {
      continue;
    }

    const delivery = await provider.send(input.payload);
    results.push(delivery);

    const logRef = admin.adminDb.collection("notifications").doc();
    const logDoc: Omit<AppNotification, "id"> = {
      ownerId: input.ownerId,
      garageId: input.garageId,
      reminderId: input.reminderId ?? null,
      documentId: input.documentId ?? null,
      actionUrl: input.payload.actionUrl ?? null,
      channel,
      subject: input.payload.subject,
      body: input.payload.textBody,
      status: delivery.ok ? "sent" : "failed",
      deliveryKey: input.deliveryKey ?? null,
      provider: delivery.provider,
      simulated: delivery.simulated,
      readAt: null,
      createdAt: nowIso,
    };
    await logRef.set(logDoc);
  }

  const anySucceeded =
    inAppNotificationId !== null || results.some((r) => r.ok);

  return {
    ok: anySucceeded,
    quotaExceeded: false,
    inAppNotificationId,
    results,
  };
}

