import { WorkOrdersBoardClient } from "@/components/garage/work-orders-board-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getGarageWorkspaceBundle } from "@/lib/data/garage";

interface WorkOrdersPageProps {
  searchParams: Promise<{ plate?: string }>;
}

export default async function GarageWorkOrdersPage({
  searchParams,
}: WorkOrdersPageProps) {
  const { garage, isManager } = await requireOnboardedGarage();
  const [bundle, sp] = await Promise.all([
    getGarageWorkspaceBundle(garage.id),
    searchParams,
  ]);

  return (
    <WorkOrdersBoardClient
      initialWorkOrders={bundle.workOrders}
      initialCustomers={bundle.customers}
      isManager={isManager}
      initialPlateSearch={sp.plate ?? ""}
    />
  );
}

