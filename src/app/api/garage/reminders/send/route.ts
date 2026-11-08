import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { dispatchMultiChannelNotification } from "@/lib/notifications/dispatcher";
import { buildReminderTemplate } from "@/lib/notifications/templates";
import type { AppLocale, Reminder, UserProfile } from "@/types/domain";

const sendOneReminderSchema = z.object({
  reminderId: z.string().max(128).nullable().optional(),
  workOrderId: z.string().max(128).nullable().optional(),
  linkedOwnerId: z.string().max(128).nullable().optional(),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().max(32).nullable().optional(),
  customerEmail: z.string().trim().max(160).nullable().optional(),
  plateNumber: z.string().trim().min(2).max(24),
  vehicleLabel: z.string().trim().min(1).max(120),
  dueDate: z.string().max(32).nullable().optional(),
  dueMileageKm: z.number().int().min(0).max(2_500_000).nullable().optional(),
});

/**
 * POST /api/garage/reminders/send — 1-click outreach reminder from Garage Analytics.
 * Enforces the garage's monthly reminder quota, creates/updates the Reminder record,
 * and dispatches Email (+ SMS mock when phone is available) + in-app notification.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await resolveGarageApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = sendOneReminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nowIso = new Date().toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let ownerProfile: UserProfile | null = null;
  if (data.linkedOwnerId) {
    const ownerSnap = await admin.adminDb
      .collection("users")
      .doc(data.linkedOwnerId)
      .get();
    if (ownerSnap.exists) {
      ownerProfile = ownerSnap.data() as UserProfile;
    }
  }

  const locale: AppLocale =
    ownerProfile?.language ?? auth.profile.language ?? "bg";
  const toEmail = data.customerEmail || ownerProfile?.email || null;
  const toPhone = data.customerPhone || ownerProfile?.phone || null;

  const actionUrl = ownerProfile
    ? `${appUrl}/app/reminders`
    : `${appUrl}/garages/${auth.garage.slug}`;

  const title =
    locale === "bg"
      ? `Сервизно обслужване — ${data.vehicleLabel}`
      : `Scheduled Service — ${data.vehicleLabel}`;

  const content = buildReminderTemplate({
    locale,
    recipientName: data.customerName,
    title,
    type: "custom_service",
    plateNumber: data.plateNumber,
    dueDate: data.dueDate ?? null,
    dueMileageKm: data.dueMileageKm ?? null,
    garageName: auth.garage.name,
    actionUrl,
  });

  const channels: Array<"email" | "sms"> = ["email"];
  if (toPhone) {
    channels.push("sms");
  }

  // Upsert or verify reminder record belonging to this garage
  let targetReminderId = data.reminderId ?? null;
  if (targetReminderId) {
    const existingSnap = await admin.adminDb
      .collection("reminders")
      .doc(targetReminderId)
      .get();
    if (
      !existingSnap.exists ||
      (existingSnap.data() as Reminder).garageId !== auth.garage.id
    ) {
      targetReminderId = null;
    }
  }

  if (!targetReminderId) {
    const newRef = admin.adminDb.collection("reminders").doc();
    const remDoc: Omit<Reminder, "id"> = {
      ownerId: data.linkedOwnerId ?? null,
      garageId: auth.garage.id,
      vehicleId: null,
      workOrderId: data.workOrderId ?? null,
      recipientEmail: toEmail,
      recipientPhone: toPhone,
      recipientName: data.customerName,
      plateNumber: data.plateNumber,
      type: "custom_service",
      title,
      notes: null,
      dueDate: data.dueDate ?? null,
      dueMileageKm: data.dueMileageKm ?? null,
      channels,
      status: "scheduled",
      sentAt: null,
      lastError: null,
      completedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await newRef.set(remDoc);
    targetReminderId = newRef.id;
  }

  const dispatchResult = await dispatchMultiChannelNotification({
    ownerId: data.linkedOwnerId ?? null,
    garageId: auth.garage.id,
    reminderId: targetReminderId,
    deliveryKey: `manual-reminder:${targetReminderId}:${nowIso.slice(0, 10)}`,
    channels,
    createInAppRecord: true,
    consumeGarageQuota: true,
    payload: {
      toEmail,
      toPhone,
      recipientName: data.customerName,
      locale,
      subject: content.subject,
      textBody: content.textBody,
      htmlBody: content.htmlBody,
      actionUrl: ownerProfile ? "/app/reminders" : `/garages/${auth.garage.slug}`,
    },
  });

  if (dispatchResult.quotaExceeded) {
    return NextResponse.json(
      { error: "QUOTA_EXCEEDED" },
      { status: 429 }
    );
  }

  await admin.adminDb.collection("reminders").doc(targetReminderId).update({
    status: "sent",
    sentAt: nowIso,
    lastError: null,
    updatedAt: nowIso,
  });

  return NextResponse.json({
    ok: true,
    reminderId: targetReminderId,
    results: dispatchResult.results,
  });
}

