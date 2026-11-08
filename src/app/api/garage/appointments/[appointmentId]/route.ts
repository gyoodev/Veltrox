import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { syncPublicWorkOrderProjection } from "@/lib/data/garage";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { generatePublicStatusToken } from "@/lib/garage-utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { garageAppointmentPatchSchema } from "@/lib/validators/garage";
import type { Appointment, Customer, WorkOrder } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ appointmentId: string }>;
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

  const { appointmentId } = await context.params;
  const garageId = auth.garage.id;

  const ref = admin.adminDb.collection("appointments").doc(appointmentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Appointment;
  if (existing.garageId !== garageId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = garageAppointmentPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nowIso = new Date().toISOString();

  let createdWorkOrder: WorkOrder | null = null;
  let linkedWorkOrderId = existing.workOrderId ?? null;

  // 1-Click "Convert Appointment to Work Order"
  if (data.convertToWorkOrder && !linkedWorkOrderId) {
    const plateUpper = existing.plateNumber.trim().toUpperCase();
    const plateNorm = normalizeLicensePlate(plateUpper);

    const custSnap = await admin.adminDb
      .collection("customers")
      .where("garageId", "==", garageId)
      .get();
    const matchedCustDoc = custSnap.docs.find((d) => {
      const c = d.data() as Customer;
      const normList =
        c.platesNormalized ?? c.plateNumbers.map((p) => normalizeLicensePlate(p));
      return normList.includes(plateNorm);
    });

    let customerId: string;
    if (matchedCustDoc) {
      customerId = matchedCustDoc.id;
      await matchedCustDoc.ref.update({
        lastVisitAt: nowIso,
        updatedAt: nowIso,
      });
    } else {
      const custRef = admin.adminDb.collection("customers").doc();
      customerId = custRef.id;
      const cust: Customer = {
        id: customerId,
        garageId,
        linkedOwnerId: existing.ownerId ?? null,
        fullName: existing.customerName,
        phone: existing.customerPhone,
        email: null,
        plateNumbers: [plateUpper],
        platesNormalized: [plateNorm],
        notes: null,
        lastVisitAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await custRef.set(cust);
    }

    const woRef = admin.adminDb.collection("workOrders").doc();
    linkedWorkOrderId = woRef.id;
    createdWorkOrder = {
      id: woRef.id,
      garageId,
      customerId,
      customerName: existing.customerName,
      customerPhone: existing.customerPhone,
      customerEmail: null,
      linkedOwnerId: existing.ownerId ?? null,
      vehicleId: existing.vehicleId ?? null,
      plateNumber: plateUpper,
      plateNormalized: plateNorm,
      vehicleLabel: plateUpper,
      mileageKm: null,
      status: "received",
      publicStatusToken: generatePublicStatusToken(),
      dropOffPhotoUrls: [],
      dropOffPhotos: [],
      internalNotes: existing.notes ?? null,
      customerSummary: existing.serviceRequested,
      totalLaborAmount: 0,
      totalPartsAmount: 0,
      totalAmount: 0,
      currency: "EUR",
      nextServiceDate: null,
      nextServiceMileageKm: null,
      reminderId: null,
      syncedDiaryEntryId: null,
      completedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await woRef.set(createdWorkOrder);
    await syncPublicWorkOrderProjection(auth.garage, createdWorkOrder, []);
  }

  const updated: Appointment = {
    ...existing,
    id: appointmentId,
    status: data.convertToWorkOrder
      ? "confirmed"
      : data.status ?? existing.status,
    scheduledStart: data.scheduledStart ?? existing.scheduledStart,
    scheduledEnd: data.scheduledEnd ?? existing.scheduledEnd,
    notes: data.notes !== undefined ? data.notes : existing.notes ?? null,
    workOrderId: linkedWorkOrderId,
    updatedAt: nowIso,
  };

  await ref.set(updated);

  return NextResponse.json({
    appointment: updated,
    workOrder: createdWorkOrder,
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await resolveGarageApiAuth({ requireManager: true });
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

  const { appointmentId } = await context.params;
  const ref = admin.adminDb.collection("appointments").doc(appointmentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Appointment;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await ref.delete();

  return NextResponse.json({ deleted: true });
}

