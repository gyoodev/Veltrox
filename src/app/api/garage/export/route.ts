import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getGarageInventoryParts } from "@/lib/data/inventory";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { serializeCsv } from "@/lib/garage-utils";
import {
  buildProRequiredResponse,
  isGaragePro,
} from "@/lib/subscriptions/entitlements";
import {
  computeGarageCustomerSegments,
  computeGarageProfitAnalysis,
  computeGarageReorderList,
} from "@/lib/subscriptions/pro-metrics";
import type { Customer, WorkOrder, WorkOrderItem } from "@/types/domain";

export const runtime = "nodejs";

/**
 * GET /api/garage/export?type=customers|work-orders|profit-ledger|reorder-po|vip-customers
 * Manager-only CSV export with UTF-8 BOM + spreadsheet formula-injection guard.
 * Advanced Pro exports (`profit-ledger`, `reorder-po`, `vip-customers`) enforce Garage Pro.
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

  const isProExport =
    exportType === "profit-ledger" ||
    exportType === "reorder-po" ||
    exportType === "vip-customers";

  if (isProExport && !isGaragePro(auth.garage)) {
    return buildProRequiredResponse("/garage/subscription", "garage_pro");
  }

  if (exportType === "reorder-po") {
    const multiplierRaw = Number(searchParams.get("multiplier") ?? "2");
    const multiplier = Number.isFinite(multiplierRaw) ? multiplierRaw : 2;
    const parts = await getGarageInventoryParts(garageId);
    const reorderRows = computeGarageReorderList(parts, multiplier);

    const csv = serializeCsv(
      [
        "SKU",
        "Part Name",
        "Brand",
        "Supplier",
        "Current Stock",
        "Min Alert",
        "Target Stock",
        "Reorder Qty",
        "Unit",
        "Unit Cost (EUR)",
        "Est. PO Line Cost (EUR)",
        "Priority",
      ],
      reorderRows.map((row) => [
        row.part.sku,
        row.part.name,
        row.part.brand ?? "",
        row.part.supplierName ?? "",
        row.part.stockQty,
        row.part.minStockAlert,
        row.targetStock,
        row.reorderQty,
        row.part.unit ?? "pcs",
        row.part.costPrice.toFixed(2),
        row.estimatedCostEur.toFixed(2),
        row.isCritical ? "CRITICAL" : "LOW",
      ])
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="veltrox-reorder-po-${auth.garage.slug}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (exportType === "profit-ledger") {
    const [woSnap, itemsSnap, parts] = await Promise.all([
      admin.adminDb
        .collection("workOrders")
        .where("garageId", "==", garageId)
        .get(),
      admin.adminDb
        .collection("workOrderItems")
        .where("garageId", "==", garageId)
        .get(),
      getGarageInventoryParts(garageId),
    ]);

    const workOrders = woSnap.docs
      .map((d) => ({ ...(d.data() as WorkOrder), id: d.id }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = itemsSnap.docs.map((d) => ({
      ...(d.data() as WorkOrderItem),
      id: d.id,
    }));

    const profit = computeGarageProfitAnalysis(workOrders, items, parts);

    const csv = serializeCsv(
      [
        "Work Order ID",
        "Date",
        "Status",
        "License Plate",
        "Vehicle",
        "Customer",
        "Revenue (EUR)",
        "Labor (EUR)",
        "Parts Sold (EUR)",
        "Parts COGS (EUR)",
        "Gross Profit (EUR)",
        "Gross Margin (%)",
        "Missing Cost Warning",
      ],
      profit.rows.map((r) => [
        r.order.id,
        (r.order.completedAt ?? r.order.createdAt).slice(0, 10),
        r.order.status,
        r.order.plateNumber,
        r.order.vehicleLabel,
        r.order.customerName ?? "",
        r.revenueEur.toFixed(2),
        r.laborEur.toFixed(2),
        r.partsRevenueEur.toFixed(2),
        r.partsCostEur.toFixed(2),
        r.grossProfitEur.toFixed(2),
        r.grossMarginPct,
        r.hasMissingPartCost ? "YES" : "NO",
      ])
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="veltrox-profit-ledger-${auth.garage.slug}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (exportType === "vip-customers") {
    const [custSnap, woSnap] = await Promise.all([
      admin.adminDb
        .collection("customers")
        .where("garageId", "==", garageId)
        .get(),
      admin.adminDb
        .collection("workOrders")
        .where("garageId", "==", garageId)
        .get(),
    ]);

    const customers = custSnap.docs.map((d) => ({
      ...(d.data() as Customer),
      id: d.id,
    }));
    const workOrders = woSnap.docs.map((d) => ({
      ...(d.data() as WorkOrder),
      id: d.id,
    }));

    const rows = computeGarageCustomerSegments(customers, workOrders);

    const csv = serializeCsv(
      [
        "Customer ID",
        "Full Name",
        "Phone",
        "Email",
        "Segment",
        "Visits",
        "Total Spend (EUR)",
        "Avg Ticket (EUR)",
        "Last Visit",
        "Days Inactive",
        "Primary Plate",
      ],
      rows.map((r) => [
        r.customer.id,
        r.customer.fullName,
        r.customer.phone,
        r.customer.email ?? "",
        r.segment.toUpperCase(),
        r.visitsCount,
        r.totalSpendEur.toFixed(2),
        r.avgTicketEur.toFixed(2),
        r.lastVisitIso ? r.lastVisitIso.slice(0, 10) : "",
        r.daysInactive ?? "",
        r.latestPlate,
      ])
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="veltrox-vip-customers-${auth.garage.slug}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

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
