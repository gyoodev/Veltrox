import { ProfileSettingsView } from "@/components/profile/profile-settings-view";
import { requireRole } from "@/lib/auth/server-auth";
import { fetchBulgariaFuelPrices } from "@/lib/fuel-prices";

export default async function GarageProfilePage() {
  const [{ profile }, fuelPrices] = await Promise.all([
    requireRole(["GARAGE_OWNER"]),
    fetchBulgariaFuelPrices(),
  ]);
  return (
    <ProfileSettingsView
      initialProfile={profile}
      initialFuelPrices={fuelPrices}
    />
  );
}

