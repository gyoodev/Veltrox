import { ProfileSettingsView } from "@/components/profile/profile-settings-view";
import { requireRole } from "@/lib/auth/server-auth";

export default async function UserProfilePage() {
  const { profile } = await requireRole(["USER"]);
  return <ProfileSettingsView initialProfile={profile} />;
}

