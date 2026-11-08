import { TyreStorageClient } from "@/components/garage/tyre-storage-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getGarageWorkspaceBundle } from "@/lib/data/garage";

export default async function GarageTyresPage() {
  const { garage } = await requireOnboardedGarage();
  const bundle = await getGarageWorkspaceBundle(garage.id);

  return (
    <TyreStorageClient
      initialTyreSets={bundle.tyreSets}
      customers={bundle.customers}
    />
  );
}

