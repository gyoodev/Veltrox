import { toAmountEur } from "@/lib/analytics-metrics";
import { evaluateDocumentExpiry } from "@/lib/diary-metrics";
import type {
  Appointment,
  Customer,
  DiaryCategory,
  DiaryEntry,
  GarageStaff,
  Reminder,
  Vehicle,
  VehicleDocument,
  WorkOrder,
  WorkOrderItem,
} from "@/types/domain";

const BGN_PER_EUR = 1.95583;

export interface FleetComparisonRow {
  vehicle: Vehicle;
  totalSpendEur: number;
  repairs12mEur: number;
  fuel12mEur: number;
  monthlyBurnEur: number;
  entriesCount: number;
  repairEntriesCount: number;
  repairToValuePct: number | null;
}

export function computeDriverFleetComparison(
  vehicles: ReadonlyArray<Vehicle>,
  entries: ReadonlyArray<DiaryEntry>,
  marketValuesByVehicleId: Record<string, number>,
  now = new Date()
): FleetComparisonRow[] {
  const cutoffMs = now.getTime() - 365 * 86_400_000;

  return vehicles.map((vehicle) => {
    const carEntries = entries.filter((e) => e.vehicleId === vehicle.id);
    let totalSpendEur = 0;
    let repairs12mEur = 0;
    let fuel12mEur = 0;
    let repairEntriesCount = 0;
    let earliestMs = now.getTime();

    for (const e of carEntries) {
      const eur =
        e.currency === "BGN" ? e.costAmount / BGN_PER_EUR : e.costAmount;
      totalSpendEur += eur;
      const ms = Date.parse(e.date);
      if (!Number.isNaN(ms) && ms < earliestMs) {
        earliestMs = ms;
      }
      if (e.category === "repair" || e.category === "service") {
        repairEntriesCount += 1;
      }
      if (Number.isNaN(ms) || ms >= cutoffMs) {
        if (e.category === "repair" || e.category === "service") {
          repairs12mEur += eur;
        } else if (e.category === "fuel") {
          fuel12mEur += eur;
        }
      }
    }

    const monthsTracked = Math.max(
      1,
      Math.round((now.getTime() - earliestMs) / (30.4 * 86_400_000))
    );
    const monthlyBurnEur = Number((totalSpendEur / monthsTracked).toFixed(2));
    const marketValue = marketValuesByVehicleId[vehicle.id] ?? 0;
    const repairToValuePct =
      marketValue > 0
        ? Math.round((repairs12mEur / marketValue) * 100)
        : null;

    return {
      vehicle,
      totalSpendEur: Number(totalSpendEur.toFixed(2)),
      repairs12mEur: Number(repairs12mEur.toFixed(2)),
      fuel12mEur: Number(fuel12mEur.toFixed(2)),
      monthlyBurnEur,
      entriesCount: carEntries.length,
      repairEntriesCount,
      repairToValuePct,
    };
  });
}

export type InspectionItemStatus = "ok" | "attention" | "red_flag";

export const PRE_PURCHASE_CHECKLIST_ITEMS = [
  "engineColdStart",
  "oilFluidsCondition",
  "transmissionShift",
  "suspensionSteering",
  "brakesTyres",
  "paintChassisRust",
  "electronicsAc",
  "obdDiagnosticsClean",
  "vinOdometerMatch",
  "roadTestNoise",
] as const;

export type PrePurchaseCheckKey = (typeof PRE_PURCHASE_CHECKLIST_ITEMS)[number];

export interface PrePurchaseScoreResult {
  scorePct: number;
  okCount: number;
  attentionCount: number;
  redFlagCount: number;
  suggestedDiscountPct: number;
}

export function computePrePurchaseScore(
  statuses: Record<PrePurchaseCheckKey, InspectionItemStatus>
): PrePurchaseScoreResult {
  let points = 0;
  let okCount = 0;
  let attentionCount = 0;
  let redFlagCount = 0;

  for (const key of PRE_PURCHASE_CHECKLIST_ITEMS) {
    const st = statuses[key] ?? "ok";
    if (st === "ok") {
      okCount += 1;
      points += 10;
    } else if (st === "attention") {
      attentionCount += 1;
      points += 5;
    } else {
      redFlagCount += 1;
    }
  }

  const suggestedDiscountPct = Math.min(
    35,
    attentionCount * 2 + redFlagCount * 7
  );

  return {
    scorePct: points,
    okCount,
    attentionCount,
    redFlagCount,
    suggestedDiscountPct,
  };
}

