import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { customerPatchSchema } from "@/lib/validators/garage";
import type { Customer } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ customerId: string }>;
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

  const { customerId } = await context.params;
  const ref = admin.adminDb.collection("customers").doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Customer;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = customerPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nextPlates = data.plateNumbers
    ? Array.from(new Set(data.plateNumbers.map((p) => p.trim().toUpperCase())))
    : existing.plateNumbers;

  const updated: Customer = {
    ...existing,
    id: customerId,
    fullName: data.fullName ? data.fullName.trim() : existing.fullName,
    phone: data.phone ? data.phone.trim() : existing.phone,
    email:
      data.email !== undefined
        ? data.email && data.email.trim().length > 0
          ? data.email.trim()
          : null
        : existing.email,
    plateNumbers: nextPlates,
    platesNormalized: nextPlates.map((p) => normalizeLicensePlate(p)),
    notes:
      data.notes !== undefined
        ? data.notes && data.notes.trim().length > 0
          ? data.notes.trim()
          : null
        : existing.notes,
    updatedAt: new Date().toISOString(),
  };

  await ref.set(updated);

  return NextResponse.json({ customer: updated });
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

  const { customerId } = await context.params;
  const ref = admin.adminDb.collection("customers").doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = snap.data() as Customer;
  if (existing.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await ref.delete();

  return NextResponse.json({ deleted: true });
}

