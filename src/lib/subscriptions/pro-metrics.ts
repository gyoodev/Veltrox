import {
  evaluateDocumentExpiry,
  evaluateReminderUrgency,
  toEurAmount,
} from "@/lib/diary-metrics";
import { toAmountEur } from "@/lib/analytics-metrics";
import type {
  Appointment,
  Customer,
  DiaryEntry,
  Garage,
  GarageStaff,
  InventoryPart,
  Reminder,
  TyreSet,
  Vehicle,
  VehicleDocument,
  WorkOrder,
  WorkOrderItem,
} from "@/types/domain";

export interface DriverVehiclePortfolioSummary {
  vehicle: Vehicle;
  totalSpendEur: number;
  maintenanceSpendEur: number;
  fuelSpendEur: number;
  entriesCount: number;
  verifiedGarageEntries: number;
  documentsCount: number;
  activeRemindersCount: number;
  overdueCount: number;
  costPerKmEur: number | null;
  trackedKm: number;
  monthlyBurnEur: number;
  readinessScore: number;
  checks: {
    hasVin: boolean;
    hasServiceHistory: boolean;
    hasDocuments: boolean;
    complianceClean: boolean;
  };
}

export function computeDriverPortfolioSummaries(
  vehicles: ReadonlyArray<Vehicle>,
  entries: ReadonlyArray<DiaryEntry>,
  documents: ReadonlyArray<VehicleDocument>,
  reminders: ReadonlyArray<Reminder>
): DriverVehiclePortfolioSummary[] {
  return vehicles.map((vehicle) => {
    const carEntries = entries.filter((e) => e.vehicleId === vehicle.id);
    const carDocs = documents.filter((d) => d.vehicleId === vehicle.id);
    const carReminders = reminders.filter(
      (r) =>
        r.vehicleId === vehicle.id &&
        r.status !== "completed" &&
        r.status !== "cancelled"
    );

    let totalSpendEur = 0;
    let maintenanceSpendEur = 0;
    let fuelSpendEur = 0;
    let verifiedGarageEntries = 0;

    let minKm = vehicle.currentMileageKm > 0 ? vehicle.currentMileageKm : Number.POSITIVE_INFINITY;
    let maxKm = vehicle.currentMileageKm > 0 ? vehicle.currentMileageKm : 0;
    let earliestMs = Number.POSITIVE_INFINITY;
    let latestMs = 0;

    for (const e of carEntries) {
      const eur = toEurAmount(e.costAmount, e.currency);
      totalSpendEur += eur;
      if (e.category === "fuel") {
        fuelSpendEur += eur;
      } else {
        maintenanceSpendEur += eur;
      }
      if (e.workOrderId || e.garageId) {
        verifiedGarageEntries += 1;
      }
      if (e.mileageKm > 0) {
        if (e.mileageKm < minKm) minKm = e.mileageKm;
        if (e.mileageKm > maxKm) maxKm = e.mileageKm;
      }
      const ts = Date.parse(e.date);
      if (!Number.isNaN(ts)) {
        if (ts < earliestMs) earliestMs = ts;
        if (ts > latestMs) latestMs = ts;
      }
    }

    const trackedKm =
      Number.isFinite(minKm) && maxKm > minKm ? maxKm - minKm : 0;
    const costPerKmEur =
      trackedKm >= 50 && totalSpendEur > 0
        ? Number((totalSpendEur / trackedKm).toFixed(3))
        : null;

    const monthsSpan =
      Number.isFinite(earliestMs) && latestMs > earliestMs
        ? Math.max(1, (latestMs - earliestMs) / (1000 * 60 * 60 * 24 * 30.4375))
        : 1;
    const monthlyBurnEur = Number((totalSpendEur / monthsSpan).toFixed(2));

    let overdueCount = 0;
    for (const r of carReminders) {
      const { urgency } = evaluateReminderUrgency(r, vehicle.currentMileageKm);
      if (urgency === "overdue") overdueCount += 1;
    }
    for (const doc of carDocs) {
      if (evaluateDocumentExpiry(doc.expiryDate).state === "expired") {
        overdueCount += 1;
      }
    }

    const hasVin = Boolean(vehicle.vin && vehicle.vin.trim().length === 17);
    const hasServiceHistory = carEntries.length >= 2;
    const hasDocuments = carDocs.length >= 1;
    const complianceClean = overdueCount === 0;

    let readinessScore = 0;
    if (hasVin) readinessScore += 25;
    if (hasServiceHistory) readinessScore += 25;
    if (hasDocuments) readinessScore += 25;
    if (complianceClean) readinessScore += 25;

    return {
      vehicle,
      totalSpendEur: Number(totalSpendEur.toFixed(2)),
      maintenanceSpendEur: Number(maintenanceSpendEur.toFixed(2)),
      fuelSpendEur: Number(fuelSpendEur.toFixed(2)),
      entriesCount: carEntries.length,
      verifiedGarageEntries,
      documentsCount: carDocs.length,
      activeRemindersCount: carReminders.length,
      overdueCount,
      costPerKmEur,
      trackedKm,
      monthlyBurnEur,
      readinessScore,
      checks: {
        hasVin,
        hasServiceHistory,
        hasDocuments,
        complianceClean,
      },
    };
  });
}

