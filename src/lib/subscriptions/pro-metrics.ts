import {
  evaluateDocumentExpiry,
  evaluateReminderUrgency,
  toEurAmount,
} from "@/lib/diary-metrics";
import { toAmountEur } from "@/lib/analytics-metrics";
import type {
  Customer,
  DiaryEntry,
  InventoryPart,
  Reminder,
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

