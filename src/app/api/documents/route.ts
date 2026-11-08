import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { documentFormSchema } from "@/lib/validators/car-diary";
import type { Vehicle, VehicleDocument } from "@/types/domain";

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
    .collection("documents")
    .where("ownerId", "==", ctx.session.uid)
    .get();

  const documents = snap.docs
    .map((d) => ({ ...(d.data() as VehicleDocument), id: d.id }))
    .filter((d) => (!vehicleIdFilter ? true : d.vehicleId === vehicleIdFilter))
    .sort((a, b) =>
      (a.expiryDate ?? "9999-12-31").localeCompare(b.expiryDate ?? "9999-12-31")
    );

  return NextResponse.json({ documents });
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

  const parsed = documentFormSchema.safeParse(rawBody);
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

  if (!data.storagePath.startsWith(`vehicles/${uid}/${data.vehicleId}/`)) {
    return NextResponse.json(
      { error: "FORBIDDEN_STORAGE_PATH" },
      { status: 403 }
    );
  }

  const docRef = admin.adminDb.collection("documents").doc();
  const nowIso = new Date().toISOString();

  const docRecord: VehicleDocument = {
    id: docRef.id,
    ownerId: uid,
    vehicleId: data.vehicleId,
    docType: data.docType,
    title: data.title,
    fileName: data.fileName,
    contentType: data.contentType,
    fileUrl: data.fileUrl,
    storagePath: data.storagePath,
    expiryDate:
      data.expiryDate && data.expiryDate.length > 0 ? data.expiryDate : null,
    notes: data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(docRecord);

  return NextResponse.json({ document: docRecord }, { status: 201 });
}