export interface GarageOrderProfitRow {
  order: WorkOrder;
  revenueEur: number;
  laborEur: number;
  partsRevenueEur: number;
  partsCostEur: number;
  grossProfitEur: number;
  grossMarginPct: number;
  hasMissingPartCost: boolean;
}

export interface GarageProfitAnalysis {
  rows: GarageOrderProfitRow[];
  totalRevenueEur: number;
  totalLaborEur: number;
  totalPartsRevenueEur: number;
  totalPartsCostEur: number;
  grossProfitEur: number;
  grossMarginPct: number;
  averageProfitPerOrderEur: number;
}

export function computeGarageProfitAnalysis(
  workOrders: ReadonlyArray<WorkOrder>,
  workOrderItems: ReadonlyArray<WorkOrderItem>,
  inventoryParts: ReadonlyArray<InventoryPart>
): GarageProfitAnalysis {
  const partById = new Map<string, InventoryPart>(
    inventoryParts.map((p) => [p.id, p])
  );
  const itemsByOrder = new Map<string, WorkOrderItem[]>();
  for (const item of workOrderItems) {
    const arr = itemsByOrder.get(item.workOrderId) ?? [];
    arr.push(item);
    itemsByOrder.set(item.workOrderId, arr);
  }

  let totalRevenueEur = 0;
  let totalLaborEur = 0;
  let totalPartsRevenueEur = 0;
  let totalPartsCostEur = 0;

  const rows: GarageOrderProfitRow[] = workOrders
    .filter((o) => o.totalAmount > 0 || o.status === "completed")
    .map((order) => {
      const revenueEur = toAmountEur(order.totalAmount, order.currency);
      const laborEur = toAmountEur(order.totalLaborAmount, order.currency);
      const partsRevenueEur = toAmountEur(order.totalPartsAmount, order.currency);
      const items = itemsByOrder.get(order.id) ?? [];

      let orderCostEur = 0;
      let hasMissingPartCost = false;

      for (const item of items) {
        if (item.type !== "part") continue;
        const unitCost =
          typeof item.costPrice === "number" && item.costPrice > 0
            ? item.costPrice
            : item.inventoryPartId
              ? partById.get(item.inventoryPartId)?.costPrice ?? 0
              : 0;

        if (unitCost <= 0 && item.totalPrice > 0) {
          hasMissingPartCost = true;
        }
        orderCostEur += toAmountEur(unitCost * item.quantity, order.currency);
      }

      if (items.length === 0 && partsRevenueEur > 0) {
        hasMissingPartCost = true;
      }

      const grossProfitEur = revenueEur - orderCostEur;
      const grossMarginPct =
        revenueEur > 0 ? Math.round((grossProfitEur / revenueEur) * 100) : 0;

      totalRevenueEur += revenueEur;
      totalLaborEur += laborEur;
      totalPartsRevenueEur += partsRevenueEur;
      totalPartsCostEur += orderCostEur;

      return {
        order,
        revenueEur: Number(revenueEur.toFixed(2)),
        laborEur: Number(laborEur.toFixed(2)),
        partsRevenueEur: Number(partsRevenueEur.toFixed(2)),
        partsCostEur: Number(orderCostEur.toFixed(2)),
        grossProfitEur: Number(grossProfitEur.toFixed(2)),
        grossMarginPct,
        hasMissingPartCost,
      };
    });

  const grossProfitEur = totalRevenueEur - totalPartsCostEur;
  const grossMarginPct =
    totalRevenueEur > 0
      ? Math.round((grossProfitEur / totalRevenueEur) * 100)
      : 0;
  const averageProfitPerOrderEur =
    rows.length > 0 ? grossProfitEur / rows.length : 0;

  return {
    rows,
    totalRevenueEur: Number(totalRevenueEur.toFixed(2)),
    totalLaborEur: Number(totalLaborEur.toFixed(2)),
    totalPartsRevenueEur: Number(totalPartsRevenueEur.toFixed(2)),
    totalPartsCostEur: Number(totalPartsCostEur.toFixed(2)),
    grossProfitEur: Number(grossProfitEur.toFixed(2)),
    grossMarginPct,
    averageProfitPerOrderEur: Number(averageProfitPerOrderEur.toFixed(2)),
  };
}

