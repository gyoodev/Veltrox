import { notFound } from "next/navigation";
import { CustomerHistoryClient } from "@/components/garage/customers-lookup-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getCustomerDetail } from "@/lib/data/garage";

interface CustomerHistoryPageProps {
  params: Promise<{ customerId: string }>;
}

export default async function GarageCustomerHistoryPage({
  params,
}: CustomerHistoryPageProps) {
  const { customerId } = await params;
  const { garage } = await requireOnboardedGarage();
  const detail = await getCustomerDetail(garage.id, customerId);

  if (!detail) {
    notFound();
  }

  return (
    <CustomerHistoryClient
      customer={detail.customer}
      workOrders={detail.workOrders}
      tyreSets={detail.tyreSets}
      vehicleMatches={detail.vehicleMatches}
    />
  );
}

