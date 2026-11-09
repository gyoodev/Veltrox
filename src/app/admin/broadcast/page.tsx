import { BroadcastComposerClient } from "@/components/admin/broadcast-composer-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminBroadcastPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return (
    <BroadcastComposerClient
      recentNotifications={bundle.notifications}
      totalUsersCount={bundle.users.length}
      totalGaragesCount={bundle.garages.length}
    />
  );
}