export interface GarageReorderItem {
  part: InventoryPart;
  targetStock: number;
  reorderQty: number;
  estimatedCostEur: number;
  isCritical: boolean;
}

export function computeGarageReorderList(
  parts: ReadonlyArray<InventoryPart>,
  targetMultiplier = 2
): GarageReorderItem[] {
  const safeMultiplier = Math.max(1.5, Math.min(5, targetMultiplier));

  return parts
    .filter((p) => p.stockQty <= Math.max(1, p.minStockAlert * 1.5))
    .map((part) => {
      const targetStock = Math.max(
        part.minStockAlert + 2,
        Math.ceil(part.minStockAlert * safeMultiplier)
      );
      const reorderQty = Math.max(1, Math.ceil(targetStock - part.stockQty));
      const estimatedCostEur = Number((reorderQty * part.costPrice).toFixed(2));
      const isCritical = part.stockQty <= part.minStockAlert;

      return {
        part,
        targetStock,
        reorderQty,
        estimatedCostEur,
        isCritical,
      };
    })
    .sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      return b.estimatedCostEur - a.estimatedCostEur;
    });
}

export type CustomerSegment = "vip" | "at_risk" | "regular";

export interface GarageCustomerLtvRow {
  customer: Customer;
  visitsCount: number;
  totalSpendEur: number;
  avgTicketEur: number;
  lastVisitIso: string | null;
  daysInactive: number | null;
  segment: CustomerSegment;
  latestPlate: string;
  latestVehicleLabel: string;
}

export function computeGarageCustomerSegments(
  customers: ReadonlyArray<Customer>,
  workOrders: ReadonlyArray<WorkOrder>,
  now = new Date()
): GarageCustomerLtvRow[] {
  const nowMs = now.getTime();
  const ordersByCustomer = new Map<string, WorkOrder[]>();
  for (const wo of workOrders) {
    if (!wo.customerId) continue;
    const arr = ordersByCustomer.get(wo.customerId) ?? [];
    arr.push(wo);
    ordersByCustomer.set(wo.customerId, arr);
  }

  return customers
    .map((customer) => {
      const orders = (ordersByCustomer.get(customer.id) ?? []).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

      let totalSpendEur = 0;
      for (const wo of orders) {
        totalSpendEur += toAmountEur(wo.totalAmount, wo.currency);
      }

      const visitsCount = orders.length;
      const avgTicketEur = visitsCount > 0 ? totalSpendEur / visitsCount : 0;
      const latestOrder = orders[0];
      const lastVisitIso =
        latestOrder?.completedAt ??
        latestOrder?.createdAt ??
        customer.lastVisitAt ??
        null;

      let daysInactive: number | null = null;
      if (lastVisitIso) {
        const ts = Date.parse(lastVisitIso);
        if (!Number.isNaN(ts)) {
          daysInactive = Math.max(0, Math.floor((nowMs - ts) / 86_400_000));
        }
      }

      let segment: CustomerSegment = "regular";
      if (totalSpendEur >= 250 || visitsCount >= 3) {
        segment = "vip";
      }
      if (daysInactive !== null && daysInactive >= 90) {
        segment = "at_risk";
      }

      return {
        customer,
        visitsCount,
        totalSpendEur: Number(totalSpendEur.toFixed(2)),
        avgTicketEur: Number(avgTicketEur.toFixed(2)),
        lastVisitIso,
        daysInactive,
        segment,
        latestPlate: latestOrder?.plateNumber ?? customer.plateNumbers[0] ?? "",
        latestVehicleLabel: latestOrder?.vehicleLabel ?? "",
      };
    })
    .sort((a, b) => b.totalSpendEur - a.totalSpendEur || b.visitsCount - a.visitsCount);
}

export interface MonthlyBudgetObligation {
  monthKey: string; // YYYY-MM
  eventsCount: number;
  estimatedEur: number;
  labels: string[];
}

