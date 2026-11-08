import { GarageSettingsClient } from "@/components/garage/garage-settings-client";
import { requireGarageManagerPage } from "@/lib/auth/server-auth";

export default async function GarageSettingsPage() {
  const { garage } = await requireGarageManagerPage();

  return <GarageSettingsClient initialGarage={garage} />;
}

