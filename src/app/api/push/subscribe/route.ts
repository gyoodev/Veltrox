import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  getPublicVapidKey,
  isWebPushConfigured,
} from "@/lib/notifications/push-provider";
import type { PushSubscriptionRecord } from "@/types/domain";

export const runtime = "nodejs";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(6).max(256),
  }),
});

function buildSubscriptionDocId(uid: string, endpoint: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(endpoint)
    .digest("hex")
    .slice(0, 16);
  return `${uid}_${hash}`;
}

export async function GET(): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  let subscribedCount = 0;
  if (admin) {
    const snap = await admin.adminDb
      .collection("pushSubscriptions")
      .where("uid", "==", ctx.session.uid)
      .select("endpoint")
      .get();
    subscribedCount = snap.size;
  }

  return NextResponse.json({
    configured: isWebPushConfigured(),
    publicKey: getPublicVapidKey(),
    subscribedCount,
    pushEnabled:
      Boolean(ctx.profile.notificationPreferences?.pushEnabled) ||
      subscribedCount > 0,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { endpoint, keys } = parsed.data;
  const uid = ctx.session.uid;
  const docId = buildSubscriptionDocId(uid, endpoint);
  const nowIso = new Date().toISOString();

  const record: PushSubscriptionRecord = {
    id: docId,
    uid,
    endpoint,
    keys,
    userAgent: request.headers.get("user-agent")?.slice(0, 240) ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await admin.adminDb
    .collection("pushSubscriptions")
    .doc(docId)
    .set(record, { merge: true });

  await admin.adminDb.collection("users").doc(uid).set(
    {
      notificationPreferences: {
        ...ctx.profile.notificationPreferences,
        pushEnabled: true,
      },
      updatedAt: nowIso,
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, id: docId });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const uid = ctx.session.uid;
  const rawBody = (await request.json().catch(() => null)) as {
    endpoint?: string;
  } | null;
  const nowIso = new Date().toISOString();

  if (rawBody?.endpoint) {
    const docId = buildSubscriptionDocId(uid, rawBody.endpoint);
    await admin.adminDb.collection("pushSubscriptions").doc(docId).delete();
  } else {
    const snap = await admin.adminDb
      .collection("pushSubscriptions")
      .where("uid", "==", uid)
      .get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }

  const remaining = await admin.adminDb
    .collection("pushSubscriptions")
    .where("uid", "==", uid)
    .select("endpoint")
    .get();

  await admin.adminDb.collection("users").doc(uid).set(
    {
      notificationPreferences: {
        ...ctx.profile.notificationPreferences,
        pushEnabled: !remaining.empty,
      },
      updatedAt: nowIso,
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, remaining: remaining.size });
}