export type CrossBorderCountryCode = "gr" | "ro" | "rs" | "tr" | "eu";

export interface CrossBorderCountryConfig {
  code: CrossBorderCountryCode;
  requiresGreenCardCheck: boolean;
  requiresInternationalPowerOfAttorneyIfNotOwner: boolean;
  winterTyreMonths: number[];
  gearKeys: string[];
}

export const CROSS_BORDER_COUNTRIES: Record<
  CrossBorderCountryCode,
  CrossBorderCountryConfig
> = {
  gr: {
    code: "gr",
    requiresGreenCardCheck: true,
    requiresInternationalPowerOfAttorneyIfNotOwner: true,
    winterTyreMonths: [11, 12, 1, 2, 3],
    gearKeys: ["vests", "triangle", "firstAid", "fireExtinguisher", "tollTag"],
  },
  ro: {
    code: "ro",
    requiresGreenCardCheck: false,
    requiresInternationalPowerOfAttorneyIfNotOwner: true,
    winterTyreMonths: [11, 12, 1, 2, 3],
    gearKeys: ["vests", "doubleTriangle", "firstAid", "fireExtinguisher", "rovinieta"],
  },
  rs: {
    code: "rs",
    requiresGreenCardCheck: true,
    requiresInternationalPowerOfAttorneyIfNotOwner: true,
    winterTyreMonths: [11, 12, 1, 2, 3],
    gearKeys: ["vests", "triangle", "firstAid", "towRope", "spareBulbs"],
  },
  tr: {
    code: "tr",
    requiresGreenCardCheck: true,
    requiresInternationalPowerOfAttorneyIfNotOwner: true,
    winterTyreMonths: [12, 1, 2, 3],
    gearKeys: ["greenCardPaper", "doubleTriangle", "firstAid", "fireExtinguisher", "passportReg"],
  },
  eu: {
    code: "eu",
    requiresGreenCardCheck: true,
    requiresInternationalPowerOfAttorneyIfNotOwner: true,
    winterTyreMonths: [11, 12, 1, 2, 3],
    gearKeys: ["vests", "triangle", "firstAid", "vignettes", "ecoSticker"],
  },
};

export interface CrossBorderReadinessSummary {
  country: CrossBorderCountryCode;
  hasValidInsurance: boolean;
  hasValidInspection: boolean;
  hasValidVignette: boolean;
  winterTyreAdvisory: boolean;
  readinessPct: number;
  gearKeys: string[];
}

export function computeCrossBorderReadiness(
  vehicleId: string,
  country: CrossBorderCountryCode,
  documents: ReadonlyArray<VehicleDocument>,
  reminders: ReadonlyArray<Reminder>,
  tripDateIso: string
): CrossBorderReadinessSummary {
  const cfg = CROSS_BORDER_COUNTRIES[country];
  const carDocs = documents.filter((d) => d.vehicleId === vehicleId);
  const carRems = reminders.filter(
    (r) =>
      r.vehicleId === vehicleId &&
      r.status !== "completed" &&
      r.status !== "cancelled"
  );

  const hasValidDoc = (docType: VehicleDocument["docType"]) =>
    carDocs.some(
      (d) =>
        d.docType === docType &&
        evaluateDocumentExpiry(d.expiryDate).state !== "expired"
    );

  const hasInsurance =
    hasValidDoc("insurance") ||
    carRems.some((r) => r.type === "liability_insurance" || r.type === "casco");
  const hasInspection =
    hasValidDoc("inspection") ||
    carRems.some((r) => r.type === "technical_inspection");
  const hasVignette =
    hasValidDoc("vignette") || carRems.some((r) => r.type === "vignette");

  let passed = 0;
  const total = 3;
  if (hasInsurance) passed += 1;
  if (hasInspection) passed += 1;
  if (hasVignette) passed += 1;

  const tripMonth = Number(tripDateIso.slice(5, 7)) || new Date().getUTCMonth() + 1;
  const winterTyreAdvisory = cfg.winterTyreMonths.includes(tripMonth);

  return {
    country,
    hasValidInsurance: hasInsurance,
    hasValidInspection: hasInspection,
    hasValidVignette: hasVignette,
    winterTyreAdvisory,
    readinessPct: Math.round((passed / total) * 100),
    gearKeys: cfg.gearKeys,
  };
}

export interface ObdTriageEntry {
  code: string;
  severity: "stop" | "soon" | "monitor";
  minCostEur: number;
  maxCostEur: number;
  categoryKey: string;
  specialtyFilter: string;
}

