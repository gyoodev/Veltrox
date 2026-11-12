import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { toPlainFirestoreData } from "@/lib/firebase/serialize";
import type { PlatformSettingsConfig } from "@/types/domain";

export function getDefaultPlatformSettings(): PlatformSettingsConfig {
  return {
    maintenanceMode: false,
    maintenanceMessage: "Платформата е във временна профилактика. Моля, опитайте отново след няколко минути.",
    allowRegistrations: true,
    allowGarageApplications: true,
    complianceChecksEnabled: true,
    defaultCurrency: "EUR",
    proPlanPriceEur: 49,
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
      proPlanPriceEur:
        typeof data.proPlanPriceEur === "number" && data.proPlanPriceEur > 0
          ? data.proPlanPriceEur
          : defaults.proPlanPriceEur,
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
      proPlanPriceEur: next.proPlanPriceEur,
    },
    createdAt: new Date().toISOString(),
  });

  return next;
}

