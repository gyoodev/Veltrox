import { GaragesManagementClient } from "@/components/admin/garages-management-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminGaragesPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return (
    <GaragesManagementClient
      initialGarages={bundle.garages}
      users={bundle.users}
    />
  );
}

