import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { reminderPatchSchema } from "@/lib/validators/car-diary";
import type { Reminder } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ reminderId: string }>;
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

  const { reminderId } = await context.params;
  const uid = ctx.session.uid;

  const remRef = admin.adminDb.collection("reminders").doc(reminderId);
  const snap = await remRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Reminder;
  if (existing.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = reminderPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nowIso = new Date().toISOString();

  const nextStatus = data.status ?? existing.status;
  const updated: Reminder = {
    ...existing,
    id: reminderId,
    title: data.title ?? existing.title,
    type: data.type ?? existing.type,
    dueDate: data.dueDate !== undefined ? data.dueDate : existing.dueDate,
    dueMileageKm:
      data.dueMileageKm !== undefined ? data.dueMileageKm : existing.dueMileageKm,
    notes: data.notes !== undefined ? data.notes : (existing.notes ?? null),
    status: nextStatus,
    completedAt:
      nextStatus === "completed"
        ? (existing.completedAt ?? nowIso)
        : null,
    updatedAt: nowIso,
  };

  await remRef.set(updated);

  return NextResponse.json({ reminder: updated });
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

  const { reminderId } = await context.params;
  const uid = ctx.session.uid;

  const remRef = admin.adminDb.collection("reminders").doc(reminderId);
  const snap = await remRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Reminder;
  if (existing.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await remRef.delete();

  return NextResponse.json({ deleted: true });
}

