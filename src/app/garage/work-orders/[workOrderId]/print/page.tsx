import { notFound } from "next/navigation";
import { WorkOrderPrintView } from "@/components/garage/work-order-print-view";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getWorkOrderDetail } from "@/lib/data/garage";

interface WorkOrderPrintPageProps {
  params: Promise<{ workOrderId: string }>;
  searchParams: Promise<{ doc?: string }>;
}

export default async function GarageWorkOrderPrintPage({
  params,
  searchParams,
}: WorkOrderPrintPageProps) {
  const [{ workOrderId }, { doc }] = await Promise.all([params, searchParams]);
  const { garage } = await requireOnboardedGarage();
  const detail = await getWorkOrderDetail(garage.id, workOrderId);

  if (!detail) {
    notFound();
  }

  return (
    <WorkOrderPrintView
      garage={garage}
      workOrder={detail.workOrder}
      items={detail.items}
      customer={detail.customer}
      initialMode={doc === "intake" ? "intake" : "invoice"}
    />
  );
}

