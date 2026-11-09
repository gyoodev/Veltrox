import { OperationsHubClient } from "@/components/admin/operations-hub-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminOperationsPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return (
    <OperationsHubClient
      initialWorkOrders={bundle.workOrders}
      initialAppointments={bundle.appointments}
      garages={bundle.garages}
    />
  );
}

