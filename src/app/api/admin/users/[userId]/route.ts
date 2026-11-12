import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import { resolveAdminApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { adminUserUpdateSchema } from "@/lib/validators/admin";
import type { GarageApprovalStatus, UserProfile } from "@/types/domain";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const auth = await resolveAdminApiAuth();
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

  const { userId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  if (userId === auth.session.uid) {
    if (updates.suspended === true) {
      return NextResponse.json(
        { error: "CANNOT_SUSPEND_SELF" },
        { status: 400 }
      );
    }
    if (updates.role && updates.role !== "ADMIN") {
      return NextResponse.json(
        { error: "CANNOT_DEMOTE_SELF" },
        { status: 400 }
      );
    }
  }

  const userRef = admin.adminDb.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const targetUser = userSnap.data() as UserProfile;
  const nowIso = new Date().toISOString();

  let nextRole = targetUser.role;
  let nextGarageStatus: GarageApprovalStatus = targetUser.garageStatus;
  let nextSuspended = targetUser.suspended;

  const firestorePatch: Record<string, unknown> = {
    updatedAt: nowIso,
  };

  if (updates.suspended !== undefined && updates.suspended !== targetUser.suspended) {
    nextSuspended = updates.suspended;
    firestorePatch.suspended = nextSuspended;

    if (targetUser.garageId && !targetUser.isStaff) {
      const garageRef = admin.adminDb
        .collection("garages")
        .doc(targetUser.garageId);
      const gSnap = await garageRef.get();
      if (gSnap.exists) {
        await garageRef.update({
          status: nextSuspended
            ? "suspended"
            : targetUser.garageStatus === "approved"
              ? "approved"
              : "pending",
          updatedAt: nowIso,
        });
      }
    }

    try {
      await admin.adminAuth.updateUser(userId, { disabled: nextSuspended });
      if (nextSuspended) {
        await admin.adminAuth.revokeRefreshTokens(userId);
      }
    } catch {
      // Ignore if test account without Firebase Auth record
    }

    await admin.adminDb.collection("auditLogs").add({
      action: nextSuspended ? "USER_SUSPENDED" : "USER_UNSUSPENDED",
      actorUid: auth.session.uid,
      actorRole: "ADMIN",
      targetUid: userId,
      targetGarageId: targetUser.garageId ?? null,
      metadata: {
        email: targetUser.email,
      },
      createdAt: nowIso,
      serverTimestamp: FieldValue.serverTimestamp(),
    });
  }

  if (updates.role && updates.role !== targetUser.role) {
    nextRole = updates.role;
    nextGarageStatus =
      nextRole === "GARAGE_OWNER"
        ? targetUser.garageStatus === "approved"
          ? "approved"
          : "pending"
        : "none";

    firestorePatch.role = nextRole;
    firestorePatch.garageStatus = nextGarageStatus;

    try {
      const fbUser = await admin.adminAuth.getUser(userId);
      await admin.adminAuth.setCustomUserClaims(userId, {
        ...(fbUser.customClaims ?? {}),
        role: nextRole,
        garageStatus: nextGarageStatus,
      });
    } catch {
      // Ignore if test account
    }

    await admin.adminDb.collection("auditLogs").add({
      action:
        nextRole === "ADMIN"
          ? "USER_ROLE_PROMOTED_TO_ADMIN"
          : "USER_ROLE_CHANGED",
      actorUid: auth.session.uid,
      actorRole: "ADMIN",
      targetUid: userId,
      targetGarageId: targetUser.garageId ?? null,
      metadata: {
        previousRole: targetUser.role,
        newRole: nextRole,
        email: targetUser.email,
      },
      createdAt: nowIso,
      serverTimestamp: FieldValue.serverTimestamp(),
    });
  }

  if (updates.garagePlan && targetUser.garageId) {
    const newQuota = updates.garagePlan === "pro" ? 500 : 50;
    const garageRef = admin.adminDb
      .collection("garages")
      .doc(targetUser.garageId);
    const garageSnap = await garageRef.get();
    if (garageSnap.exists) {
      await garageRef.update({
        plan: updates.garagePlan,
        monthlyReminderQuota: newQuota,
        updatedAt: nowIso,
      });

      await admin.adminDb.collection("auditLogs").add({
        action: "GARAGE_PLAN_UPDATED",
        actorUid: auth.session.uid,
        actorRole: "ADMIN",
        targetUid: userId,
        targetGarageId: targetUser.garageId,
        metadata: {
          plan: updates.garagePlan,
          monthlyReminderQuota: newQuota,
        },
        createdAt: nowIso,
        serverTimestamp: FieldValue.serverTimestamp(),
      });
    }
  }

  if (updates.userPlan) {
    const previousPlan = targetUser.plan ?? "free";
    firestorePatch.plan = updates.userPlan;

    if (updates.userPlan !== previousPlan) {
      await admin.adminDb.collection("auditLogs").add({
        action: "USER_PLAN_UPDATED",
        actorUid: auth.session.uid,
        actorRole: "ADMIN",
        targetUid: userId,
        targetGarageId: null,
        metadata: {
          previousPlan,
          newPlan: updates.userPlan,
          email: targetUser.email,
        },
        createdAt: nowIso,
        serverTimestamp: FieldValue.serverTimestamp(),
      });
    }
  }

  await userRef.update(firestorePatch);

  return NextResponse.json({
    ok: true,
    userId,
    role: nextRole,
    garageStatus: nextGarageStatus,
    suspended: nextSuspended,
    garagePlan: updates.garagePlan,
    userPlan: updates.userPlan ?? targetUser.plan ?? "free",
  });
}

