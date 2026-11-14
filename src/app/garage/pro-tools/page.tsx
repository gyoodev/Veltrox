import { GarageProToolsClient } from "@/components/garage/garage-pro-tools-client";
import { requireGarageManagerPage } from "@/lib/auth/server-auth";
import {
  getGarageWorkOrderItems,
  getGarageWorkspaceBundle,
} from "@/lib/data/garage";
import { getGarageInventoryParts } from "@/lib/data/inventory";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import { isGaragePro } from "@/lib/subscriptions/entitlements";

export default async function GarageProToolsPage() {
  const { garage } = await requireGarageManagerPage();

  const [bundle, workOrderItems, inventoryParts, settings] = await Promise.all([
    getGarageWorkspaceBundle(garage.id),
    getGarageWorkOrderItems(garage.id),
    getGarageInventoryParts(garage.id),
    getPlatformSettings(),
  ]);

  const quota = getEffectiveReminderQuota(garage);

  return (
    <GarageProToolsClient
      garage={garage}
      isPro={isGaragePro(garage)}
      workOrders={bundle.workOrders}
      workOrderItems={workOrderItems}
      initialParts={inventoryParts}
      customers={bundle.customers}
      initialQuota={{
        used: quota.used,
        quota: quota.quota,
        remaining: quota.remaining,
      }}
      settings={settings}
    />
  );
}

