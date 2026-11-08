import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { appointmentRequestSchema } from "@/lib/validators/car-diary";
import type { Appointment, Garage } from "@/types/domain";

export const runtime = "nodejs";

/**
 * POST /api/appointments
 * Allows a signed-in car owner (or a visitor on a public garage booking page)
 * to request an appointment with an approved garage.
 */
export async function POST(request: Request): Promise<NextResponse> {
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

  const parsed = appointmentRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const garageSnap = await admin.adminDb
    .collection("garages")
    .doc(data.garageId)
    .get();

  if (!garageSnap.exists) {
    return NextResponse.json({ error: "GARAGE_NOT_FOUND" }, { status: 404 });
  }

  const garage = garageSnap.data() as Garage;
  if (garage.status !== "approved") {
    return NextResponse.json({ error: "GARAGE_NOT_AVAILABLE" }, { status: 403 });
  }

  const authCtx = await getCurrentAuthContext();
  const scheduledStartIso = new Date(
    `${data.preferredDate}T${data.preferredTime}:00`
  ).toISOString();
  const scheduledEndIso = new Date(
    Date.parse(scheduledStartIso) + 60 * 60 * 1000
  ).toISOString();

  const docRef = admin.adminDb.collection("appointments").doc();
  const nowIso = new Date().toISOString();

  const appointment: Appointment = {
    id: docRef.id,
    garageId: data.garageId,
    garageName: garage.name,
    ownerId: authCtx?.session.uid ?? null,
    vehicleId: data.vehicleId ?? null,
    customerName: data.customerName,
    customerPhone: data.customerPhone.trim(),
    plateNumber: data.plateNumber.toUpperCase(),
    serviceRequested: data.serviceRequested,
    notes: data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    scheduledStart: scheduledStartIso,
    scheduledEnd: scheduledEndIso,
    status: "requested",
    createdAt: nowIso,
  };

  await docRef.set(appointment);

  return NextResponse.json({ appointment }, { status: 201 });
}

