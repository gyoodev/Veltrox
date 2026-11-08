import type {
  DiaryCategory,
  DiaryEntry,
  Reminder,
  Vehicle,
} from "@/types/domain";

const BGN_TO_EUR_RATE = 1.95583;

/** Normalizes an entry's amount into EUR for unified aggregation across currencies. */
export function toEurAmount(amount: number, currency: "EUR" | "BGN"): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return currency === "BGN" ? amount / BGN_TO_EUR_RATE : amount;
}

export interface CategorySpendPoint {
  category: DiaryCategory;
  amountEur: number;
  count: number;
}

export interface MonthlySpendPoint {
  monthKey: string; // YYYY-MM
  amountEur: number;
}

export interface ExpenseAnalyticsSummary {
  totalAmountEur: number;
  costPerKmEur: number | null;
  trackedSpanKm: number;
  averageMonthlyEur: number;
  entriesCount: number;
  byCategory: CategorySpendPoint[];
  byMonth: MonthlySpendPoint[];
}

/**
 * Computes accurate expense analytics (`total`, `cost / km`, `cost / month`,
 * category breakdown, and 6-month trend) from real diary entries.
 * Never fabricates values or divides by zero.
 */
export function computeExpenseAnalytics(
  entries: readonly DiaryEntry[],
  vehicles: readonly Vehicle[]
): ExpenseAnalyticsSummary {
  let totalAmountEur = 0;
  const categoryMap = new Map<
    DiaryCategory,
    { amountEur: number; count: number }
  >();
  const monthMap = new Map<string, number>();

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, 0);
  }

  let earliestDateMs = Number.POSITIVE_INFINITY;
  let latestDateMs = 0;

  const vehicleMileageBounds = new Map<string, { min: number; max: number }>();
  for (const v of vehicles) {
    vehicleMileageBounds.set(v.id, {
      min: v.currentMileageKm,
      max: v.currentMileageKm,
    });
  }

  for (const entry of entries) {
    const eur = toEurAmount(entry.costAmount, entry.currency);
    totalAmountEur += eur;

    const existingCat = categoryMap.get(entry.category) ?? {
      amountEur: 0,
      count: 0,
    };
    categoryMap.set(entry.category, {
      amountEur: existingCat.amountEur + eur,
      count: existingCat.count + 1,
    });

    const monthKey = entry.date.slice(0, 7);
    if (monthMap.has(monthKey)) {
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + eur);
    }

    const ts = Date.parse(entry.date);
    if (!Number.isNaN(ts)) {
      if (ts < earliestDateMs) earliestDateMs = ts;
      if (ts > latestDateMs) latestDateMs = ts;
    }

    if (entry.mileageKm > 0) {
      const bounds = vehicleMileageBounds.get(entry.vehicleId);
      if (!bounds) {
        vehicleMileageBounds.set(entry.vehicleId, {
          min: entry.mileageKm,
          max: entry.mileageKm,
        });
      } else {
        bounds.min = Math.min(bounds.min, entry.mileageKm);
        bounds.max = Math.max(bounds.max, entry.mileageKm);
      }
    }
  }

  let trackedSpanKm = 0;
  for (const bounds of vehicleMileageBounds.values()) {
    if (bounds.max > bounds.min) {
      trackedSpanKm += bounds.max - bounds.min;
    }
  }

  const costPerKmEur =
    trackedSpanKm >= 10 && totalAmountEur > 0
      ? Number((totalAmountEur / trackedSpanKm).toFixed(3))
      : null;

  let activeMonths = 1;
  if (
    earliestDateMs < Number.POSITIVE_INFINITY &&
    latestDateMs >= earliestDateMs
  ) {
    const diffDays = (latestDateMs - earliestDateMs) / (1000 * 60 * 60 * 24);
    activeMonths = Math.max(1, Math.ceil(diffDays / 30.4375));
  }

  const averageMonthlyEur =
    entries.length > 0
      ? Number((totalAmountEur / activeMonths).toFixed(2))
      : 0;

  const byCategory: CategorySpendPoint[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      amountEur: Number(stats.amountEur.toFixed(2)),
      count: stats.count,
    }))
    .filter((item) => item.amountEur > 0 || item.count > 0)
    .sort((a, b) => b.amountEur - a.amountEur);

  const byMonth: MonthlySpendPoint[] = Array.from(monthMap.entries()).map(
    ([monthKey, amount]) => ({
      monthKey,
      amountEur: Number(amount.toFixed(2)),
    })
  );

  return {
    totalAmountEur: Number(totalAmountEur.toFixed(2)),
    costPerKmEur,
    trackedSpanKm,
    averageMonthlyEur,
    entriesCount: entries.length,
    byCategory,
    byMonth,
  };
}

export type ReminderUrgency = "overdue" | "due_soon" | "scheduled" | "completed";

export function evaluateReminderUrgency(
  reminder: Reminder,
  currentVehicleMileageKm?: number
): {
  urgency: ReminderUrgency;
  daysRemaining: number | null;
  kmRemaining: number | null;
} {
  if (reminder.status === "completed" || reminder.status === "cancelled") {
    return { urgency: "completed", daysRemaining: null, kmRemaining: null };
  }

  let daysRemaining: number | null = null;
  let kmRemaining: number | null;
  kmRemaining = null;

  if (reminder.dueDate) {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const dueMs = Date.parse(`${reminder.dueDate}T00:00:00`);
    if (!Number.isNaN(dueMs)) {
      daysRemaining = Math.round(
        (dueMs - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  if (
    typeof reminder.dueMileageKm === "number" &&
    typeof currentVehicleMileageKm === "number"
  ) {
    kmRemaining = reminder.dueMileageKm - currentVehicleMileageKm;
  }

  const isDateOverdue = daysRemaining !== null && daysRemaining < 0;
  const isKmOverdue = kmRemaining !== null && kmRemaining <= 0;
  if (isDateOverdue || isKmOverdue) {
    return { urgency: "overdue", daysRemaining, kmRemaining };
  }

  const isDateSoon = daysRemaining !== null && daysRemaining <= 14;
  const isKmSoon = kmRemaining !== null && kmRemaining <= 1000;
  if (isDateSoon || isKmSoon) {
    return { urgency: "due_soon", daysRemaining, kmRemaining };
  }

  return { urgency: "scheduled", daysRemaining, kmRemaining };
}

export type DocumentExpiryState =
  | "expired"
  | "expiring_soon"
  | "valid"
  | "no_expiry";

export function evaluateDocumentExpiry(expiryDate: string | null): {
  state: DocumentExpiryState;
  daysRemaining: number | null;
} {
  if (!expiryDate) {
    return { state: "no_expiry", daysRemaining: null };
  }
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const expMs = Date.parse(`${expiryDate}T00:00:00`);
  if (Number.isNaN(expMs)) {
    return { state: "no_expiry", daysRemaining: null };
  }
  const days = Math.round(
    (expMs - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return { state: "expired", daysRemaining: days };
  if (days <= 30) return { state: "expiring_soon", daysRemaining: days };
  return { state: "valid", daysRemaining: days };
}

