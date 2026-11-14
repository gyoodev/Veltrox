import { ProfileSettingsView } from "@/components/profile/profile-settings-view";
import { requireRole } from "@/lib/auth/server-auth";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { fetchBulgariaFuelPrices } from "@/lib/fuel-prices";

export default async function UserProfilePage() {
  const [{ profile }, fuelPrices, platformSettings] = await Promise.all([
    requireRole(["USER", "ADMIN"]),
    fetchBulgariaFuelPrices(),
    getPlatformSettings(),
  ]);
  return (
    <ProfileSettingsView
      initialProfile={profile}
      initialFuelPrices={fuelPrices}
      platformSettings={platformSettings}
    />
  );
}

