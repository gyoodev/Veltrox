import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { toPlainFirestoreData } from "@/lib/firebase/serialize";
import type {
  PlatformSettingsConfig,
  PromoCodeConfig,
} from "@/types/domain";

function normalizePlanPrice(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.round(value * 100) / 100;
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeDiscountPct(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.min(80, Math.round(value * 100) / 100);
}

function normalizePromoCodes(value: unknown): PromoCodeConfig[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: PromoCodeConfig[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const code =
      typeof raw.code === "string"
        ? raw.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "")
        : "";
    if (!code || code.length < 2 || code.length > 32 || seen.has(code)) {
      continue;
    }
    seen.add(code);
    const pctRaw = typeof raw.discountPct === "number" ? raw.discountPct : 0;
    const discountPct = Math.min(90, Math.max(1, Math.round(pctRaw * 100) / 100));
    const appliesToRaw = raw.appliesTo;
    const appliesTo: PromoCodeConfig["appliesTo"] =
      appliesToRaw === "user" || appliesToRaw === "garage" ? appliesToRaw : "all";

    normalized.push({
      code,
      discountPct,
      active: typeof raw.active === "boolean" ? raw.active : true,
      appliesTo,
    });
  }

  return normalized;
}

export function getDefaultPlatformSettings(): PlatformSettingsConfig {
  return {
    maintenanceMode: false,
    maintenanceMessage:
      "Платформата е във временна профилактика. Моля, опитайте отново след няколко минути.",
    allowRegistrations: true,
    allowGarageApplications: true,
    complianceChecksEnabled: true,
    defaultCurrency: "EUR",
    garageSubscriptionsEnabled: true,
    proPlanPriceEur: 49,
    userSubscriptionsEnabled: true,
    userProPlanPriceEur: 4.9,
    freeUserVehicleLimit: 2,
    freeGarageMonthlyWorkOrders: 30,
    annualBillingDiscountPct: 15,
    promoCodes: [],
    systemNotice: "",
    updatedAt: new Date(0).toISOString(),
    updatedByUid: null,
  };
}

export async function getPlatformSettings(): Promise<PlatformSettingsConfig> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return getDefaultPlatformSettings();
  }

  try {
    const snap = await admin.adminDb
      .collection("platformConfig")
      .doc("settings")
      .get();

    if (!snap.exists) {
      return getDefaultPlatformSettings();
    }

    const data = toPlainFirestoreData(
      snap.data() as Partial<PlatformSettingsConfig>
    );
    const defaults = getDefaultPlatformSettings();

    return {
      maintenanceMode: Boolean(data.maintenanceMode ?? defaults.maintenanceMode),
      maintenanceMessage: data.maintenanceMessage || defaults.maintenanceMessage,
      allowRegistrations: data.allowRegistrations ?? defaults.allowRegistrations,
      allowGarageApplications:
        data.allowGarageApplications ?? defaults.allowGarageApplications,
      complianceChecksEnabled:
        data.complianceChecksEnabled ?? defaults.complianceChecksEnabled,
      defaultCurrency: data.defaultCurrency === "BGN" ? "BGN" : "EUR",
      garageSubscriptionsEnabled:
        typeof data.garageSubscriptionsEnabled === "boolean"
          ? data.garageSubscriptionsEnabled
          : defaults.garageSubscriptionsEnabled,
      proPlanPriceEur: normalizePlanPrice(
        data.proPlanPriceEur,
        defaults.proPlanPriceEur
      ),
      userSubscriptionsEnabled:
        typeof data.userSubscriptionsEnabled === "boolean"
          ? data.userSubscriptionsEnabled
          : defaults.userSubscriptionsEnabled,
      userProPlanPriceEur: normalizePlanPrice(
        data.userProPlanPriceEur,
        defaults.userProPlanPriceEur
      ),
      freeUserVehicleLimit: normalizePositiveInt(
        data.freeUserVehicleLimit,
        defaults.freeUserVehicleLimit
      ),
      freeGarageMonthlyWorkOrders: normalizePositiveInt(
        data.freeGarageMonthlyWorkOrders,
        defaults.freeGarageMonthlyWorkOrders
      ),
      annualBillingDiscountPct: normalizeDiscountPct(
        data.annualBillingDiscountPct,
        defaults.annualBillingDiscountPct
      ),
      promoCodes: normalizePromoCodes(data.promoCodes),
      systemNotice: data.systemNotice ?? defaults.systemNotice,
      updatedAt: data.updatedAt ?? defaults.updatedAt,
      updatedByUid: data.updatedByUid ?? null,
    };
  } catch (err) {
    console.error("Error reading platform settings from Firestore:", err);
    return getDefaultPlatformSettings();
  }
}

