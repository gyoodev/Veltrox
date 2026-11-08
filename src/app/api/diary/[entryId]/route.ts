import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { diaryEntryFormSchema } from "@/lib/validators/car-diary";
import type { DiaryEntry, Vehicle } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ entryId: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
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

  const { entryId } = await context.params;
  const uid = ctx.session.uid;

  const entryRef = admin.adminDb.collection("diaryEntries").doc(entryId);
  const snap = await entryRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as DiaryEntry;
  if (existing.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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
  const attachments = data.attachments ?? existing.attachments ?? [];

  for (const att of attachments) {
    if (!att.storagePath.startsWith(`vehicles/${uid}/`)) {
      return NextResponse.json(
        { error: "FORBIDDEN_STORAGE_PATH" },
        { status: 403 }
      );
    }
  }

  // Delete removed attachments from Storage
  const nextPaths = new Set(attachments.map((a) => a.storagePath));
  for (const prevAtt of existing.attachments ?? []) {
    if (
      !nextPaths.has(prevAtt.storagePath) &&
      prevAtt.storagePath.startsWith(`vehicles/${uid}/`)
    ) {
      try {
        await admin.adminStorage
          .bucket()
          .file(prevAtt.storagePath)
          .delete({ ignoreNotFound: true });
      } catch {
        // Non-fatal
      }
    }
  }

  const nowIso = new Date().toISOString();
  const updated: DiaryEntry = {
    ...existing,
    id: entryId,
    category: data.category,
    title: data.title,
    date: data.date,
    mileageKm: data.mileageKm,
    costAmount: Number(data.costAmount.toFixed(2)),
    currency: data.currency,
    notes: data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    attachmentUrls: attachments.map((a) => a.url),
    attachments,
    updatedAt: nowIso,
  };

  await entryRef.set(updated);

  // Sync odometer upwards if needed
  const vehicleRef = admin.adminDb.collection("vehicles").doc(existing.vehicleId);
  const vehicleSnap = await vehicleRef.get();
  if (vehicleSnap.exists) {
    const vehicle = vehicleSnap.data() as Vehicle;
    if (vehicle.ownerId === uid && data.mileageKm > vehicle.currentMileageKm) {
      await vehicleRef.update({
        currentMileageKm: data.mileageKm,
        updatedAt: nowIso,
      });
    }
  }

  return NextResponse.json({ entry: updated });
}

export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
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

  const { entryId } = await context.params;
  const uid = ctx.session.uid;

  const entryRef = admin.adminDb.collection("diaryEntries").doc(entryId);
  const snap = await entryRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as DiaryEntry;
  if (existing.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  for (const att of existing.attachments ?? []) {
    if (att.storagePath.startsWith(`vehicles/${uid}/`)) {
      try {
        await admin.adminStorage
          .bucket()
          .file(att.storagePath)
          .delete({ ignoreNotFound: true });
      } catch {
        // Non-fatal
      }
    }
  }

  await entryRef.delete();

  return NextResponse.json({ deleted: true });
}

