import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { vehicleLinkRequestSchema } from "@/lib/validators/garage";
import type { Vehicle } from "@/types/domain";

export const runtime = "nodejs";

/**
 * POST /api/garage/vehicle-link
 * Sends a permission request to a registered Car Owner's vehicle so completed
 * work orders from this garage sync automatically into the car's diary.
 */
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

  const parsed = vehicleLinkRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const norm = normalizeLicensePlate(parsed.data.plateNumber);
  const snap = await admin.adminDb
    .collection("vehicles")
    .where("plateNormalized", "==", norm)
    .limit(1)
    .get();

  const vehicleDoc = snap.docs[0];
  if (!vehicleDoc) {
    return NextResponse.json(
      { error: "VEHICLE_NOT_REGISTERED" },
      { status: 404 }
    );
  }

  const vehicle = vehicleDoc.data() as Vehicle;
  const garageId = auth.garage.id;

  if ((vehicle.linkedGarageIds ?? []).includes(garageId)) {
    return NextResponse.json({ status: "already_linked" });
  }

  const pending = vehicle.pendingGarageLinks ?? [];
  if (pending.some((p) => p.garageId === garageId)) {
    return NextResponse.json({ status: "already_pending" });
  }

  const nowIso = new Date().toISOString();
  await vehicleDoc.ref.update({
    pendingGarageLinks: [
      ...pending,
      {
        garageId,
        garageName: auth.garage.name,
        requestedAt: nowIso,
      },
    ],
    updatedAt: nowIso,
  });

  return NextResponse.json({ status: "requested" }, { status: 201 });
}

