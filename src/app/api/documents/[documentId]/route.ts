import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { VehicleDocument } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ documentId: string }>;
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

  const { documentId } = await context.params;
  const uid = ctx.session.uid;

  const docRef = admin.adminDb.collection("documents").doc(documentId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as VehicleDocument;
  if (existing.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (existing.storagePath && existing.storagePath.startsWith(`vehicles/${uid}/`)) {
    try {
      await admin.adminStorage
        .bucket()
        .file(existing.storagePath)
        .delete({ ignoreNotFound: true });
    } catch {
      // Non-fatal
    }
  }

  await docRef.delete();

  return NextResponse.json({ deleted: true });
}

