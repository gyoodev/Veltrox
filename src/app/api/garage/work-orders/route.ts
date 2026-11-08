import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import {
  syncCompletedWorkOrderToCarDiary,
  syncPublicWorkOrderProjection,
} from "@/lib/data/garage";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { generatePublicStatusToken } from "@/lib/garage-utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { quickWorkOrderFormSchema } from "@/lib/validators/garage";
import type { Customer, Vehicle, WorkOrder } from "@/types/domain";

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
    .collection("workOrders")
    .where("garageId", "==", auth.garage.id)
    .get();

  const workOrders = snap.docs
    .map((d) => ({ ...(d.data() as WorkOrder), id: d.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ workOrders });
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

  const parsed = quickWorkOrderFormSchema.safeParse(rawBody);
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

  // 1. Check if a registered Car Owner vehicle matches this plate
  const vehSnap = await admin.adminDb
    .collection("vehicles")
    .where("plateNormalized", "==", plateNormalized)
    .limit(1)
    .get();
  const matchedVehDoc = vehSnap.docs[0];
  const matchedVeh = matchedVehDoc
    ? ({ ...(matchedVehDoc.data() as Vehicle), id: matchedVehDoc.id } as Vehicle)
    : null;
  const isAcceptedLink = Boolean(
    matchedVeh && (matchedVeh.linkedGarageIds ?? []).includes(garageId)
  );

  // 2. Auto-match or auto-create Customer record for sub-30s intake
  const custSnap = await admin.adminDb
    .collection("customers")
    .where("garageId", "==", garageId)
    .get();
  const existingCustomerDoc = custSnap.docs.find((d) => {
    const c = d.data() as Customer;
    const normList =
      c.platesNormalized ?? c.plateNumbers.map((p) => normalizeLicensePlate(p));
    return (
      normList.includes(plateNormalized) ||
      c.phone.replace(/\s+/g, "") === data.customerPhone.replace(/\s+/g, "")
    );
  });

  let customer: Customer;
  if (existingCustomerDoc) {
    const existingData = existingCustomerDoc.data() as Customer;
    const mergedPlates = Array.from(
      new Set([...existingData.plateNumbers, plateUpper])
    );
    customer = {
      ...existingData,
      id: existingCustomerDoc.id,
      fullName:
        data.customerName.trim() || existingData.fullName || plateUpper,
      phone: data.customerPhone.trim() || existingData.phone,
      plateNumbers: mergedPlates,
      platesNormalized: mergedPlates.map((p) => normalizeLicensePlate(p)),
      linkedOwnerId:
        existingData.linkedOwnerId ?? matchedVeh?.ownerId ?? null,
      lastVisitAt: nowIso,
      updatedAt: nowIso,
    };
    await existingCustomerDoc.ref.set(customer);
  } else {
    const custRef = admin.adminDb.collection("customers").doc();
    customer = {
      id: custRef.id,
      garageId,
      linkedOwnerId: matchedVeh?.ownerId ?? null,
      fullName: data.customerName.trim() || plateUpper,
      phone: data.customerPhone.trim(),
      email: null,
      plateNumbers: [plateUpper],
      platesNormalized: [plateNormalized],
      notes: null,
      lastVisitAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await custRef.set(customer);
  }

  const resolvedVehicleLabel =
    data.vehicleLabel.trim() ||
    (matchedVeh ? `${matchedVeh.make} ${matchedVeh.model}` : plateUpper);

  const woRef = admin.adminDb.collection("workOrders").doc();
  const publicStatusToken = generatePublicStatusToken();

  const workOrder: WorkOrder = {
    id: woRef.id,
    garageId,
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    linkedOwnerId: isAcceptedLink ? (matchedVeh?.ownerId ?? null) : null,
    vehicleId: isAcceptedLink ? (matchedVeh?.id ?? null) : null,
    plateNumber: plateUpper,
    plateNormalized,
    vehicleLabel: resolvedVehicleLabel,
    mileageKm: data.mileageKm ?? null,
    status: data.status,
    publicStatusToken,
    dropOffPhotoUrls: [],
    dropOffPhotos: [],
    internalNotes: null,
    customerSummary: data.customerSummary.trim(),
    totalLaborAmount: 0,
    totalPartsAmount: 0,
    totalAmount: 0,
    currency: data.currency,
    nextServiceDate: null,
    nextServiceMileageKm: null,
    reminderId: null,
    syncedDiaryEntryId: null,
    completedAt: data.status === "completed" ? nowIso : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await woRef.set(workOrder);
  await syncPublicWorkOrderProjection(auth.garage, workOrder, []);

  if (workOrder.status === "completed") {
    const syncedId = await syncCompletedWorkOrderToCarDiary(
      auth.garage,
      workOrder,
      []
    );
    if (syncedId) {
      workOrder.syncedDiaryEntryId = syncedId;
      await woRef.update({ syncedDiaryEntryId: syncedId });
    }
  }

  return NextResponse.json({ workOrder, customer }, { status: 201 });
}

