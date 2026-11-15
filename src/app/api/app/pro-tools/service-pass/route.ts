import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { evaluateDocumentExpiry } from "@/lib/diary-metrics";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { maskLicensePlate } from "@/lib/garage-utils";
import {
  buildProRequiredResponse,
  isDriverPro,
} from "@/lib/subscriptions/entitlements";
import type {
  DiaryEntry,
  Vehicle,
  VehicleDocument,
  VehiclePublicPass,
} from "@/types/domain";

export const runtime = "nodejs";

const servicePassSchema = z.object({
  vehicleId: z.string().min(1).max(128),
  enabled: z.boolean(),
  includeCosts: z.boolean().default(false),
});

/**
 * POST /api/app/pro-tools/service-pass
 * Generates, refreshes, or disables a public buyer verification link
 * (`vehiclePublicPass/{token}`) for a Driver Pro user's vehicle.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (ctx.profile.role !== "USER" && ctx.profile.role !== "ADMIN")) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isDriverPro(ctx.profile)) {
    return buildProRequiredResponse("/app/subscription", "driver_pro");
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = servicePassSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { vehicleId, enabled, includeCosts } = parsed.data;
  const uid = ctx.session.uid;

  const vehRef = admin.adminDb.collection("vehicles").doc(vehicleId);
  const vehSnap = await vehRef.get();
  if (!vehSnap.exists) {
    return NextResponse.json({ error: "VEHICLE_NOT_FOUND" }, { status: 404 });
  }

  const vehicle = { ...(vehSnap.data() as Vehicle), id: vehSnap.id };
  if (vehicle.ownerId !== uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const token =
    vehicle.publicPassToken && vehicle.publicPassToken.length >= 12
      ? vehicle.publicPassToken
      : crypto.randomBytes(12).toString("hex");
  const nowIso = new Date().toISOString();

  if (!enabled) {
    await Promise.all([
      vehRef.update({
        publicPassToken: token,
        publicPassEnabled: false,
        publicPassIncludeAmounts: includeCosts,
        updatedAt: nowIso,
      }),
      admin.adminDb.collection("vehiclePublicPass").doc(token).delete(),
    ]);

    return NextResponse.json({
      ok: true,
      token,
      enabled: false,
      includeCosts,
      publicPassUrl: `/verify-car/${token}`,
    });
  }

  const [entriesSnap, docsSnap] = await Promise.all([
    admin.adminDb.collection("diaryEntries").where("ownerId", "==", uid).get(),
    admin.adminDb.collection("documents").where("ownerId", "==", uid).get(),
  ]);

  const vehicleEntries = entriesSnap.docs
    .map((d) => ({ ...(d.data() as DiaryEntry), id: d.id }))
    .filter((e) => e.vehicleId === vehicleId)
    .sort((a, b) => a.date.localeCompare(b.date));

  let odometerConsistent = true;
  let lastKm = -1;
  for (const e of vehicleEntries) {
    if (typeof e.mileageKm === "number" && e.mileageKm > 0) {
      if (lastKm > 0 && e.mileageKm + 50 < lastKm) {
        odometerConsistent = false;
      }
      lastKm = Math.max(lastKm, e.mileageKm);
    }
  }

  const sortedNewest = [...vehicleEntries].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const vehicleDocs = docsSnap.docs
    .map((d) => d.data() as VehicleDocument)
    .filter((d) => d.vehicleId === vehicleId);

  const hasValidDocType = (docType: VehicleDocument["docType"]) =>
    vehicleDocs.some(
      (d) =>
        d.docType === docType &&
        evaluateDocumentExpiry(d.expiryDate).state !== "expired"
    );

  const projection: VehiclePublicPass = {
    token,
    vehicleId: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    fuelType: vehicle.fuelType,
    currentMileageKm: vehicle.currentMileageKm,
    maskedPlate: maskLicensePlate(vehicle.plateNumber),
    vinLast6:
      vehicle.vin && vehicle.vin.length >= 6 ? vehicle.vin.slice(-6) : null,
    includeCosts,
    verifiedGarageEntriesCount: sortedNewest.filter((e) =>
      Boolean(e.garageId || e.workOrderId)
    ).length,
    totalEntriesCount: sortedNewest.length,
    odometerConsistent,
    entries: sortedNewest.slice(0, 60).map((e) => ({
      id: e.id,
      date: e.date,
      category: e.category,
      title: e.title,
      mileageKm: e.mileageKm,
      garageVerified: Boolean(e.garageId || e.workOrderId),
      garageName: e.garageName ?? null,
      costAmount: includeCosts ? e.costAmount : null,
      currency: includeCosts ? e.currency : null,
    })),
    compliance: {
      validInsurance: hasValidDocType("insurance"),
      validInspection: hasValidDocType("inspection"),
      validVignette: hasValidDocType("vignette"),
    },
    updatedAt: nowIso,
  };

  await Promise.all([
    vehRef.update({
      publicPassToken: token,
      publicPassEnabled: true,
      publicPassIncludeAmounts: includeCosts,
      updatedAt: nowIso,
    }),
    admin.adminDb.collection("vehiclePublicPass").doc(token).set(projection),
  ]);

  return NextResponse.json({
    ok: true,
    token,
    enabled: true,
    includeCosts,
    publicPassUrl: `/verify-car/${token}`,
  });
}

