import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { vehicleFormSchema } from "@/lib/validators/car-diary";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import type { Vehicle } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
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

  const snap = await admin.adminDb
    .collection("vehicles")
    .where("ownerId", "==", ctx.session.uid)
    .get();

  const vehicles = snap.docs
    .map((d) => ({ ...(d.data() as Vehicle), id: d.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ vehicles });
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

  const parsed = vehicleFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const uid = ctx.session.uid;

  if (
    data.photoStoragePath &&
    !data.photoStoragePath.startsWith(`vehicles/${uid}/`) &&
    !data.photoStoragePath.startsWith("imgbb:") &&
    !data.photoStoragePath.startsWith("public/uploads/") &&
    !data.photoStoragePath.startsWith("http://") &&
    !data.photoStoragePath.startsWith("https://")
  ) {
    return NextResponse.json(
      { error: "FORBIDDEN_STORAGE_PATH" },
      { status: 403 }
    );
  }

  const docRef = admin.adminDb.collection("vehicles").doc();
  const nowIso = new Date().toISOString();
  const cleanVin =
    data.vin && data.vin.trim().length > 0
      ? data.vin.trim().toUpperCase()
      : null;

  const vehicle: Vehicle = {
    id: docRef.id,
    ownerId: uid,
    make: data.make,
    model: data.model,
    year: data.year,
    plateNumber: data.plateNumber.toUpperCase(),
    plateNormalized: normalizeLicensePlate(data.plateNumber),
    vin: cleanVin,
    fuelType: data.fuelType,
    currentMileageKm: data.currentMileageKm,
    photoUrl: data.photoUrl ?? null,
    photoStoragePath: data.photoStoragePath ?? null,
    linkedGarageIds: [],
    linkedGarageNames: {},
    pendingGarageLinks: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(vehicle);

  return NextResponse.json({ vehicle }, { status: 201 });
}

