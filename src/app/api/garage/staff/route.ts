import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { staffInviteSchema } from "@/lib/validators/garage";
import type { GarageStaff, UserProfile } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
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

  const snap = await admin.adminDb
    .collection("garageStaff")
    .where("garageId", "==", auth.garage.id)
    .get();

  const staff = snap.docs
    .map((d) => ({ ...(d.data() as GarageStaff), id: d.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ staff });
}

export async function POST(request: Request): Promise<NextResponse> {
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = staffInviteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const emailLower = data.email.trim().toLowerCase();
  const garageId = auth.garage.id;

  // Never overwrite an existing account
  try {
    await admin.adminAuth.getUserByEmail(emailLower);
    return NextResponse.json(
      { error: "EMAIL_ALREADY_IN_USE" },
      { status: 409 }
    );
  } catch {
    // Expected when email does not exist yet
  }

  const createdUser = await admin.adminAuth.createUser({
    email: emailLower,
    password: data.password,
    displayName: data.displayName.trim(),
    emailVerified: true,
  });

  const staffUid = createdUser.uid;
  const nowIso = new Date().toISOString();

  await admin.adminAuth.setCustomUserClaims(staffUid, {
    role: "GARAGE_OWNER",
    garageStatus: "approved",
    garageId,
    isStaff: true,
    staffRole: data.staffRole,
  });

  const staffProfile: UserProfile = {
    uid: staffUid,
    email: emailLower,
    emailVerified: true,
    displayName: data.displayName.trim(),
    phone: null,
    avatarUrl: null,
    avatarStoragePath: null,
    role: "GARAGE_OWNER",
    garageStatus: "approved",
    garageRejectionReason: null,
    garageId,
    isStaff: true,
    staffRole: data.staffRole,
    language: auth.profile.language,
    notificationPreferences: {
      emailReminders: true,
      serviceUpdates: true,
      documentExpiryAlerts: false,
      marketingEmails: false,
      preferredChannel: "email",
    },
    suspended: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await admin.adminDb.collection("users").doc(staffUid).set(staffProfile);

  const staffDocId = `${garageId}_${staffUid}`;
  const staffMember: GarageStaff = {
    id: staffDocId,
    garageId,
    uid: staffUid,
    email: emailLower,
    displayName: data.displayName.trim(),
    staffRole: data.staffRole,
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await admin.adminDb
    .collection("garageStaff")
    .doc(staffDocId)
    .set(staffMember);

  await admin.adminDb.collection("auditLogs").add({
    action: "GARAGE_STAFF_ADDED",
    actorUid: auth.session.uid,
    actorRole: "GARAGE_OWNER",
    targetUid: staffUid,
    targetGarageId: garageId,
    metadata: {
      staffRole: data.staffRole,
      email: emailLower,
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ staffMember }, { status: 201 });
}

