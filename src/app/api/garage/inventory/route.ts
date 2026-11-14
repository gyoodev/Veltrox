import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getGarageInventoryParts } from "@/lib/data/inventory";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { inventoryPartFormSchema } from "@/lib/validators/inventory";
import type { InventoryPart } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const auth = await resolveGarageApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parts = await getGarageInventoryParts(auth.garage.id);
  return NextResponse.json({ parts });
}

export async function POST(request: Request): Promise<NextResponse> {
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

  const rawBody = await request.json().catch(() => null);
  const parsed = inventoryPartFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const docRef = admin.adminDb.collection("inventoryParts").doc();
  const nowIso = new Date().toISOString();

  const part: InventoryPart = {
    id: docRef.id,
    garageId: auth.garage.id,
    sku: data.sku.trim().toUpperCase(),
    name: data.name.trim(),
    brand: data.brand?.trim() || null,
    category: data.category?.trim() || null,
    supplierName: data.supplierName?.trim() || null,
    costPrice: Number(data.costPrice.toFixed(2)),
    sellPrice: Number(data.sellPrice.toFixed(2)),
    stockQty: Number(data.stockQty.toFixed(2)),
    minStockAlert: Number(data.minStockAlert.toFixed(2)),
    unit: data.unit?.trim() || "pcs",
    notes: data.notes?.trim() || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(part);
  return NextResponse.json({ part }, { status: 201 });
}

