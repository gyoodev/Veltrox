import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import { resolveAdminApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { dispatchMultiChannelNotification } from "@/lib/notifications/dispatcher";
import { buildGarageDecisionTemplate } from "@/lib/notifications/templates";
import { garageDecisionSchema } from "@/lib/validators/admin";
import type { UserProfile } from "@/types/domain";

export async function POST(
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
  const parsed = garageDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userRef = admin.adminDb.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const targetUser = userSnap.data() as UserProfile;
  if (targetUser.role !== "GARAGE_OWNER") {
    return NextResponse.json(
      { error: "TARGET_NOT_GARAGE_OWNER" },
      { status: 400 }
    );
  }

  const { decision, reason } = parsed.data;
  const cleanReason =
    decision === "rejected" ? (reason?.trim() ?? "Rejected") : null;
  const nowIso = new Date().toISOString();

  await userRef.update({
    garageStatus: decision,
    garageRejectionReason: cleanReason,
    updatedAt: nowIso,
  });

  let resolvedGarageId = targetUser.garageId ?? null;

  if (resolvedGarageId) {
    const garageRef = admin.adminDb
      .collection("garages")
      .doc(resolvedGarageId);
    const garageSnap = await garageRef.get();
    if (garageSnap.exists) {
      await garageRef.update({
        status: decision,
        updatedAt: nowIso,
      });
    }
  } else {
    const gQuery = await admin.adminDb
      .collection("garages")
      .where("ownerUid", "==", userId)
      .limit(1)
      .get();
    if (!gQuery.empty && gQuery.docs[0]) {
      const gDoc = gQuery.docs[0];
      resolvedGarageId = gDoc.id;
      await gDoc.ref.update({
        status: decision,
        updatedAt: nowIso,
      });
      await userRef.update({
        garageId: resolvedGarageId,
      });
    }
  }

  try {
    const fbUser = await admin.adminAuth.getUser(userId);
    await admin.adminAuth.setCustomUserClaims(userId, {
      ...(fbUser.customClaims ?? {}),
      role: "GARAGE_OWNER",
      garageStatus: decision,
      ...(resolvedGarageId ? { garageId: resolvedGarageId } : {}),
    });
  } catch {
    // User may not exist in Auth if created solely in test fixtures
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const locale = targetUser.language ?? "bg";
  const content = buildGarageDecisionTemplate({
    locale,
    recipientName: targetUser.displayName,
    decision,
    reason: cleanReason,
    actionUrl:
      decision === "approved" ? `${appUrl}/garage` : `${appUrl}/garage/pending`,
  });

  await dispatchMultiChannelNotification({
    ownerId: userId,
    garageId: targetUser.garageId ?? null,
    deliveryKey: `garage-decision:${userId}:${decision}:${nowIso.slice(0, 16)}`,
    channels: ["email"],
    createInAppRecord: true,
    consumeGarageQuota: false,
    payload: {
      toEmail: targetUser.email,
      toPhone: targetUser.phone,
      recipientName: targetUser.displayName,
      locale,
      subject: content.subject,
      textBody: content.textBody,
      htmlBody: content.htmlBody,
      actionUrl: decision === "approved" ? "/garage" : "/garage/pending",
    },
  });

  await admin.adminDb.collection("auditLogs").add({
    action: decision === "approved" ? "GARAGE_APPROVED" : "GARAGE_REJECTED",
    actorUid: auth.session.uid,
    actorRole: "ADMIN",
    targetUid: userId,
    targetGarageId: targetUser.garageId ?? null,
    metadata: {
      email: targetUser.email,
      reason: cleanReason,
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    ok: true,
    userId,
    garageStatus: decision,
    garageRejectionReason: cleanReason,
  });
}

