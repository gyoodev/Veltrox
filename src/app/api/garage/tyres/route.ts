import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { tyreSetFormSchema } from "@/lib/validators/garage";
import type { Customer, Reminder, TyreSet } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
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

  const snap = await admin.adminDb
    .collection("tyreSets")
    .where("garageId", "==", auth.garage.id)
    .get();

  const tyreSets = snap.docs
    .map((d) => ({ ...(d.data() as TyreSet), id: d.id }))
    .sort((a, b) => b.storedAt.localeCompare(a.storedAt));

  return NextResponse.json({ tyreSets });
}

export async function POST(request: Request): Promise<NextResponse> {
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = tyreSetFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const garageId = auth.garage.id;
  const plateUpper = data.plateNumber.trim().toUpperCase();
  const plateNormalized = normalizeLicensePlate(plateUpper);
  const nowIso = new Date().toISOString();

  // Match customer if exists
  const custSnap = await admin.adminDb
    .collection("customers")
    .where("garageId", "==", garageId)
    .get();
  const matchedCust = custSnap.docs.find((d) => {
    const c = d.data() as Customer;
    const normList =
      c.platesNormalized ?? c.plateNumbers.map((p) => normalizeLicensePlate(p));
    return normList.includes(plateNormalized);
  });

  const reminderDate =
    data.seasonalReminderDate && data.seasonalReminderDate.trim().length > 0
      ? data.seasonalReminderDate.trim()
      : null;

  let reminderId: string | null = null;
  if (reminderDate) {
    const quota = getEffectiveReminderQuota(auth.garage);
    if (quota.remaining <= 0) {
      return NextResponse.json(
        { error: "REMINDER_QUOTA_EXCEEDED", quota: quota.quota },
        { status: 429 }
      );
    }

    const remRef = admin.adminDb.collection("reminders").doc();
    reminderId = remRef.id;
    const matchedCustData = matchedCust?.data() as Customer | undefined;

    const remDoc: Reminder = {
      id: remRef.id,
      ownerId: matchedCustData?.linkedOwnerId ?? null,
      garageId,
      vehicleId: null,
      workOrderId: null,
      recipientEmail: matchedCustData?.email ?? null,
      recipientPhone: data.customerPhone.trim(),
      recipientName: data.customerName.trim(),
      plateNumber: plateUpper,
      type: "seasonal_tyres",
      title: `${auth.garage.name}: Seasonal Tyres (${plateUpper} • Shelf ${data.shelfLocation.toUpperCase()})`,
      notes: `${data.brandModel} ${data.sizeSpec}`,
      dueDate: reminderDate,
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
  }

  const docRef = admin.adminDb.collection("tyreSets").doc();
  const tyreSet: TyreSet = {
    id: docRef.id,
    garageId,
    customerId: matchedCust?.id ?? null,
    customerName: data.customerName.trim(),
    customerPhone: data.customerPhone.trim(),
    plateNumber: plateUpper,
    plateNormalized,
    brandModel: data.brandModel.trim(),
    sizeSpec: data.sizeSpec.trim().toUpperCase(),
    season: data.season,
    quantity: data.quantity,
    withRims: data.withRims,
    treadDepthMm: data.treadDepthMm,
    shelfLocation: data.shelfLocation.trim().toUpperCase(),
    status: data.status,
    seasonalReminderDate: reminderDate,
    reminderId,
    notes:
      data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    storedAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(tyreSet);

  return NextResponse.json({ tyreSet }, { status: 201 });
}

