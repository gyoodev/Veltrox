import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { garageAppointmentFormSchema } from "@/lib/validators/garage";
import type { Appointment } from "@/types/domain";

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
    .collection("appointments")
    .where("garageId", "==", auth.garage.id)
    .get();

  const appointments = snap.docs
    .map((d) => ({ ...(d.data() as Appointment), id: d.id }))
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

  return NextResponse.json({ appointments });
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

  const parsed = garageAppointmentFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const scheduledStart = new Date(`${data.date}T${data.time}:00`).toISOString();
  const scheduledEnd = new Date(
    Date.parse(scheduledStart) + data.durationMinutes * 60 * 1000
  ).toISOString();

  const docRef = admin.adminDb.collection("appointments").doc();
  const nowIso = new Date().toISOString();

  const appointment: Appointment = {
    id: docRef.id,
    garageId: auth.garage.id,
    garageName: auth.garage.name,
    ownerId: null,
    vehicleId: null,
    workOrderId: null,
    customerName: data.customerName.trim(),
    customerPhone: data.customerPhone.trim(),
    plateNumber: data.plateNumber.trim().toUpperCase(),
    serviceRequested: data.serviceRequested.trim(),
    notes:
      data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    scheduledStart,
    scheduledEnd,
    status: "confirmed",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(appointment);

  return NextResponse.json({ appointment }, { status: 201 });
}

