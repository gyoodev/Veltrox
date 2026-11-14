import { NextResponse } from "next/server";
import { z } from "zod";
import {
  recalculateWorkOrderTotals,
  syncPublicWorkOrderProjection,
} from "@/lib/data/garage";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { dispatchMultiChannelNotification } from "@/lib/notifications/dispatcher";
import type {
  Garage,
  WorkOrder,
  WorkOrderItem,
  WorkOrderPublicStatus,
} from "@/types/domain";

export const runtime = "nodejs";

const quoteDecisionSchema = z.object({
  decision: z.enum(["approved", "declined"]),
  comment: z.string().trim().max(500).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const { token } = await context.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = quoteDecisionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const publicSnap = await admin.adminDb
    .collection("workOrderPublicStatus")
    .doc(token)
    .get();

  if (!publicSnap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const publicData = publicSnap.data() as WorkOrderPublicStatus;
  const woRef = admin.adminDb
    .collection("workOrders")
    .doc(publicData.workOrderId);
  const woSnap = await woRef.get();
  if (!woSnap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const wo = woSnap.data() as WorkOrder;
  if (wo.publicStatusToken !== token) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (wo.quoteStatus !== "pending") {
    return NextResponse.json(
      { error: "QUOTE_NOT_PENDING", quoteStatus: wo.quoteStatus ?? "none" },
      { status: 409 }
    );
  }

  const garageSnap = await admin.adminDb
    .collection("garages")
    .doc(wo.garageId)
    .get();
  if (!garageSnap.exists) {
    return NextResponse.json({ error: "GARAGE_NOT_FOUND" }, { status: 404 });
  }
  const garage = { ...(garageSnap.data() as Garage), id: garageSnap.id };

  const nowIso = new Date().toISOString();
  const comment = parsed.data.comment?.trim() || null;
  const decision = parsed.data.decision;

  if (decision === "approved" && wo.quoteItems && wo.quoteItems.length > 0) {
    const batch = admin.adminDb.batch();
    for (const qItem of wo.quoteItems) {
      const itemRef = admin.adminDb.collection("workOrderItems").doc();
      const totalPrice = Number((qItem.quantity * qItem.unitPrice).toFixed(2));
      const newItem: WorkOrderItem = {
        id: itemRef.id,
        garageId: wo.garageId,
        workOrderId: wo.id,
        linkedOwnerId: wo.linkedOwnerId,
        type: qItem.type,
        description: qItem.description,
        quantity: qItem.quantity,
        unitPrice: qItem.unitPrice,
        totalPrice,
        createdAt: nowIso,
      };
      batch.set(itemRef, newItem);
    }
    await batch.commit();
  }

  const nextStatus =
    decision === "approved" && wo.status === "diagnosing"
      ? "in_progress"
      : wo.status;

  await woRef.update({
    quoteStatus: decision,
    quoteRespondedAt: nowIso,
    quoteCustomerComment: comment,
    status: nextStatus,
    updatedAt: nowIso,
  });

  const recalculated = await recalculateWorkOrderTotals(wo.garageId, wo.id);
  if (recalculated) {
    await syncPublicWorkOrderProjection(
      garage,
      recalculated.workOrder,
      recalculated.items
    );
  }

  await admin.adminDb.collection("auditLogs").add({
    action: "QUOTE_RESPONDED",
    actorUid: wo.linkedOwnerId ?? "CUSTOMER_TOKEN",
    actorRole: "USER",
    targetUid: garage.ownerUid,
    targetGarageId: garage.id,
    metadata: {
      workOrderId: wo.id,
      decision,
      quoteTotalAmount: wo.quoteTotalAmount ?? 0,
    },
    createdAt: nowIso,
  });

  await dispatchMultiChannelNotification({
    ownerId: garage.ownerUid,
    garageId: garage.id,
    channels: [],
    payload: {
      locale: "bg",
      subject:
        decision === "approved"
          ? `Одобрена оферта: ${wo.plateNumber}`
          : `Отказана оферта: ${wo.plateNumber}`,
      textBody:
        decision === "approved"
          ? `Клиентът одобри офертата за ${wo.vehicleLabel} (${(wo.quoteTotalAmount ?? 0).toFixed(2)} ${wo.currency}).`
          : `Клиентът отказа офертата за ${wo.vehicleLabel}.${comment ? ` Коментар: ${comment}` : ""}`,
      actionUrl: `/garage/work-orders/${wo.id}`,
    },
    consumeGarageQuota: false,
  }).catch((err) => {
    console.warn("Garage owner quote notification failed:", err);
  });

  return NextResponse.json({
    ok: true,
    quoteStatus: decision,
    quoteRespondedAt: nowIso,
    quoteCustomerComment: comment,
    workOrder: recalculated?.workOrder ?? null,
    items: recalculated?.items ?? null,
  });
}

