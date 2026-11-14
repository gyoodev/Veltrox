import { InventoryManagementClient } from "@/components/garage/inventory-management-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getGarageInventoryParts } from "@/lib/data/inventory";

export default async function GarageInventoryPage() {
  const { garage } = await requireOnboardedGarage();
  const parts = await getGarageInventoryParts(garage.id);

  return (
    <InventoryManagementClient
      initialParts={parts}
      currency={garage.plan === "pro" ? "EUR" : "EUR"}
    />
  );
}

