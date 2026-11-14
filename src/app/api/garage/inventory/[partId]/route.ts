import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { inventoryPartPatchSchema } from "@/lib/validators/inventory";
import type { InventoryPart } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ partId: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const { partId } = await context.params;
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

  const docRef = admin.adminDb.collection("inventoryParts").doc(partId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as InventoryPart;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = inventoryPartPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nextStockQty =
    typeof data.stockDelta === "number"
      ? Math.max(0, Number((existing.stockQty + data.stockDelta).toFixed(2)))
      : data.stockQty !== undefined
        ? Number(data.stockQty.toFixed(2))
        : existing.stockQty;

  const updates: Partial<InventoryPart> = {
    sku: data.sku ? data.sku.trim().toUpperCase() : existing.sku,
    name: data.name ? data.name.trim() : existing.name,
    brand: data.brand !== undefined ? data.brand?.trim() || null : existing.brand ?? null,
    category:
      data.category !== undefined
        ? data.category?.trim() || null
        : existing.category ?? null,
    supplierName:
      data.supplierName !== undefined
        ? data.supplierName?.trim() || null
        : existing.supplierName ?? null,
    costPrice:
      data.costPrice !== undefined
        ? Number(data.costPrice.toFixed(2))
        : existing.costPrice,
    sellPrice:
      data.sellPrice !== undefined
        ? Number(data.sellPrice.toFixed(2))
        : existing.sellPrice,
    stockQty: nextStockQty,
    minStockAlert:
      data.minStockAlert !== undefined
        ? Number(data.minStockAlert.toFixed(2))
        : existing.minStockAlert,
    unit: data.unit !== undefined ? data.unit.trim() : existing.unit ?? "pcs",
    notes:
      data.notes !== undefined ? data.notes?.trim() || null : existing.notes ?? null,
    updatedAt: new Date().toISOString(),
  };

  await docRef.update(updates);
  const updated: InventoryPart = { ...existing, ...updates };
  return NextResponse.json({ part: updated });
}

export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const { partId } = await context.params;
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

  const docRef = admin.adminDb.collection("inventoryParts").doc(partId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as InventoryPart;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await docRef.delete();
  return NextResponse.json({ ok: true });
}

