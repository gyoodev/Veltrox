import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { vehiclePatchSchema } from "@/lib/validators/car-diary";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import type { Vehicle } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ vehicleId: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
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

  const { vehicleId } = await context.params;
  const uid = ctx.session.uid;

  const vehicleRef = admin.adminDb.collection("vehicles").doc(vehicleId);
  const snap = await vehicleRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Vehicle;
  if (existing.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = vehiclePatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (
    data.photoStoragePath &&
    !data.photoStoragePath.startsWith(`vehicles/${uid}/`)
  ) {
    return NextResponse.json(
      { error: "FORBIDDEN_STORAGE_PATH" },
      { status: 403 }
    );
  }

  // Delete superseded vehicle photo from Storage when replaced/removed
  if (
    data.photoStoragePath !== undefined &&
    existing.photoStoragePath &&
    existing.photoStoragePath !== data.photoStoragePath &&
    existing.photoStoragePath.startsWith(`vehicles/${uid}/`)
  ) {
    try {
      await admin.adminStorage
        .bucket()
        .file(existing.photoStoragePath)
        .delete({ ignoreNotFound: true });
    } catch {
      // Non-fatal storage cleanup
    }
  }

  let nextPending = existing.pendingGarageLinks ?? [];
  let nextLinkedIds = existing.linkedGarageIds ?? [];
  const nextLinkedNames: Record<string, string> = {
    ...(existing.linkedGarageNames ?? {}),
  };

  if (data.garageLinkDecision) {
    const { garageId, decision } = data.garageLinkDecision;
    const match = nextPending.find((item) => item.garageId === garageId);
    nextPending = nextPending.filter((item) => item.garageId !== garageId);
    if (decision === "accept") {
      if (!nextLinkedIds.includes(garageId)) {
        nextLinkedIds = [...nextLinkedIds, garageId];
      }
      if (match?.garageName) {
        nextLinkedNames[garageId] = match.garageName;
      }
    }
  }

  const nowIso = new Date().toISOString();
  const updated: Vehicle = {
    ...existing,
    id: vehicleId,
    make: data.make ?? existing.make,
    model: data.model ?? existing.model,
    year: data.year ?? existing.year,
    plateNumber: data.plateNumber
      ? data.plateNumber.toUpperCase()
      : existing.plateNumber,
    plateNormalized: data.plateNumber
      ? normalizeLicensePlate(data.plateNumber)
      : existing.plateNormalized,
    vin:
      data.vin !== undefined
        ? data.vin && data.vin.trim().length > 0
          ? data.vin.trim().toUpperCase()
          : null
        : existing.vin,
    fuelType: data.fuelType ?? existing.fuelType,
    currentMileageKm: data.currentMileageKm ?? existing.currentMileageKm,
    photoUrl: data.photoUrl !== undefined ? data.photoUrl : existing.photoUrl,
    photoStoragePath:
      data.photoStoragePath !== undefined
        ? data.photoStoragePath
        : existing.photoStoragePath,
    linkedGarageIds: nextLinkedIds,
    linkedGarageNames: nextLinkedNames,
    pendingGarageLinks: nextPending,
    updatedAt: nowIso,
  };

  await vehicleRef.set(updated);

  return NextResponse.json({ vehicle: updated });
}

export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
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

  const { vehicleId } = await context.params;
  const uid = ctx.session.uid;

  const vehicleRef = admin.adminDb.collection("vehicles").doc(vehicleId);
  const snap = await vehicleRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Vehicle;
  if (existing.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Cascade delete related diaryEntries, reminders, and documents owned by this user
  const relatedCollections = ["diaryEntries", "reminders", "documents"] as const;
  for (const col of relatedCollections) {
    const colSnap = await admin.adminDb
      .collection(col)
      .where("ownerId", "==", uid)
      .get();
    const matchingDocs = colSnap.docs.filter(
      (d) => d.data().vehicleId === vehicleId
    );
    if (matchingDocs.length > 0) {
      const batch = admin.adminDb.batch();
      for (const d of matchingDocs) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }

  // Purge Firebase Storage folder & cover photo for this vehicle
  try {
    const bucket = admin.adminStorage.bucket();
    if (
      existing.photoStoragePath &&
      existing.photoStoragePath.startsWith(`vehicles/${uid}/`)
    ) {
      await bucket
        .file(existing.photoStoragePath)
        .delete({ ignoreNotFound: true });
    }
    await bucket.deleteFiles({
      prefix: `vehicles/${uid}/${vehicleId}/`,
      force: true,
    });
  } catch {
    // Non-fatal if bucket has no files
  }

  await vehicleRef.delete();

  return NextResponse.json({ deleted: true });
}
