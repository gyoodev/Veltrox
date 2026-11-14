import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";
import { toEurAmount } from "@/lib/diary-metrics";
import { serializeCsv } from "@/lib/garage-utils";
import {
  buildProRequiredResponse,
  isDriverPro,
} from "@/lib/subscriptions/entitlements";
import { computeDriverPortfolioSummaries } from "@/lib/subscriptions/pro-metrics";

export const runtime = "nodejs";

/**
 * GET /api/diary/export?type=expenses|vehicles&vehicleId=...
 * Driver Pro-only Excel-safe CSV export (UTF-8 BOM + formula-injection defense).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (ctx.profile.role !== "USER" && ctx.profile.role !== "ADMIN")) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isDriverPro(ctx.profile)) {
    return buildProRequiredResponse("/app/subscription", "driver_pro");
  }

  const { searchParams } = new URL(request.url);
  const exportType = searchParams.get("type") ?? "expenses";
  const vehicleIdFilter = searchParams.get("vehicleId");

  const bundle = await getUserDiaryBundle(ctx.session.uid);
  const vehicleById = new Map(bundle.vehicles.map((v) => [v.id, v]));

  if (exportType === "vehicles") {
    const summaries = computeDriverPortfolioSummaries(
      bundle.vehicles,
      bundle.diaryEntries,
      bundle.documents,
      bundle.reminders
    );

    const csv = serializeCsv(
      [
        "Vehicle ID",
        "Make",
        "Model",
        "Year",
        "License Plate",
        "VIN",
        "Fuel Type",
        "Current Mileage (km)",
        "Total Spend (EUR)",
        "Maintenance (EUR)",
        "Fuel (EUR)",
        "Cost Per km (EUR)",
        "Resale Readiness (%)",
        "Diary Entries",
        "Documents",
        "Active Reminders",
      ],
      summaries.map((s) => [
        s.vehicle.id,
        s.vehicle.make,
        s.vehicle.model,
        s.vehicle.year,
        s.vehicle.plateNumber,
        s.vehicle.vin ?? "",
        s.vehicle.fuelType,
        s.vehicle.currentMileageKm,
        s.totalSpendEur.toFixed(2),
        s.maintenanceSpendEur.toFixed(2),
        s.fuelSpendEur.toFixed(2),
        s.costPerKmEur !== null ? s.costPerKmEur.toFixed(3) : "",
        s.readinessScore,
        s.entriesCount,
        s.documentsCount,
        s.activeRemindersCount,
      ])
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="veltrox-fleet-portfolio-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const filteredEntries = vehicleIdFilter
    ? bundle.diaryEntries.filter((e) => e.vehicleId === vehicleIdFilter)
    : bundle.diaryEntries;

  const csv = serializeCsv(
    [
      "Entry ID",
      "Date",
      "Make / Model",
      "License Plate",
      "Category",
      "Title",
      "Garage",
      "Mileage (km)",
      "Amount",
      "Currency",
      "Normalized Amount (EUR)",
      "Notes",
    ],
    filteredEntries.map((entry) => {
      const veh = vehicleById.get(entry.vehicleId);
      const eur = toEurAmount(entry.costAmount, entry.currency);
      return [
        entry.id,
        entry.date,
        veh ? `${veh.make} ${veh.model}` : "",
        veh?.plateNumber ?? "",
        entry.category,
        entry.title,
        entry.garageName ?? "",
        entry.mileageKm,
        entry.costAmount.toFixed(2),
        entry.currency,
        eur.toFixed(2),
        entry.notes ?? "",
      ];
    })
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="veltrox-driver-expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

