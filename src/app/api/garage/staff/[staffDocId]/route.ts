import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { staffPatchSchema } from "@/lib/validators/garage";
import type { GarageStaff, UserProfile } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ staffDocId: string }>;
}

export async function PATCH(
  request: Request,
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

  const { staffDocId } = await context.params;
  const ref = admin.adminDb.collection("garageStaff").doc(staffDocId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as GarageStaff;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = staffPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nowIso = new Date().toISOString();

  const updated: GarageStaff = {
    ...existing,
    id: staffDocId,
    active: data.active !== undefined ? data.active : existing.active,
    staffRole: data.staffRole ?? existing.staffRole,
    updatedAt: nowIso,
  };

  await ref.set(updated);

  // Mirror active/role state to user profile + custom claims
  await admin.adminDb
    .collection("users")
    .doc(existing.uid)
    .set(
      {
        staffRole: updated.staffRole,
        suspended: !updated.active,
        updatedAt: nowIso,
      },
      { merge: true }
    );

  await admin.adminAuth.setCustomUserClaims(existing.uid, {
    role: "GARAGE_OWNER",
    garageStatus: "approved",
    garageId: auth.garage.id,
    isStaff: true,
    staffRole: updated.staffRole,
  });

  if (!updated.active) {
    await admin.adminAuth.revokeRefreshTokens(existing.uid);
  }

  return NextResponse.json({ staffMember: updated });
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

  const { staffDocId } = await context.params;
  const ref = admin.adminDb.collection("garageStaff").doc(staffDocId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as GarageStaff;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await ref.delete();

  const userRef = admin.adminDb.collection("users").doc(existing.uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    const profile = userSnap.data() as UserProfile;
    if (profile.isStaff && profile.garageId === auth.garage.id) {
      await userRef.delete();
      try {
        await admin.adminAuth.deleteUser(existing.uid);
      } catch {
        // Ignore if already deleted in Auth
      }
    }
  }

  const nowIso = new Date().toISOString();
  await admin.adminDb.collection("auditLogs").add({
    action: "GARAGE_STAFF_REMOVED",
    actorUid: auth.session.uid,
    actorRole: "GARAGE_OWNER",
    targetUid: existing.uid,
    targetGarageId: auth.garage.id,
    metadata: {
      email: existing.email,
      staffRole: existing.staffRole,
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ deleted: true });
}

