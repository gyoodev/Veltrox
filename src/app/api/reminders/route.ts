import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { reminderFormSchema } from "@/lib/validators/car-diary";
import type { Reminder, Vehicle } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.profile.role !== "USER") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const vehicleIdFilter = searchParams.get("vehicleId");

  const snap = await admin.adminDb
    .collection("reminders")
    .where("ownerId", "==", ctx.session.uid)
    .get();

  const reminders = snap.docs
    .map((d) => ({ ...(d.data() as Reminder), id: d.id }))
    .filter((r) => (!vehicleIdFilter ? true : r.vehicleId === vehicleIdFilter))
    .sort((a, b) =>
      (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
    );

  return NextResponse.json({ reminders });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.profile.role !== "USER") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
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

  const parsed = reminderFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const uid = ctx.session.uid;

  const vehicleSnap = await admin.adminDb
    .collection("vehicles")
    .doc(data.vehicleId)
    .get();
  if (!vehicleSnap.exists) {
    return NextResponse.json({ error: "VEHICLE_NOT_FOUND" }, { status: 404 });
  }
  const vehicle = vehicleSnap.data() as Vehicle;
  if (vehicle.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const docRef = admin.adminDb.collection("reminders").doc();
  const nowIso = new Date().toISOString();

  const reminder: Reminder = {
    id: docRef.id,
    ownerId: uid,
    garageId: null,
    vehicleId: data.vehicleId,
    workOrderId: null,
    type: data.type,
    title: data.title,
    notes: data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    dueDate: data.dueDate && data.dueDate.length > 0 ? data.dueDate : null,
    dueMileageKm:
      typeof data.dueMileageKm === "number" && data.dueMileageKm > 0
        ? data.dueMileageKm
        : null,
    channels: data.channels,
    status: "scheduled",
    completedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(reminder);

  return NextResponse.json({ reminder }, { status: 201 });
}

