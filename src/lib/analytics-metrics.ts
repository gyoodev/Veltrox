import { normalizeLicensePlate } from "@/lib/validators/entities";
import {
  WORK_ORDER_STATUSES,
  type AppNotification,
  type Customer,
  type Garage,
  type Reminder,
  type UserProfile,
  type Vehicle,
  type WorkOrder,
  type WorkOrderItem,
  type WorkOrderStatus,
} from "@/types/domain";

const BGN_TO_EUR_RATE = 1.95583;
const DEFAULT_GARAGE_PRO_MONTHLY_EUR = 49;
const DEFAULT_USER_PRO_MONTHLY_EUR = 4.9;
const MS_PER_DAY = 86_400_000;

export function toAmountEur(
  amount: number,
  currency: "EUR" | "BGN" = "EUR"
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return currency === "BGN" ? amount / BGN_TO_EUR_RATE : amount;
}

function buildLastSixMonthKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)
    );
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
  }
  return keys;
}

function parseUtcDateMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const slice = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slice)) return null;
  const ms = Date.parse(`${slice}T00:00:00.000Z`);
  return Number.isNaN(ms) ? null : ms;
}

export interface MonthlyRevenuePoint {
  monthKey: string;
  revenueEur: number;
  jobsCount: number;
}

export interface StatusJobPoint {
  status: WorkOrderStatus;
  count: number;
}

export interface CommonServicePoint {
  service: string;
  count: number;
  revenueEur: number;
}

export interface OverdueCustomerItem {
  key: string;
  customerId: string | null;
  workOrderId: string | null;
  reminderId: string | null;
  linkedOwnerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  plateNumber: string;
  vehicleLabel: string;
  dueDate: string | null;
  dueMileageKm: number | null;
  daysUntilDue: number | null;
  alreadySent: boolean;
}

export interface GarageAnalyticsSummary {
  totalRevenueEur: number;
  totalLaborEur: number;
  totalPartsEur: number;
  totalJobs: number;
  completedJobs: number;
  averageTicketEur: number;
  newCustomersCount: number;
  returningCustomersCount: number;
  returningRatePercent: number;
  sentRemindersCount: number;
  convertedRemindersCount: number;
  reminderConversionRatePercent: number;
  revenueByMonth: MonthlyRevenuePoint[];
  jobsByStatus: StatusJobPoint[];
  commonServices: CommonServicePoint[];
  overdueCustomers: OverdueCustomerItem[];
}

