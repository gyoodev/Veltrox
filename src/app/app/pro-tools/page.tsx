import { DriverProToolsClient } from "@/components/car-diary/driver-pro-tools-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { getUserDiaryBundle } from "@/lib/data/user-diary";
import { fetchBulgariaFuelPrices } from "@/lib/fuel-prices";
import { isDriverPro } from "@/lib/subscriptions/entitlements";

interface DriverProToolsPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function DriverProToolsPage({
  searchParams,
}: DriverProToolsPageProps) {
  const [{ profile }, resolvedSearch] = await Promise.all([
    requireRole(["USER", "ADMIN"]),
    searchParams ?? Promise.resolve<{ tab?: string }>({}),
  ]);

  const [bundle, settings, fuelPayload] = await Promise.all([
    getUserDiaryBundle(profile.uid),
    getPlatformSettings(),
    fetchBulgariaFuelPrices(),
  ]);

  return (
    <DriverProToolsClient
      isPro={isDriverPro(profile)}
      vehicles={bundle.vehicles}
      initialEntries={bundle.diaryEntries}
      documents={bundle.documents}
      initialReminders={bundle.reminders}
      fuelPrices={fuelPayload.fuels}
      settings={settings}
      initialTab={resolvedSearch.tab}
    />
  );
}

