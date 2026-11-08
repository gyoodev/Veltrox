import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AppNotification } from "@/types/domain";

const markReadSchema = z.object({
  notificationId: z.string().min(1).max(128).optional(),
  markAll: z.boolean().optional(),
});

/**
 * GET /api/notifications — Returns recent in-app notifications scoped strictly
 * to the caller's `uid` (or `garageId` for approved garage members).
 */
export async function GET(): Promise<NextResponse> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const byId = new Map<string, AppNotification>();

  const ownerSnap = await admin.adminDb
    .collection("notifications")
    .where("ownerId", "==", ctx.session.uid)
    .get();

  for (const d of ownerSnap.docs) {
    const item = { ...(d.data() as AppNotification), id: d.id };
    if (item.channel === "in_app") {
      byId.set(item.id, item);
    }
  }

  if (
    ctx.profile.role === "GARAGE_OWNER" &&
    ctx.profile.garageStatus === "approved" &&
    ctx.profile.garageId
  ) {
    const garageSnap = await admin.adminDb
      .collection("notifications")
      .where("garageId", "==", ctx.profile.garageId)
      .get();

    for (const d of garageSnap.docs) {
      const item = { ...(d.data() as AppNotification), id: d.id };
      if (item.channel === "in_app") {
        byId.set(item.id, item);
      }
    }
  }

  const notifications = Array.from(byId.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);

  const unreadCount = notifications.filter(
    (n) => n.status !== "read" && !n.readAt
  ).length;

  return NextResponse.json({ notifications, unreadCount });
}

/**
 * PATCH /api/notifications — Marks a single notification or all unread notifications as read.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = markReadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const canAccess = (n: AppNotification): boolean => {
    if (n.ownerId && n.ownerId === ctx.session.uid) return true;
    if (
      n.garageId &&
      ctx.profile.role === "GARAGE_OWNER" &&
      ctx.profile.garageStatus === "approved" &&
      ctx.profile.garageId === n.garageId
    ) {
      return true;
    }
    return false;
  };

  if (parsed.data.notificationId) {
    const ref = admin.adminDb
      .collection("notifications")
      .doc(parsed.data.notificationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const data = { ...(snap.data() as AppNotification), id: snap.id };
    if (!canAccess(data)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    await ref.update({
      status: "read",
      readAt: nowIso,
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.markAll) {
    const batch = admin.adminDb.batch();
    let updated = 0;

    const ownerSnap = await admin.adminDb
      .collection("notifications")
      .where("ownerId", "==", ctx.session.uid)
      .get();

    for (const d of ownerSnap.docs) {
      const n = d.data() as AppNotification;
      if (n.channel === "in_app" && !n.readAt) {
        batch.update(d.ref, { status: "read", readAt: nowIso });
        updated += 1;
      }
    }

    if (
      ctx.profile.role === "GARAGE_OWNER" &&
      ctx.profile.garageStatus === "approved" &&
      ctx.profile.garageId
    ) {
      const garageSnap = await admin.adminDb
        .collection("notifications")
        .where("garageId", "==", ctx.profile.garageId)
        .get();
      for (const d of garageSnap.docs) {
        const n = d.data() as AppNotification;
        if (n.channel === "in_app" && !n.readAt) {
          batch.update(d.ref, { status: "read", readAt: nowIso });
          updated += 1;
        }
      }
    }

    if (updated > 0) {
      await batch.commit();
    }
    return NextResponse.json({ ok: true, updated });
  }

  return NextResponse.json({ ok: true });
}

