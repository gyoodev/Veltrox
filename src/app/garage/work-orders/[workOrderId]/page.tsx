import { notFound } from "next/navigation";
import { WorkOrderDetailClient } from "@/components/garage/work-order-detail-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getWorkOrderDetail } from "@/lib/data/garage";

interface WorkOrderDetailPageProps {
  params: Promise<{ workOrderId: string }>;
}

export default async function GarageWorkOrderDetailPage({
  params,
}: WorkOrderDetailPageProps) {
  const { workOrderId } = await params;
  const { garage, isManager } = await requireOnboardedGarage();
  const detail = await getWorkOrderDetail(garage.id, workOrderId);

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
      isManager={isManager}
    />
  );
}

