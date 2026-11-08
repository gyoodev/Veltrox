import { ProfileSettingsView } from "@/components/profile/profile-settings-view";
import { requireRole } from "@/lib/auth/server-auth";

export default async function GarageProfilePage() {
  const { profile } = await requireRole(["GARAGE_OWNER"]);
  return <ProfileSettingsView initialProfile={profile} />;
}