export interface MissingComplianceGap {
  vehicleId: string;
  vehicleLabel: string;
  plateNumber: string;
  kind: "liability_insurance" | "vignette" | "technical_inspection";
}

export interface DriverBudgetForecast {
  months: MonthlyBudgetObligation[];
  totalAnnualRenewalsEur: number;
  recommendedMonthlyReserveEur: number;
  missingCompliance: MissingComplianceGap[];
}

const RENEWAL_COST_MAP: Record<string, number> = {
  casco: 420,
  liability_insurance: 165,
  insurance: 165,
  technical_inspection: 45,
  inspection: 45,
  vignette: 44,
  vehicle_tax: 65,
  fire_extinguisher: 20,
  seasonal_tyres: 45,
  oil_change: 135,
  custom_service: 110,
};

export function computeDriverBudgetForecast(
  vehicles: ReadonlyArray<Vehicle>,
  documents: ReadonlyArray<VehicleDocument>,
  reminders: ReadonlyArray<Reminder>,
  now = new Date()
): DriverBudgetForecast {
  const monthMap = new Map<string, MonthlyBudgetObligation>();
  const startYear = now.getUTCFullYear();
  const startMonth = now.getUTCMonth();

  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(startYear, startMonth + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, {
      monthKey: key,
      eventsCount: 0,
      estimatedEur: 0,
      labels: [],
    });
  }

  for (const rem of reminders) {
    if (rem.status === "completed" || rem.status === "cancelled" || !rem.dueDate) {
      continue;
    }
    const bucket = monthMap.get(rem.dueDate.slice(0, 7));
    if (!bucket) continue;
    bucket.eventsCount += 1;
    bucket.estimatedEur += RENEWAL_COST_MAP[rem.type] ?? 90;
    if (bucket.labels.length < 4) {
      bucket.labels.push(rem.title);
    }
  }

  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    const bucket = monthMap.get(doc.expiryDate.slice(0, 7));
    if (!bucket) continue;
    bucket.eventsCount += 1;
    bucket.estimatedEur += RENEWAL_COST_MAP[doc.docType] ?? 60;
    if (bucket.labels.length < 4) {
      bucket.labels.push(doc.title);
    }
  }

  const months = Array.from(monthMap.values());
  const totalAnnualRenewalsEur = Number(
    months.reduce((acc, m) => acc + m.estimatedEur, 0).toFixed(2)
  );
  const recommendedMonthlyReserveEur = Number(
    (totalAnnualRenewalsEur / 12).toFixed(2)
  );

  const missingCompliance: MissingComplianceGap[] = [];
  for (const veh of vehicles) {
    const vehRems = reminders.filter(
      (r) =>
        r.vehicleId === veh.id &&
        r.status !== "completed" &&
        r.status !== "cancelled"
    );
    const vehDocs = documents.filter((d) => d.vehicleId === veh.id);
    const label = `${veh.make} ${veh.model}`;

    const checks: Array<{
      kind: MissingComplianceGap["kind"];
      docTypes: string[];
    }> = [
      { kind: "liability_insurance", docTypes: ["insurance"] },
      { kind: "vignette", docTypes: ["vignette"] },
      { kind: "technical_inspection", docTypes: ["inspection"] },
    ];

    for (const chk of checks) {
      const hasRem = vehRems.some((r) => r.type === chk.kind);
      const hasValidDoc = vehDocs.some(
        (d) =>
          chk.docTypes.includes(d.docType) &&
          evaluateDocumentExpiry(d.expiryDate).state !== "expired"
      );
      if (!hasRem && !hasValidDoc) {
        missingCompliance.push({
          vehicleId: veh.id,
          vehicleLabel: label,
          plateNumber: veh.plateNumber,
          kind: chk.kind,
        });
      }
    }
  }

  return {
    months,
    totalAnnualRenewalsEur,
    recommendedMonthlyReserveEur,
    missingCompliance,
  };
}

export interface DailyBaySchedule {
  dateIso: string;
  bookedCount: number;
  capacitySlots: number;
  loadPct: number;
}

export interface GarageBayCapacitySummary {
  concurrentBays: number;
  activeStaffCount: number;
  openOrdersCount: number;
  avgTurnaroundHours: number | null;
  currentBayUtilizationPct: number;
  dailySchedule: DailyBaySchedule[];
}

