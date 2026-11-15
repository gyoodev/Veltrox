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

interface GarageProToolsPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function GarageProToolsPage({
  searchParams,
}: GarageProToolsPageProps) {
  const [{ garage }, resolvedSearch] = await Promise.all([
    requireGarageManagerPage(),
    searchParams ?? Promise.resolve<{ tab?: string }>({}),
  ]);

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
      appointments={bundle.appointments}
      tyreSets={bundle.tyreSets}
      staff={bundle.staff}
      initialQuota={{
        used: quota.used,
        quota: quota.quota,
        remaining: quota.remaining,
      }}
      settings={settings}
      initialTab={resolvedSearch.tab}
    />
  );
}