export async function updatePlatformSettings(
  updates: Partial<PlatformSettingsConfig>,
  actorUid: string
): Promise<PlatformSettingsConfig> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new Error("Firebase Admin not initialized");
  }

  const current = await getPlatformSettings();
  const next: PlatformSettingsConfig = {
    ...current,
    ...updates,
    proPlanPriceEur:
      updates.proPlanPriceEur !== undefined
        ? normalizePlanPrice(updates.proPlanPriceEur, current.proPlanPriceEur)
        : current.proPlanPriceEur,
    userProPlanPriceEur:
      updates.userProPlanPriceEur !== undefined
        ? normalizePlanPrice(
            updates.userProPlanPriceEur,
            current.userProPlanPriceEur
          )
        : current.userProPlanPriceEur,
    freeUserVehicleLimit:
      updates.freeUserVehicleLimit !== undefined
        ? normalizePositiveInt(
            updates.freeUserVehicleLimit,
            current.freeUserVehicleLimit
          )
        : current.freeUserVehicleLimit,
    freeGarageMonthlyWorkOrders:
      updates.freeGarageMonthlyWorkOrders !== undefined
        ? normalizePositiveInt(
            updates.freeGarageMonthlyWorkOrders,
            current.freeGarageMonthlyWorkOrders
          )
        : current.freeGarageMonthlyWorkOrders,
    annualBillingDiscountPct:
      updates.annualBillingDiscountPct !== undefined
        ? normalizeDiscountPct(
            updates.annualBillingDiscountPct,
            current.annualBillingDiscountPct
          )
        : current.annualBillingDiscountPct,
    promoCodes:
      updates.promoCodes !== undefined
        ? normalizePromoCodes(updates.promoCodes)
        : current.promoCodes,
    garageSubscriptionsEnabled:
      typeof updates.garageSubscriptionsEnabled === "boolean"
        ? updates.garageSubscriptionsEnabled
        : current.garageSubscriptionsEnabled,
    userSubscriptionsEnabled:
      typeof updates.userSubscriptionsEnabled === "boolean"
        ? updates.userSubscriptionsEnabled
        : current.userSubscriptionsEnabled,
    updatedAt: new Date().toISOString(),
    updatedByUid: actorUid,
  };

  await admin.adminDb
    .collection("platformConfig")
    .doc("settings")
    .set(next, { merge: true });

  await admin.adminDb.collection("auditLogs").add({
    action: "PLATFORM_SETTINGS_UPDATED",
    actorUid,
    actorRole: "ADMIN",
    targetUid: null,
    targetGarageId: null,
    metadata: {
      maintenanceMode: next.maintenanceMode,
      allowRegistrations: next.allowRegistrations,
      allowGarageApplications: next.allowGarageApplications,
      complianceChecksEnabled: next.complianceChecksEnabled,
      defaultCurrency: next.defaultCurrency,
      garageSubscriptionsEnabled: next.garageSubscriptionsEnabled,
      proPlanPriceEur: next.proPlanPriceEur,
      userSubscriptionsEnabled: next.userSubscriptionsEnabled,
      userProPlanPriceEur: next.userProPlanPriceEur,
    },
    createdAt: new Date().toISOString(),
  });

  return next;
}

