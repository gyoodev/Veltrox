import { VehiclesFleetClient } from "@/components/admin/vehicles-fleet-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminVehiclesPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return (
    <VehiclesFleetClient
      initialVehicles={bundle.vehicles}
      users={bundle.users}
      reminders={bundle.reminders}
    />
  );
}

