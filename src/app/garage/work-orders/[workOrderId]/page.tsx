import { notFound } from "next/navigation";
import { WorkOrderDetailClient } from "@/components/garage/work-order-detail-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getWorkOrderDetail } from "@/lib/data/garage";
import { getGarageInventoryParts } from "@/lib/data/inventory";

interface WorkOrderDetailPageProps {
  params: Promise<{ workOrderId: string }>;
}

export default async function GarageWorkOrderDetailPage({
  params,
}: WorkOrderDetailPageProps) {
  const { workOrderId } = await params;
  const { garage, isManager } = await requireOnboardedGarage();
  const [detail, inventoryParts] = await Promise.all([
    getWorkOrderDetail(garage.id, workOrderId),
    getGarageInventoryParts(garage.id),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <WorkOrderDetailClient
      initialGarage={garage}
      initialWorkOrder={detail.workOrder}
      initialItems={detail.items}
      customer={detail.customer}
      initialVehicleMatch={detail.vehicleMatch}
      inventoryParts={inventoryParts}
      isManager={isManager}
    />
  );
}

