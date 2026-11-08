import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { serializeCsv } from "@/lib/garage-utils";
import type { Customer, WorkOrder } from "@/types/domain";

export const runtime = "nodejs";

/**
 * GET /api/garage/export?type=customers|work-orders
 * Manager-only CSV export with UTF-8 BOM + spreadsheet formula-injection guard.
 */
export async function GET(request: Request): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const exportType = searchParams.get("type") ?? "work-orders";
  const garageId = auth.garage.id;

  if (exportType === "customers") {
    const snap = await admin.adminDb
      .collection("customers")
      .where("garageId", "==", garageId)
      .get();
    const customers = snap.docs
      .map((d) => ({ ...(d.data() as Customer), id: d.id }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const csv = serializeCsv(
      [
        "ID",
        "Full Name",
        "Phone",
        "Email",
        "License Plates",
        "Last Visit",
        "Notes",
        "Created At",
      ],
      customers.map((c) => [
        c.id,
        c.fullName,
        c.phone,
        c.email ?? "",
        c.plateNumbers.join("; "),
        c.lastVisitAt ?? "",
        c.notes ?? "",
        c.createdAt,
      ])
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="veltrox-customers-${auth.garage.slug}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const woSnap = await admin.adminDb
    .collection("workOrders")
    .where("garageId", "==", garageId)
    .get();
  const workOrders = woSnap.docs
    .map((d) => ({ ...(d.data() as WorkOrder), id: d.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const csv = serializeCsv(
    [
      "ID",
      "Created At",
      "Status",
      "License Plate",
      "Vehicle",
      "Mileage Km",
      "Customer Name",
      "Customer Phone",
      "Summary",
      "Labor",
      "Parts",
      "Total",
      "Currency",
      "Next Service Date",
      "Next Service Km",
    ],
    workOrders.map((wo) => [
      wo.id,
      wo.createdAt,
      wo.status,
      wo.plateNumber,
      wo.vehicleLabel,
      wo.mileageKm ?? "",
      wo.customerName ?? "",
      wo.customerPhone ?? "",
      wo.customerSummary ?? "",
      wo.totalLaborAmount.toFixed(2),
      wo.totalPartsAmount.toFixed(2),
      wo.totalAmount.toFixed(2),
      wo.currency,
      wo.nextServiceDate ?? "",
      wo.nextServiceMileageKm ?? "",
    ])
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="veltrox-work-orders-${auth.garage.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

