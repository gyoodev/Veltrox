import { ProfileSettingsView } from "@/components/profile/profile-settings-view";
import { requireRole } from "@/lib/auth/server-auth";

export default async function AdminProfilePage() {
  const { profile } = await requireRole(["ADMIN"]);
  return <ProfileSettingsView initialProfile={profile} />;
}

