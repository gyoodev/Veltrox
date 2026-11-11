import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { diaryEntryFormSchema } from "@/lib/validators/car-diary";
import type { DiaryEntry, Vehicle } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (ctx.profile.role !== "USER" && ctx.profile.role !== "ADMIN")) {
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
    .collection("diaryEntries")
    .where("ownerId", "==", ctx.session.uid)
    .get();

  const entries = snap.docs
    .map((d) => ({ ...(d.data() as DiaryEntry), id: d.id }))
    .filter((item) => (!vehicleIdFilter ? true : item.vehicleId === vehicleIdFilter))
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
    });

  return NextResponse.json({ entries });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (ctx.profile.role !== "USER" && ctx.profile.role !== "ADMIN")) {
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

  const parsed = diaryEntryFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const uid = ctx.session.uid;

  // Verify the target vehicle belongs to the caller
  const vehicleRef = admin.adminDb.collection("vehicles").doc(data.vehicleId);
  const vehicleSnap = await vehicleRef.get();
  if (!vehicleSnap.exists) {
    return NextResponse.json({ error: "VEHICLE_NOT_FOUND" }, { status: 404 });
  }
  const vehicle = vehicleSnap.data() as Vehicle;
  if (vehicle.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const attachments = data.attachments ?? [];
  for (const att of attachments) {
    if (
      !att.storagePath.startsWith(`vehicles/${uid}/${data.vehicleId}/`) &&
      !att.storagePath.startsWith("imgbb:") &&
      !att.storagePath.startsWith("uploads/") &&
      !att.storagePath.startsWith("public/uploads/") &&
      !att.storagePath.startsWith("http://") &&
      !att.storagePath.startsWith("https://") &&
      !att.storagePath.startsWith("data:")
    ) {
      return NextResponse.json(
        { error: "FORBIDDEN_STORAGE_PATH" },
        { status: 403 }
      );
    }
  }

  const docRef = admin.adminDb.collection("diaryEntries").doc();
  const nowIso = new Date().toISOString();

  const entry: DiaryEntry = {
    id: docRef.id,
    ownerId: uid,
    vehicleId: data.vehicleId,
    garageId: null,
    garageName: null,
    workOrderId: null,
    category: data.category,
    title: data.title,
    notes: data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    date: data.date,
    mileageKm: data.mileageKm,
    costAmount: Number(data.costAmount.toFixed(2)),
    currency: data.currency,
    attachmentUrls: attachments.map((a) => a.url),
    attachments,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(entry);

  // Automatically advance the vehicle's current odometer if this entry is higher
  let updatedMileageKm = vehicle.currentMileageKm;
  if (data.mileageKm > vehicle.currentMileageKm) {
    updatedMileageKm = data.mileageKm;
    await vehicleRef.update({
      currentMileageKm: data.mileageKm,
      updatedAt: nowIso,
    });
  }

  return NextResponse.json(
    { entry, vehicleMileageKm: updatedMileageKm },
    { status: 201 }
  );
}

