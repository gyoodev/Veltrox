import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import {
  getWorkOrderDetail,
  syncCompletedWorkOrderToCarDiary,
  syncPublicWorkOrderProjection,
} from "@/lib/data/garage";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import { workOrderPatchSchema } from "@/lib/validators/garage";
import type { Reminder, WorkOrder, WorkOrderItem } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await resolveGarageApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { workOrderId } = await context.params;
  const detail = await getWorkOrderDetail(auth.garage.id, workOrderId);
  if (!detail) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await resolveGarageApiAuth();
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

  const { workOrderId } = await context.params;
  const garageId = auth.garage.id;

  const woRef = admin.adminDb.collection("workOrders").doc(workOrderId);
  const woSnap = await woRef.get();
  if (!woSnap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = woSnap.data() as WorkOrder;
  if (existing.garageId !== garageId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = workOrderPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Validate Storage path ownership on drop-off photos
  if (data.dropOffPhotos) {
    const invalidPhoto = data.dropOffPhotos.find(
      (p) =>
        !p.storagePath.startsWith(`garages/${garageId}/`) &&
        !p.storagePath.startsWith("imgbb:") &&
        !p.storagePath.startsWith("uploads/") &&
        !p.storagePath.startsWith("public/uploads/") &&
        !p.storagePath.startsWith("http://") &&
        !p.storagePath.startsWith("https://") &&
        !p.storagePath.startsWith("data:")
    );
    if (invalidPhoto) {
      return NextResponse.json(
        { error: "FORBIDDEN_STORAGE_PATH" },
        { status: 403 }
      );
    }
  }

  const nowIso = new Date().toISOString();
  const nextDate =
    data.nextServiceDate !== undefined
      ? data.nextServiceDate && data.nextServiceDate.trim().length > 0
        ? data.nextServiceDate.trim()
        : null
      : existing.nextServiceDate;

  const nextMileage =
    data.nextServiceMileageKm !== undefined
      ? data.nextServiceMileageKm
      : existing.nextServiceMileageKm;

  // Handle Automatic Return Reminder + Monthly Quota enforcement
  let reminderId = existing.reminderId ?? null;
  let updatedGarage = auth.garage;
  const wantsReminder = Boolean(nextDate || nextMileage);

  if (wantsReminder) {
    if (!reminderId) {
      const quotaInfo = getEffectiveReminderQuota(auth.garage);
      if (quotaInfo.remaining <= 0) {
        return NextResponse.json(
          { error: "REMINDER_QUOTA_EXCEEDED", quota: quotaInfo.quota },
          { status: 429 }
        );
      }

      const remRef = admin.adminDb.collection("reminders").doc();
      reminderId = remRef.id;

      const reminderDoc: Reminder = {
        id: remRef.id,
        ownerId: existing.linkedOwnerId,
        garageId,
        vehicleId: existing.vehicleId,
        workOrderId,
        recipientEmail: existing.customerEmail ?? null,
        recipientPhone: existing.customerPhone ?? null,
        recipientName: existing.customerName ?? null,
        plateNumber: existing.plateNumber,
        type: "oil_change",
        title: `${auth.garage.name}: ${existing.vehicleLabel} (${existing.plateNumber})`,
        notes: data.customerSummary ?? existing.customerSummary ?? null,
        dueDate: nextDate,
        dueMileageKm: nextMileage,
        channels: ["email"],
        status: "scheduled",
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await remRef.set(reminderDoc);

      const nextUsed = quotaInfo.used + 1;
      await admin.adminDb.collection("garages").doc(garageId).update({
        monthlyRemindersUsed: nextUsed,
        quotaResetMonth: quotaInfo.monthKey,
        updatedAt: nowIso,
      });
      updatedGarage = {
        ...auth.garage,
        monthlyRemindersUsed: nextUsed,
        quotaResetMonth: quotaInfo.monthKey,
      };
    } else {
      await admin.adminDb
        .collection("reminders")
        .doc(reminderId)
        .set(
          {
            dueDate: nextDate,
            dueMileageKm: nextMileage,
            updatedAt: nowIso,
          },
          { merge: true }
        );
    }
  } else if (reminderId && (data.nextServiceDate === null || data.nextServiceMileageKm === null)) {
    await admin.adminDb
      .collection("reminders")
      .doc(reminderId)
      .set({ status: "cancelled", updatedAt: nowIso }, { merge: true });
    reminderId = null;
  }

  const nextStatus = data.status ?? existing.status;
  const completedAt =
    nextStatus === "completed"
      ? existing.completedAt ?? nowIso
      : existing.completedAt ?? null;

  const nextPhotos =
    data.dropOffPhotos !== undefined
      ? data.dropOffPhotos
      : existing.dropOffPhotos ?? [];

  const updated: WorkOrder = {
    ...existing,
    id: workOrderId,
    status: nextStatus,
    vehicleLabel: data.vehicleLabel ?? existing.vehicleLabel,
    mileageKm:
      data.mileageKm !== undefined ? data.mileageKm : existing.mileageKm,
    customerSummary:
      data.customerSummary !== undefined
        ? data.customerSummary && data.customerSummary.trim().length > 0
          ? data.customerSummary.trim()
          : null
        : existing.customerSummary,
    internalNotes:
      data.internalNotes !== undefined
        ? data.internalNotes && data.internalNotes.trim().length > 0
          ? data.internalNotes.trim()
          : null
        : existing.internalNotes,
    currency: data.currency ?? existing.currency,
    dropOffPhotos: nextPhotos,
    dropOffPhotoUrls: nextPhotos.map((p) => p.url),
    nextServiceDate: nextDate,
    nextServiceMileageKm: nextMileage,
    reminderId,
    completedAt,
    updatedAt: nowIso,
  };

  const itemsSnap = await admin.adminDb
    .collection("workOrderItems")
    .where("workOrderId", "==", workOrderId)
    .get();
  const items = itemsSnap.docs
    .map((d) => ({ ...(d.data() as WorkOrderItem), id: d.id }))
    .filter((i) => i.garageId === garageId);

  if (updated.status === "completed") {
    const syncedId = await syncCompletedWorkOrderToCarDiary(
      updatedGarage,
      updated,
      items
    );
    if (syncedId) {
      updated.syncedDiaryEntryId = syncedId;
    }
  }

  await woRef.set(updated);
  await syncPublicWorkOrderProjection(updatedGarage, updated, items);

  return NextResponse.json({
    workOrder: updated,
    garage: updatedGarage,
  });
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

  const { workOrderId } = await context.params;
  const garageId = auth.garage.id;

  const woRef = admin.adminDb.collection("workOrders").doc(workOrderId);
  const woSnap = await woRef.get();
  if (!woSnap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = woSnap.data() as WorkOrder;
  if (existing.garageId !== garageId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Delete child line items
  const itemsSnap = await admin.adminDb
    .collection("workOrderItems")
    .where("workOrderId", "==", workOrderId)
    .get();
  if (!itemsSnap.empty) {
    const batch = admin.adminDb.batch();
    for (const d of itemsSnap.docs) {
      if ((d.data() as WorkOrderItem).garageId === garageId) {
        batch.delete(d.ref);
      }
    }
    await batch.commit();
  }

  // Delete public projection
  if (existing.publicStatusToken) {
    await admin.adminDb
      .collection("workOrderPublicStatus")
      .doc(existing.publicStatusToken)
      .delete();
  }

  // Clean up Storage drop-off photos
  for (const photo of existing.dropOffPhotos ?? []) {
    if (photo.storagePath.startsWith(`garages/${garageId}/`)) {
      try {
        await admin.adminStorage
          .bucket()
          .file(photo.storagePath)
          .delete({ ignoreNotFound: true });
      } catch {
        // Non-fatal
      }
    }
  }

  await woRef.delete();

  return NextResponse.json({ deleted: true });
}