export function computeGarageAnalytics(params: {
  workOrders: ReadonlyArray<WorkOrder>;
  workOrderItems: ReadonlyArray<WorkOrderItem>;
  customers: ReadonlyArray<Customer>;
  reminders: ReadonlyArray<Reminder>;
  now?: Date;
}): GarageAnalyticsSummary {
  const now = params.now ?? new Date();
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const monthKeys = buildLastSixMonthKeys(now);
  const revenueMap = new Map<string, { revenueEur: number; jobsCount: number }>(
    monthKeys.map((k) => [k, { revenueEur: 0, jobsCount: 0 }])
  );

  const statusCounts = new Map<WorkOrderStatus, number>(
    WORK_ORDER_STATUSES.map((s) => [s, 0])
  );

  let totalRevenueEur = 0;
  let totalLaborEur = 0;
  let totalPartsEur = 0;
  let pricedJobsCount = 0;
  let completedJobs = 0;

  const jobsPerCustomerKey = new Map<string, number>();
  const latestOrderDateByPlate = new Map<string, string>();
  const customerById = new Map<string, Customer>(
    params.customers.map((c) => [c.id, c])
  );

  for (const order of params.workOrders) {
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
    if (order.status === "completed") {
      completedJobs += 1;
    }

    const plateNorm =
      order.plateNormalized || normalizeLicensePlate(order.plateNumber);
    const prevLatest = latestOrderDateByPlate.get(plateNorm);
    if (!prevLatest || order.createdAt > prevLatest) {
      latestOrderDateByPlate.set(plateNorm, order.createdAt);
    }

    const custKey = order.customerId || plateNorm;
    if (custKey) {
      jobsPerCustomerKey.set(custKey, (jobsPerCustomerKey.get(custKey) ?? 0) + 1);
    }

    const orderEur = toAmountEur(order.totalAmount, order.currency);
    const laborEur = toAmountEur(order.totalLaborAmount, order.currency);
    const partsEur = toAmountEur(order.totalPartsAmount, order.currency);

    if (order.status === "completed" || order.status === "ready" || orderEur > 0) {
      totalRevenueEur += orderEur;
      totalLaborEur += laborEur;
      totalPartsEur += partsEur;
      if (orderEur > 0) {
        pricedJobsCount += 1;
      }
      const dateRef = (order.completedAt ?? order.createdAt).slice(0, 7);
      const bucket = revenueMap.get(dateRef);
      if (bucket) {
        bucket.revenueEur += orderEur;
        bucket.jobsCount += 1;
      }
    }
  }

  const averageTicketEur =
    pricedJobsCount > 0 ? totalRevenueEur / pricedJobsCount : 0;

  let newCustomersCount = 0;
  let returningCustomersCount = 0;
  for (const count of jobsPerCustomerKey.values()) {
    if (count >= 2) {
      returningCustomersCount += 1;
    } else if (count === 1) {
      newCustomersCount += 1;
    }
  }
  const totalActiveCustomers = newCustomersCount + returningCustomersCount;
  const returningRatePercent =
    totalActiveCustomers > 0
      ? Math.round((returningCustomersCount / totalActiveCustomers) * 100)
      : 0;

  // Common services from labor line items + work order summaries fallback
  const orderById = new Map<string, WorkOrder>(
    params.workOrders.map((o) => [o.id, o])
  );
  const serviceStats = new Map<string, { label: string; count: number; revenueEur: number }>();

  for (const item of params.workOrderItems) {
    if (item.type !== "labor") continue;
    const trimmed = item.description.trim();
    if (!trimmed) continue;
    const normKey = trimmed.toLowerCase();
    const parentOrder = orderById.get(item.workOrderId);
    const revEur = toAmountEur(item.totalPrice, parentOrder?.currency ?? "EUR");
    const existing = serviceStats.get(normKey);
    if (existing) {
      existing.count += 1;
      existing.revenueEur += revEur;
    } else {
      serviceStats.set(normKey, {
        label: trimmed.slice(0, 48),
        count: 1,
        revenueEur: revEur,
      });
    }
  }

  if (serviceStats.size === 0) {
    for (const order of params.workOrders) {
      const summary = order.customerSummary?.trim();
      if (!summary) continue;
      const firstClause = (summary.split(/[,\n;]/)[0] ?? summary).trim().slice(0, 48);
      if (!firstClause) continue;
      const normKey = firstClause.toLowerCase();
      const revEur = toAmountEur(order.totalAmount, order.currency);
      const existing = serviceStats.get(normKey);
      if (existing) {
        existing.count += 1;
        existing.revenueEur += revEur;
      } else {
        serviceStats.set(normKey, {
          label: firstClause,
          count: 1,
          revenueEur: revEur,
        });
      }
    }
  }

  const commonServices: CommonServicePoint[] = Array.from(serviceStats.values())
    .sort((a, b) => b.count - a.count || b.revenueEur - a.revenueEur)
    .slice(0, 6)
    .map((s) => ({
      service: s.label,
      count: s.count,
      revenueEur: Number(s.revenueEur.toFixed(2)),
    }));

  // Reminder-to-return conversion rate
  const actionableReminders = params.reminders.filter(
    (r) => r.status === "sent" || r.status === "completed"
  );
  let convertedRemindersCount = 0;

  for (const rem of actionableReminders) {
    const baselineIso = rem.sentAt ?? rem.createdAt;
    const remPlateNorm = rem.plateNumber
      ? normalizeLicensePlate(rem.plateNumber)
      : "";

    const returned = params.workOrders.some((wo) => {
      if (rem.workOrderId && wo.id === rem.workOrderId) return false;
      if (wo.createdAt <= baselineIso) return false;
      if (remPlateNorm && wo.plateNormalized === remPlateNorm) return true;
      if (rem.ownerId && wo.linkedOwnerId === rem.ownerId) return true;
      return false;
    });

    if (returned || rem.status === "completed") {
      convertedRemindersCount += 1;
    }
  }

  const sentRemindersCount = actionableReminders.length;
  const reminderConversionRatePercent =
    sentRemindersCount > 0
      ? Math.round((convertedRemindersCount / sentRemindersCount) * 100)
      : 0;

  // Overdue / due-soon (<= 14 days) customers needing outreach
  const overdueMap = new Map<string, OverdueCustomerItem>();
  const reminderById = new Map<string, Reminder>(
    params.reminders.map((r) => [r.id, r])
  );

  for (const order of params.workOrders) {
    if (!order.nextServiceDate && !order.nextServiceMileageKm) continue;
    const plateNorm =
      order.plateNormalized || normalizeLicensePlate(order.plateNumber);
    const newerOrderIso = latestOrderDateByPlate.get(plateNorm);
    if (newerOrderIso && newerOrderIso > order.createdAt) {
      continue;
    }

    const dueMs = parseUtcDateMs(order.nextServiceDate);
    const daysUntilDue =
      dueMs !== null ? Math.round((dueMs - todayUtcMs) / MS_PER_DAY) : null;

    // Include overdue or due within next 14 days
    if (daysUntilDue !== null && daysUntilDue > 14) {
      continue;
    }
    if (daysUntilDue === null && !order.nextServiceMileageKm) {
      continue;
    }

    const linkedRem = order.reminderId
      ? (reminderById.get(order.reminderId) ?? null)
      : null;
    if (linkedRem?.status === "completed" || linkedRem?.status === "cancelled") {
      continue;
    }

    const cust = order.customerId
      ? (customerById.get(order.customerId) ?? null)
      : null;

    if (!overdueMap.has(plateNorm)) {
      overdueMap.set(plateNorm, {
        key: plateNorm || order.id,
        customerId: order.customerId || null,
        workOrderId: order.id,
        reminderId: linkedRem?.id ?? null,
        linkedOwnerId: order.linkedOwnerId,
        customerName:
          order.customerName || cust?.fullName || order.plateNumber,
        customerPhone: order.customerPhone || cust?.phone || null,
        customerEmail: order.customerEmail || cust?.email || null,
        plateNumber: order.plateNumber,
        vehicleLabel: order.vehicleLabel,
        dueDate: order.nextServiceDate,
        dueMileageKm: order.nextServiceMileageKm,
        daysUntilDue,
        alreadySent: linkedRem?.status === "sent",
      });
    }
  }

  for (const rem of params.reminders) {
    if (rem.status !== "scheduled" || !rem.dueDate) continue;
    const dueMs = parseUtcDateMs(rem.dueDate);
    if (dueMs === null) continue;
    const daysUntilDue = Math.round((dueMs - todayUtcMs) / MS_PER_DAY);
    if (daysUntilDue > 14) continue;

    const key = rem.plateNumber
      ? normalizeLicensePlate(rem.plateNumber)
      : `rem-${rem.id}`;
    if (!overdueMap.has(key)) {
      overdueMap.set(key, {
        key,
        customerId: null,
        workOrderId: rem.workOrderId,
        reminderId: rem.id,
        linkedOwnerId: rem.ownerId,
        customerName: rem.recipientName || rem.plateNumber || rem.title,
        customerPhone: rem.recipientPhone ?? null,
        customerEmail: rem.recipientEmail ?? null,
        plateNumber: rem.plateNumber ?? "—",
        vehicleLabel: rem.title,
        dueDate: rem.dueDate,
        dueMileageKm: rem.dueMileageKm,
        daysUntilDue,
        alreadySent: false,
      });
    }
  }

  const overdueCustomers = Array.from(overdueMap.values()).sort(
    (a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999)
  );

  return {
    totalRevenueEur: Number(totalRevenueEur.toFixed(2)),
    totalLaborEur: Number(totalLaborEur.toFixed(2)),
    totalPartsEur: Number(totalPartsEur.toFixed(2)),
    totalJobs: params.workOrders.length,
    completedJobs,
    averageTicketEur: Number(averageTicketEur.toFixed(2)),
    newCustomersCount,
    returningCustomersCount,
    returningRatePercent,
    sentRemindersCount,
    convertedRemindersCount,
    reminderConversionRatePercent,
    revenueByMonth: monthKeys.map((monthKey) => {
      const item = revenueMap.get(monthKey) ?? { revenueEur: 0, jobsCount: 0 };
      return {
        monthKey,
        revenueEur: Number(item.revenueEur.toFixed(2)),
        jobsCount: item.jobsCount,
      };
    }),
    jobsByStatus: WORK_ORDER_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
    commonServices,
    overdueCustomers,
  };
}

