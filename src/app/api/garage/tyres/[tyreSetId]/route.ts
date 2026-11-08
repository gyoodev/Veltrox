import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { tyreSetPatchSchema } from "@/lib/validators/garage";
import type { Reminder, TyreSet } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ tyreSetId: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
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

  const { tyreSetId } = await context.params;
  const garageId = auth.garage.id;

  const ref = admin.adminDb.collection("tyreSets").doc(tyreSetId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as TyreSet;
  if (existing.garageId !== garageId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = tyreSetPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nowIso = new Date().toISOString();

  const nextReminderDate =
    data.seasonalReminderDate !== undefined
      ? data.seasonalReminderDate && data.seasonalReminderDate.trim().length > 0
        ? data.seasonalReminderDate.trim()
        : null
      : existing.seasonalReminderDate;

  let reminderId = existing.reminderId ?? null;
  if (nextReminderDate && !reminderId) {
    const quota = getEffectiveReminderQuota(auth.garage);
    if (quota.remaining <= 0) {
      return NextResponse.json(
        { error: "REMINDER_QUOTA_EXCEEDED", quota: quota.quota },
        { status: 429 }
      );
    }

    const remRef = admin.adminDb.collection("reminders").doc();
    reminderId = remRef.id;
    const remDoc: Reminder = {
      id: remRef.id,
      ownerId: null,
      garageId,
      vehicleId: null,
      workOrderId: null,
      recipientEmail: null,
      recipientPhone: data.customerPhone ?? existing.customerPhone,
      recipientName: data.customerName ?? existing.customerName,
      plateNumber: existing.plateNumber,
      type: "seasonal_tyres",
      title: `${auth.garage.name}: Seasonal Tyres (${existing.plateNumber} • Shelf ${(data.shelfLocation ?? existing.shelfLocation).toUpperCase()})`,
      notes: `${existing.brandModel} ${existing.sizeSpec}`,
      dueDate: nextReminderDate,
      dueMileageKm: null,
      channels: ["email"],
      status: "scheduled",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await remRef.set(remDoc);
    await admin.adminDb.collection("garages").doc(garageId).update({
      monthlyRemindersUsed: quota.used + 1,
      quotaResetMonth: quota.monthKey,
      updatedAt: nowIso,
    });
  } else if (nextReminderDate && reminderId) {
    await admin.adminDb
      .collection("reminders")
      .doc(reminderId)
      .set({ dueDate: nextReminderDate, updatedAt: nowIso }, { merge: true });
  }

  const nextPlate = data.plateNumber
    ? data.plateNumber.trim().toUpperCase()
    : existing.plateNumber;

  const updated: TyreSet = {
    ...existing,
    id: tyreSetId,
    plateNumber: nextPlate,
    plateNormalized: normalizeLicensePlate(nextPlate),
    customerName: data.customerName
      ? data.customerName.trim()
      : existing.customerName,
    customerPhone: data.customerPhone
      ? data.customerPhone.trim()
      : existing.customerPhone,
    brandModel: data.brandModel ? data.brandModel.trim() : existing.brandModel,
    sizeSpec: data.sizeSpec
      ? data.sizeSpec.trim().toUpperCase()
      : existing.sizeSpec,
    season: data.season ?? existing.season,
    quantity: data.quantity ?? existing.quantity,
    withRims: data.withRims !== undefined ? data.withRims : existing.withRims,
    treadDepthMm:
      data.treadDepthMm !== undefined
        ? data.treadDepthMm
        : existing.treadDepthMm,
    shelfLocation: data.shelfLocation
      ? data.shelfLocation.trim().toUpperCase()
      : existing.shelfLocation,
    status: data.status ?? existing.status,
    seasonalReminderDate: nextReminderDate,
    reminderId,
    notes:
      data.notes !== undefined
        ? data.notes && data.notes.trim().length > 0
          ? data.notes.trim()
          : null
        : existing.notes,
    updatedAt: nowIso,
  };

  await ref.set(updated);

  return NextResponse.json({ tyreSet: updated });
}

export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
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

  const { tyreSetId } = await context.params;
  const ref = admin.adminDb.collection("tyreSets").doc(tyreSetId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as TyreSet;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await ref.delete();

  return NextResponse.json({ deleted: true });
}

