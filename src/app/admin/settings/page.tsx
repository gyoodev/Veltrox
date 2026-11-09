import { PlatformSettingsClient } from "@/components/admin/platform-settings-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getPlatformSettings } from "@/lib/data/platform-settings";

export default async function AdminSettingsPage() {
  await requireRole(["ADMIN"]);
  const settings = await getPlatformSettings();

  return <PlatformSettingsClient initialSettings={settings} />;
}