export const DRIVER_OBD_TRIAGE_CATALOG: ObdTriageEntry[] = [
  {
    code: "P0420",
    severity: "monitor",
    minCostEur: 90,
    maxCostEur: 480,
    categoryKey: "catalyst",
    specialtyFilter: "Diagnostics",
  },
  {
    code: "P2002",
    severity: "soon",
    minCostEur: 120,
    maxCostEur: 650,
    categoryKey: "dpf",
    specialtyFilter: "DPF",
  },
  {
    code: "P0401",
    severity: "soon",
    minCostEur: 85,
    maxCostEur: 320,
    categoryKey: "egr",
    specialtyFilter: "Engine",
  },
  {
    code: "P0300",
    severity: "stop",
    minCostEur: 55,
    maxCostEur: 280,
    categoryKey: "misfire",
    specialtyFilter: "Engine",
  },
  {
    code: "P0171",
    severity: "soon",
    minCostEur: 45,
    maxCostEur: 220,
    categoryKey: "leanMix",
    specialtyFilter: "Diagnostics",
  },
  {
    code: "P0115",
    severity: "soon",
    minCostEur: 45,
    maxCostEur: 170,
    categoryKey: "thermostat",
    specialtyFilter: "Cooling",
  },
  {
    code: "P0562",
    severity: "soon",
    minCostEur: 75,
    maxCostEur: 290,
    categoryKey: "alternator",
    specialtyFilter: "Electrical",
  },
  {
    code: "C0035",
    severity: "soon",
    minCostEur: 40,
    maxCostEur: 145,
    categoryKey: "absSensor",
    specialtyFilter: "Brakes",
  },
  {
    code: "OIL_PRESSURE",
    severity: "stop",
    minCostEur: 120,
    maxCostEur: 950,
    categoryKey: "oilPressure",
    specialtyFilter: "Engine",
  },
  {
    code: "BRAKE_PADS",
    severity: "soon",
    minCostEur: 75,
    maxCostEur: 240,
    categoryKey: "brakePads",
    specialtyFilter: "Brakes",
  },
  {
    code: "COOLANT_HIGH",
    severity: "stop",
    minCostEur: 80,
    maxCostEur: 550,
    categoryKey: "coolantHigh",
    specialtyFilter: "Cooling",
  },
  {
    code: "TIMING_RATTLE",
    severity: "stop",
    minCostEur: 280,
    maxCostEur: 900,
    categoryKey: "timingChain",
    specialtyFilter: "Engine",
  },
];

export interface ParsedReceiptData {
  title: string;
  category: DiaryCategory;
  amountEur: number;
  rawAmount: number;
  currency: "EUR" | "BGN";
  date: string;
  mileageKm: number | null;
  liters: number | null;
}