export interface AdminGrowthPoint {
  monthKey: string;
  users: number;
  garages: number;
  workOrders: number;
}

export interface AdminPlatformAnalyticsSummary {
  totalUsers: number;
  carOwnersCount: number;
  garageOwnersCount: number;
  adminsCount: number;
  suspendedUsersCount: number;
  totalGarages: number;
  approvedGaragesCount: number;
  pendingGaragesCount: number;
  rejectedGaragesCount: number;
  freeGaragesCount: number;
  proGaragesCount: number;
  freeUsersCount: number;
  proUsersCount: number;
  mrrEur: number;
  arrEur: number;
  totalVehicles: number;
  totalWorkOrders: number;
  totalVolumeEur: number;
  scheduledRemindersCount: number;
  sentRemindersCount: number;
  completedRemindersCount: number;
  notificationsSentCount: number;
  notificationsFailedCount: number;
  growthByMonth: AdminGrowthPoint[];
}

export function computeAdminPlatformAnalytics(params: {
  users: ReadonlyArray<UserProfile>;
  garages: ReadonlyArray<Garage>;
  vehicles: ReadonlyArray<Vehicle>;
  workOrders: ReadonlyArray<WorkOrder>;
  reminders: ReadonlyArray<Reminder>;
  notifications: ReadonlyArray<AppNotification>;
  proPlanPriceEur?: number;
  userProPlanPriceEur?: number;
  garageSubscriptionsEnabled?: boolean;
  userSubscriptionsEnabled?: boolean;
  now?: Date;
}): AdminPlatformAnalyticsSummary {
  const now = params.now ?? new Date();
  const monthKeys = buildLastSixMonthKeys(now);
  const growthMap = new Map<
    string,
    { users: number; garages: number; workOrders: number }
  >(monthKeys.map((k) => [k, { users: 0, garages: 0, workOrders: 0 }]));

  let carOwnersCount = 0;
  let garageOwnersCount = 0;
  let adminsCount = 0;
  let suspendedUsersCount = 0;
  let freeUsersCount = 0;
  let proUsersCount = 0;

  for (const u of params.users) {
    if (u.role === "USER") {
      carOwnersCount += 1;
      if (u.plan === "pro") proUsersCount += 1;
      else freeUsersCount += 1;
    } else if (u.role === "GARAGE_OWNER") garageOwnersCount += 1;
    else if (u.role === "ADMIN") adminsCount += 1;

    if (u.suspended) suspendedUsersCount += 1;

    const bucket = growthMap.get(u.createdAt.slice(0, 7));
    if (bucket) bucket.users += 1;
  }

  let approvedGaragesCount = 0;
  let pendingGaragesCount = 0;
  let rejectedGaragesCount = 0;
  let freeGaragesCount = 0;
  let proGaragesCount = 0;

  for (const g of params.garages) {
    if (g.status === "approved") {
      approvedGaragesCount += 1;
      if (g.plan === "pro") proGaragesCount += 1;
      else freeGaragesCount += 1;
    } else if (g.status === "pending") {
      pendingGaragesCount += 1;
    } else if (g.status === "rejected") {
      rejectedGaragesCount += 1;
    }

    const bucket = growthMap.get(g.createdAt.slice(0, 7));
    if (bucket) bucket.garages += 1;
  }

  // Also count pending GARAGE_OWNER user accounts that haven't created a `garages` doc yet
  const onboardedOwnerUids = new Set(params.garages.map((g) => g.ownerUid));
  for (const u of params.users) {
    if (
      u.role === "GARAGE_OWNER" &&
      !u.isStaff &&
      u.garageStatus === "pending" &&
      !onboardedOwnerUids.has(u.uid)
    ) {
      pendingGaragesCount += 1;
    }
  }

  let totalVolumeEur = 0;
  for (const wo of params.workOrders) {
    totalVolumeEur += toAmountEur(wo.totalAmount, wo.currency);
    const bucket = growthMap.get(wo.createdAt.slice(0, 7));
    if (bucket) bucket.workOrders += 1;
  }

  let scheduledRemindersCount = 0;
  let sentRemindersCount = 0;
  let completedRemindersCount = 0;
  for (const r of params.reminders) {
    if (r.status === "scheduled") scheduledRemindersCount += 1;
    else if (r.status === "sent") sentRemindersCount += 1;
    else if (r.status === "completed") completedRemindersCount += 1;
  }

  let notificationsSentCount = 0;
  let notificationsFailedCount = 0;
  for (const n of params.notifications) {
    if (n.status === "failed") notificationsFailedCount += 1;
    else notificationsSentCount += 1;
  }

  const garagePriceEur =
    typeof params.proPlanPriceEur === "number" &&
    Number.isFinite(params.proPlanPriceEur) &&
    params.proPlanPriceEur >= 0
      ? params.proPlanPriceEur
      : DEFAULT_GARAGE_PRO_MONTHLY_EUR;
  const userPriceEur =
    typeof params.userProPlanPriceEur === "number" &&
    Number.isFinite(params.userProPlanPriceEur) &&
    params.userProPlanPriceEur >= 0
      ? params.userProPlanPriceEur
      : DEFAULT_USER_PRO_MONTHLY_EUR;
  const garageMrrEur =
    params.garageSubscriptionsEnabled !== false
      ? proGaragesCount * garagePriceEur
      : 0;
  const userMrrEur =
    params.userSubscriptionsEnabled !== false
      ? proUsersCount * userPriceEur
      : 0;
  const mrrEur = Number((garageMrrEur + userMrrEur).toFixed(2));

  return {
    totalUsers: params.users.length,
    carOwnersCount,
    garageOwnersCount,
    adminsCount,
    suspendedUsersCount,
    totalGarages: params.garages.length,
    approvedGaragesCount,
    pendingGaragesCount,
    rejectedGaragesCount,
    freeGaragesCount,
    proGaragesCount,
    freeUsersCount,
    proUsersCount,
    mrrEur,
    arrEur: Number((mrrEur * 12).toFixed(2)),
    totalVehicles: params.vehicles.length,
    totalWorkOrders: params.workOrders.length,
    totalVolumeEur: Number(totalVolumeEur.toFixed(2)),
    scheduledRemindersCount,
    sentRemindersCount,
    completedRemindersCount,
    notificationsSentCount,
    notificationsFailedCount,
    growthByMonth: monthKeys.map((monthKey) => ({
      monthKey,
      ...(growthMap.get(monthKey) ?? { users: 0, garages: 0, workOrders: 0 }),
    })),
  };
}

