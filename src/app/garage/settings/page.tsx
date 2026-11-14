import { GarageSettingsClient } from "@/components/garage/garage-settings-client";
import { requireGarageManagerPage } from "@/lib/auth/server-auth";
import { getPlatformSettings } from "@/lib/data/platform-settings";

export default async function GarageSettingsPage() {
  const [{ garage }, platformSettings] = await Promise.all([
    requireGarageManagerPage(),
    getPlatformSettings(),
  ]);

  return (
    <GarageSettingsClient
      initialGarage={garage}
      platformSettings={platformSettings}
    />
  );
}

