import { CustomersLookupClient } from "@/components/garage/customers-lookup-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getGarageWorkspaceBundle } from "@/lib/data/garage";

export default async function GarageCustomersPage() {
  const { garage, isManager } = await requireOnboardedGarage();
  const bundle = await getGarageWorkspaceBundle(garage.id);

  return (
    <CustomersLookupClient
      initialCustomers={bundle.customers}
      isManager={isManager}
    />
  );
}