export function computeGarageBayCapacityAndTurnaround(
  garage: Pick<Garage, "concurrentBays">,
  workOrders: ReadonlyArray<WorkOrder>,
  appointments: ReadonlyArray<Appointment>,
  staff: ReadonlyArray<GarageStaff>,
  now = new Date()
): GarageBayCapacitySummary {
  const concurrentBays = Math.max(1, garage.concurrentBays ?? 2);
  const activeStaffCount = staff.filter((s) => s.active).length + 1;
  const openOrdersCount = workOrders.filter(
    (wo) => wo.status !== "completed"
  ).length;

  let turnaroundHoursSum = 0;
  let turnaroundCount = 0;
  for (const wo of workOrders) {
    if (wo.status !== "completed" || !wo.completedAt) continue;
    const startMs = Date.parse(wo.createdAt);
    const endMs = Date.parse(wo.completedAt);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      turnaroundHoursSum += (endMs - startMs) / (1000 * 60 * 60);
      turnaroundCount += 1;
    }
  }

  const avgTurnaroundHours =
    turnaroundCount > 0
      ? Number((turnaroundHoursSum / turnaroundCount).toFixed(1))
      : null;

  const currentBayUtilizationPct = Math.min(
    100,
    Math.round((openOrdersCount / Math.max(1, concurrentBays * 2)) * 100)
  );

  const slotsPerBayPerDay = 4;
  const capacitySlots = concurrentBays * slotsPerBayPerDay;
  const dailySchedule: DailyBaySchedule[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const dayDate = new Date(now.getTime() + offset * 86_400_000);
    const dateIso = dayDate.toISOString().slice(0, 10);
    const bookedCount = appointments.filter(
      (a) =>
        a.status !== "cancelled" &&
        a.scheduledStart.slice(0, 10) === dateIso
    ).length;
    const loadPct = Math.min(
      100,
      Math.round((bookedCount / Math.max(1, capacitySlots)) * 100)
    );
    dailySchedule.push({
      dateIso,
      bookedCount,
      capacitySlots,
      loadPct,
    });
  }

  return {
    concurrentBays,
    activeStaffCount,
    openOrdersCount,
    avgTurnaroundHours,
    currentBayUtilizationPct,
    dailySchedule,
  };
}

export interface GarageTyreOpportunityRow {
  tyreSet: TyreSet;
  isLowTread: boolean;
  isDueSoon: boolean;
}

export interface GarageTyreHotelSummary {
  storedSetsCount: number;
  totalTyresCount: number;
  winterSetsCount: number;
  summerSetsCount: number;
  allSeasonSetsCount: number;
  lowTreadUpsellsCount: number;
  opportunities: GarageTyreOpportunityRow[];
}

export function computeGarageTyreHotelOpportunities(
  tyreSets: ReadonlyArray<TyreSet>,
  now = new Date()
): GarageTyreHotelSummary {
  const stored = tyreSets.filter((t) => t.status === "stored");
  const cutoffIso = new Date(now.getTime() + 45 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let winterSetsCount = 0;
  let summerSetsCount = 0;
  let allSeasonSetsCount = 0;
  let lowTreadUpsellsCount = 0;
  let totalTyresCount = 0;

  const opportunities: GarageTyreOpportunityRow[] = stored.map((tyreSet) => {
    totalTyresCount += tyreSet.quantity || 4;
    if (tyreSet.season === "winter") winterSetsCount += 1;
    else if (tyreSet.season === "summer") summerSetsCount += 1;
    else allSeasonSetsCount += 1;

    const isLowTread =
      tyreSet.treadDepthMm !== null && tyreSet.treadDepthMm <= 3.5;
    if (isLowTread) lowTreadUpsellsCount += 1;

    const isDueSoon = Boolean(
      tyreSet.seasonalReminderDate &&
        tyreSet.seasonalReminderDate.slice(0, 10) <= cutoffIso
    );

    return {
      tyreSet,
      isLowTread,
      isDueSoon,
    };
  });

  opportunities.sort((a, b) => {
    if (a.isLowTread !== b.isLowTread) return a.isLowTread ? -1 : 1;
    if (a.isDueSoon !== b.isDueSoon) return a.isDueSoon ? -1 : 1;
    return b.tyreSet.storedAt.localeCompare(a.tyreSet.storedAt);
  });

  return {
    storedSetsCount: stored.length,
    totalTyresCount,
    winterSetsCount,
    summerSetsCount,
    allSeasonSetsCount,
    lowTreadUpsellsCount,
    opportunities,
  };
}