export function parseReceiptSnippet(
  rawText: string,
  fallbackDate = new Date().toISOString().slice(0, 10)
): ParsedReceiptData {
  const clean = rawText.trim();

  let category: DiaryCategory = "repair";
  if (/(omv|shell|lukoil|eko|petrol|rompetrol|дизел|бензин|газ|lpg|гориво|fuel|л\.|\bl\b)/i.test(clean)) {
    category = "fuel";
  } else if (/(гуми|баланс|tyre|tire|michelin|bridgestone|nokian)/i.test(clean)) {
    category = "tyres";
  } else if (/(гтп|преглед|inspection|gtp)/i.test(clean)) {
    category = "inspection";
  } else if (/(гражданска|каско|застрахов|винетка|insurance|vignette)/i.test(clean)) {
    category = "insurance";
  } else if (/(масло|филтър|обслужване|oil|filter|service)/i.test(clean)) {
    category = "service";
  }

  let date = fallbackDate;
  const isoMatch = clean.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  const euMatch = clean.match(/\b(\d{2})[./-](\d{2})[./-](20\d{2})\b/);
  if (isoMatch?.[1] && isoMatch[2] && isoMatch[3]) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else if (euMatch?.[1] && euMatch[2] && euMatch[3]) {
    date = `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;
  }

  let currency: "EUR" | "BGN" = "EUR";
  if (/(лв|bgn)/i.test(clean) && !/(€|eur)/i.test(clean)) {
    currency = "BGN";
  }

  const totalMatch =
    clean.match(/(?:общо|сума|total|paid|sum)[^0-9]{0,12}(\d+(?:[.,]\d{1,2})?)/i) ??
    clean.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|лв\.?|bgn)/i);
  const rawAmount = totalMatch?.[1]
    ? Number.parseFloat(totalMatch[1].replace(",", "."))
    : 0;
  const safeRawAmount = Number.isFinite(rawAmount) ? rawAmount : 0;
  const amountEur =
    currency === "BGN"
      ? Number((safeRawAmount / BGN_PER_EUR).toFixed(2))
      : Number(safeRawAmount.toFixed(2));

  const kmMatch = clean.match(/(\d{4,7})\s*(?:км|km)\b/i);
  const mileageKm = kmMatch?.[1] ? Number.parseInt(kmMatch[1], 10) : null;

  const literMatch = clean.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:l|л|литра|kwh)\b/i);
  const liters = literMatch?.[1]
    ? Number.parseFloat(literMatch[1].replace(",", "."))
    : null;

  const firstLine =
    clean
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length >= 3) ?? "";
  const title = firstLine.slice(0, 80);

  return {
    title,
    category,
    amountEur,
    rawAmount: safeRawAmount,
    currency,
    date,
    mileageKm: mileageKm && Number.isFinite(mileageKm) ? mileageKm : null,
    liters: liters && Number.isFinite(liters) ? liters : null,
  };
}

// =============================================================================
// NEW GARAGE PRO METRICS (6 NEW TOOLS -> 12 TOTAL)
// =============================================================================

export interface StalledQuoteRow {
  workOrder: WorkOrder;
  amountEur: number;
  ageHours: number;
  isQuotePending: boolean;
}

export interface GarageStalledQuotesSummary {
  stalledCount: number;
  pendingQuoteApprovalsCount: number;
  totalAtRiskEur: number;
  rows: StalledQuoteRow[];
}

export function computeGarageStalledQuotes(
  workOrders: ReadonlyArray<WorkOrder>,
  minStalledHours = 24,
  now = new Date()
): GarageStalledQuotesSummary {
  const nowMs = now.getTime();
  const rows: StalledQuoteRow[] = [];

  for (const wo of workOrders) {
    if (wo.status === "completed") continue;
    const isQuotePending = wo.quoteStatus === "pending";
    const refIso = isQuotePending
      ? wo.quoteRequestedAt ?? wo.updatedAt
      : wo.updatedAt;
    const refMs = Date.parse(refIso);
    const ageHours = Number.isNaN(refMs)
      ? 0
      : Math.max(0, Math.round((nowMs - refMs) / 3_600_000));

    const isStalledStage =
      wo.status === "diagnosing" || wo.status === "waiting_parts";

    if (isQuotePending || (isStalledStage && ageHours >= minStalledHours)) {
      const amountRaw =
        isQuotePending && (wo.quoteTotalAmount ?? 0) > 0
          ? (wo.quoteTotalAmount ?? 0)
          : wo.totalAmount;
      rows.push({
        workOrder: wo,
        amountEur: Number(toAmountEur(amountRaw, wo.currency).toFixed(2)),
        ageHours,
        isQuotePending,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.isQuotePending !== b.isQuotePending) {
      return a.isQuotePending ? -1 : 1;
    }
    return b.amountEur - a.amountEur || b.ageHours - a.ageHours;
  });

  const pendingQuoteApprovalsCount = rows.filter(
    (r) => r.isQuotePending
  ).length;
  const totalAtRiskEur = Number(
    rows.reduce((acc, r) => acc + r.amountEur, 0).toFixed(2)
  );

  return {
    stalledCount: rows.length,
    pendingQuoteApprovalsCount,
    totalAtRiskEur,
    rows,
  };
}

export interface TechPerformanceRow {
  uid: string;
  displayName: string;
  roleLabel: string;
  assignedCount: number;
  completedCount: number;
  activeCount: number;
  laborRevenueEur: number;
  partsRevenueEur: number;
  totalRevenueEur: number;
  avgTicketEur: number;
  avgTurnaroundHours: number | null;
}

export function computeGarageTechPerformance(
  ownerName: string,
  staff: ReadonlyArray<GarageStaff>,
  workOrders: ReadonlyArray<WorkOrder>,
  workOrderItems: ReadonlyArray<WorkOrderItem>
): TechPerformanceRow[] {
  const itemsByWo = new Map<string, WorkOrderItem[]>();
  for (const item of workOrderItems) {
    const list = itemsByWo.get(item.workOrderId);
    if (list) list.push(item);
    else itemsByWo.set(item.workOrderId, [item]);
  }

  const buckets = new Map<
    string,
    {
      displayName: string;
      roleLabel: string;
      orders: WorkOrder[];
    }
  >();

  for (const s of staff) {
    buckets.set(s.uid, {
      displayName: s.displayName,
      roleLabel: s.staffRole,
      orders: [],
    });
  }
  buckets.set("owner", {
    displayName: ownerName,
    roleLabel: "owner",
    orders: [],
  });
  buckets.set("unassigned", {
    displayName: "Unassigned / Shared Bay",
    roleLabel: "unassigned",
    orders: [],
  });

  for (const wo of workOrders) {
    const uid = wo.assignedStaffUid;
    if (uid && buckets.has(uid)) {
      buckets.get(uid)?.orders.push(wo);
    } else if (uid && wo.assignedStaffName) {
      buckets.set(uid, {
        displayName: wo.assignedStaffName,
        roleLabel: "mechanic",
        orders: [wo],
      });
    } else if (!uid && staff.length === 0) {
      buckets.get("owner")?.orders.push(wo);
    } else {
      buckets.get("unassigned")?.orders.push(wo);
    }
  }

  const rows: TechPerformanceRow[] = [];
  for (const [uid, bucket] of buckets.entries()) {
    if (uid === "unassigned" && bucket.orders.length === 0) continue;
    if (uid === "owner" && bucket.orders.length === 0 && staff.length > 0) {
      continue;
    }

    let completedCount = 0;
    let activeCount = 0;
    let laborRevenueEur = 0;
    let partsRevenueEur = 0;
    let turnaroundHoursSum = 0;
    let turnaroundSamples = 0;

    for (const wo of bucket.orders) {
      if (wo.status === "completed") {
        completedCount += 1;
        laborRevenueEur += toAmountEur(wo.totalLaborAmount, wo.currency);
        partsRevenueEur += toAmountEur(wo.totalPartsAmount, wo.currency);

        if (wo.completedAt) {
          const sMs = Date.parse(wo.createdAt);
          const eMs = Date.parse(wo.completedAt);
          if (!Number.isNaN(sMs) && !Number.isNaN(eMs) && eMs >= sMs) {
            turnaroundHoursSum += (eMs - sMs) / 3_600_000;
            turnaroundSamples += 1;
          }
        }
      } else {
        activeCount += 1;
      }
    }

    const totalRevenueEur = Number((laborRevenueEur + partsRevenueEur).toFixed(2));
    rows.push({
      uid,
      displayName: bucket.displayName,
      roleLabel: bucket.roleLabel,
      assignedCount: bucket.orders.length,
      completedCount,
      activeCount,
      laborRevenueEur: Number(laborRevenueEur.toFixed(2)),
      partsRevenueEur: Number(partsRevenueEur.toFixed(2)),
      totalRevenueEur,
      avgTicketEur:
        completedCount > 0
          ? Number((totalRevenueEur / completedCount).toFixed(2))
          : 0,
      avgTurnaroundHours:
        turnaroundSamples > 0
          ? Number((turnaroundHoursSum / turnaroundSamples).toFixed(1))
          : null,
    });
  }

  return rows.sort((a, b) => b.totalRevenueEur - a.totalRevenueEur || b.completedCount - a.completedCount);
}

export interface B2BFleetAccountRow {
  customer: Customer;
  plates: string[];
  ordersCount: number;
  completedCount: number;
  completedSpendEur: number;
  openOrdersEur: number;
  lastVisitIso: string | null;
}

export function computeGarageB2BFleetStatements(
  customers: ReadonlyArray<Customer>,
  workOrders: ReadonlyArray<WorkOrder>
): B2BFleetAccountRow[] {
  const woByCust = new Map<string, WorkOrder[]>();
  for (const wo of workOrders) {
    const arr = woByCust.get(wo.customerId);
    if (arr) arr.push(wo);
    else woByCust.set(wo.customerId, [wo]);
  }

  return customers
    .map((customer) => {
      const orders = woByCust.get(customer.id) ?? [];
      const plateSet = new Set(customer.plateNumbers);
      let completedCount = 0;
      let completedSpendEur = 0;
      let openOrdersEur = 0;
      let lastVisitIso: string | null = null;

      for (const wo of orders) {
        if (wo.plateNumber) plateSet.add(wo.plateNumber);
        const amtEur = toAmountEur(wo.totalAmount, wo.currency);
        if (wo.status === "completed") {
          completedCount += 1;
          completedSpendEur += amtEur;
        } else {
          openOrdersEur += amtEur;
        }
        const dateCandidate = wo.completedAt ?? wo.updatedAt;
        if (!lastVisitIso || dateCandidate > lastVisitIso) {
          lastVisitIso = dateCandidate;
        }
      }

      return {
        customer,
        plates: Array.from(plateSet),
        ordersCount: orders.length,
        completedCount,
        completedSpendEur: Number(completedSpendEur.toFixed(2)),
        openOrdersEur: Number(openOrdersEur.toFixed(2)),
        lastVisitIso,
      };
    })
    .sort((a, b) => b.completedSpendEur - a.completedSpendEur || b.plates.length - a.plates.length);
}

export interface SeasonalDemandMonth {
  monthIndex: number; // 1..12
  workOrdersCount: number;
  appointmentsCount: number;
  revenueEur: number;
  demandLevel: "peak" | "normal" | "slow";
}

export function computeGarageSeasonalDemand(
  workOrders: ReadonlyArray<WorkOrder>,
  appointments: ReadonlyArray<Appointment>
): SeasonalDemandMonth[] {
  const buckets = Array.from({ length: 12 }, (_, idx) => ({
    monthIndex: idx + 1,
    workOrdersCount: 0,
    appointmentsCount: 0,
    revenueEur: 0,
  }));

  for (const wo of workOrders) {
    const d = new Date(wo.completedAt ?? wo.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const slot = buckets[d.getUTCMonth()];
    if (!slot) continue;
    slot.workOrdersCount += 1;
    if (wo.status === "completed") {
      slot.revenueEur += toAmountEur(wo.totalAmount, wo.currency);
    }
  }

  for (const ap of appointments) {
    if (ap.status === "cancelled") continue;
    const d = new Date(ap.scheduledStart);
    if (Number.isNaN(d.getTime())) continue;
    const slot = buckets[d.getUTCMonth()];
    if (!slot) continue;
    slot.appointmentsCount += 1;
  }

  const totalVolume = buckets.reduce(
    (acc, b) => acc + b.workOrdersCount + b.appointmentsCount,
    0
  );
  const avgPerActiveMonth = totalVolume / 12;

  return buckets.map((b) => {
    const vol = b.workOrdersCount + b.appointmentsCount;
    let demandLevel: SeasonalDemandMonth["demandLevel"] = "normal";
    if (totalVolume > 0 && vol >= Math.max(2, avgPerActiveMonth * 1.25)) {
      demandLevel = "peak";
    } else if (totalVolume > 0 && vol < Math.max(1, avgPerActiveMonth * 0.7)) {
      demandLevel = "slow";
    }
    return {
      ...b,
      revenueEur: Number(b.revenueEur.toFixed(2)),
      demandLevel,
    };
  });
}

export interface ComebackAlertRow {
  plateNumber: string;
  customerName: string;
  previousOrder: WorkOrder;
  currentOrder: WorkOrder;
  daysBetween: number;
  reworkExposureEur: number;
}

export function computeGarageComebackRadar(
  workOrders: ReadonlyArray<WorkOrder>,
  windowDays = 45
): ComebackAlertRow[] {
  const byPlate = new Map<string, WorkOrder[]>();
  for (const wo of workOrders) {
    const key = wo.plateNormalized || wo.plateNumber.replace(/[\s-]+/g, "").toUpperCase();
    if (!key) continue;
    const list = byPlate.get(key);
    if (list) list.push(wo);
    else byPlate.set(key, [wo]);
  }

  const alerts: ComebackAlertRow[] = [];

  for (const list of byPlate.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (!prev || !curr) continue;
      if (prev.status !== "completed") continue;
      const prevEndMs = Date.parse(prev.completedAt ?? prev.createdAt);
      const currStartMs = Date.parse(curr.createdAt);
      if (Number.isNaN(prevEndMs) || Number.isNaN(currStartMs)) continue;
      const daysBetween = Math.max(
        0,
        Math.round((currStartMs - prevEndMs) / 86_400_000)
      );
      if (daysBetween <= windowDays) {
        alerts.push({
          plateNumber: curr.plateNumber,
          customerName: curr.customerName || prev.customerName || curr.customerPhone || "—",
          previousOrder: prev,
          currentOrder: curr,
          daysBetween,
          reworkExposureEur: Number(
            toAmountEur(curr.totalAmount, curr.currency).toFixed(2)
          ),
        });
      }
    }
  }

  return alerts.sort((a, b) => a.daysBetween - b.daysBetween || b.reworkExposureEur - a.reworkExposureEur);
}

