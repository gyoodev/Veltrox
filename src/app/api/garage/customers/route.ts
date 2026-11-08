import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { customerFormSchema } from "@/lib/validators/garage";
import type { Customer, Vehicle } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
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

  const snap = await admin.adminDb
    .collection("customers")
    .where("garageId", "==", auth.garage.id)
    .get();

  const customers = snap.docs
    .map((d) => ({ ...(d.data() as Customer), id: d.id }))
    .sort((a, b) =>
      (b.lastVisitAt ?? b.createdAt).localeCompare(a.lastVisitAt ?? a.createdAt)
    );

  return NextResponse.json({ customers });
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = customerFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const upperPlates = Array.from(
    new Set(data.plateNumbers.map((p) => p.trim().toUpperCase()))
  );
  const platesNormalized = upperPlates.map((p) => normalizeLicensePlate(p));

  // Optional automatic match to registered car owner if primary plate exists
  let linkedOwnerId: string | null = null;
  if (platesNormalized[0]) {
    const vehSnap = await admin.adminDb
      .collection("vehicles")
      .where("plateNormalized", "==", platesNormalized[0])
      .limit(1)
      .get();
    const firstVeh = vehSnap.docs[0];
    if (firstVeh) {
      linkedOwnerId = (firstVeh.data() as Vehicle).ownerId;
    }
  }

  const docRef = admin.adminDb.collection("customers").doc();
  const nowIso = new Date().toISOString();

  const customer: Customer = {
    id: docRef.id,
    garageId: auth.garage.id,
    linkedOwnerId,
    fullName: data.fullName.trim(),
    phone: data.phone.trim(),
    email:
      data.email && data.email.trim().length > 0 ? data.email.trim() : null,
    plateNumbers: upperPlates,
    platesNormalized,
    notes:
      data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null,
    lastVisitAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(customer);

  return NextResponse.json({ customer }, { status: 201 });
}

