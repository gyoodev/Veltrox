import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import {
  syncCompletedWorkOrderToCarDiary,
  syncPublicWorkOrderProjection,
} from "@/lib/data/garage";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { workOrderItemFormSchema } from "@/lib/validators/garage";
import type { WorkOrder, WorkOrderItem } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

async function recalculateWorkOrderTotals(
  garageId: string,
  workOrderId: string
): Promise<{
  workOrder: WorkOrder;
  items: WorkOrderItem[];
} | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  const woRef = admin.adminDb.collection("workOrders").doc(workOrderId);
  const woSnap = await woRef.get();
  if (!woSnap.exists) return null;

  const wo = woSnap.data() as WorkOrder;
  if (wo.garageId !== garageId) return null;

  const itemsSnap = await admin.adminDb
    .collection("workOrderItems")
    .where("workOrderId", "==", workOrderId)
    .get();

  const items = itemsSnap.docs
    .map((d) => ({ ...(d.data() as WorkOrderItem), id: d.id }))
    .filter((i) => i.garageId === garageId)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

  let totalLabor = 0;
  let totalParts = 0;
  for (const item of items) {
    if (item.type === "labor") totalLabor += item.totalPrice;
    else totalParts += item.totalPrice;
  }

  const updated: WorkOrder = {
    ...wo,
    id: workOrderId,
    totalLaborAmount: Number(totalLabor.toFixed(2)),
    totalPartsAmount: Number(totalParts.toFixed(2)),
    totalAmount: Number((totalLabor + totalParts).toFixed(2)),
    updatedAt: new Date().toISOString(),
  };

  await woRef.set(updated);

  return { workOrder: updated, items };
}

export async function POST(
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

  const woSnap = await admin.adminDb
    .collection("workOrders")
    .doc(workOrderId)
    .get();
  if (!woSnap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const wo = woSnap.data() as WorkOrder;
  if (wo.garageId !== garageId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = workOrderItemFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const itemRef = admin.adminDb.collection("workOrderItems").doc();
  const totalPrice = Number((data.quantity * data.unitPrice).toFixed(2));

  const item: WorkOrderItem = {
    id: itemRef.id,
    garageId,
    workOrderId,
    linkedOwnerId: wo.linkedOwnerId,
    type: data.type,
    description: data.description.trim(),
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    totalPrice,
    createdAt: new Date().toISOString(),
  };

  await itemRef.set(item);

  const recalculated = await recalculateWorkOrderTotals(garageId, workOrderId);
  if (!recalculated) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await syncPublicWorkOrderProjection(
    auth.garage,
    recalculated.workOrder,
    recalculated.items
  );

  if (recalculated.workOrder.status === "completed") {
    await syncCompletedWorkOrderToCarDiary(
      auth.garage,
      recalculated.workOrder,
      recalculated.items
    );
  }

  return NextResponse.json(
    {
      item,
      workOrder: recalculated.workOrder,
      items: recalculated.items,
    },
    { status: 201 }
  );
}

export async function DELETE(
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
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "MISSING_ITEM_ID" }, { status: 400 });
  }

  const garageId = auth.garage.id;
  const itemRef = admin.adminDb.collection("workOrderItems").doc(itemId);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = itemSnap.data() as WorkOrderItem;
  if (existing.garageId !== garageId || existing.workOrderId !== workOrderId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await itemRef.delete();

  const recalculated = await recalculateWorkOrderTotals(garageId, workOrderId);
  if (!recalculated) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await syncPublicWorkOrderProjection(
    auth.garage,
    recalculated.workOrder,
    recalculated.items
  );

  if (recalculated.workOrder.status === "completed") {
    await syncCompletedWorkOrderToCarDiary(
      auth.garage,
      recalculated.workOrder,
      recalculated.items
    );
  }

  return NextResponse.json({
    deleted: true,
    workOrder: recalculated.workOrder,
    items: recalculated.items,
  });
}

