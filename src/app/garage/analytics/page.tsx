import { GarageAnalyticsClient } from "@/components/garage/garage-analytics-client";
import { computeGarageAnalytics } from "@/lib/analytics-metrics";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import {
  getGarageWorkOrderItems,
  getGarageWorkspaceBundle,
} from "@/lib/data/garage";
import { getGarageInventoryParts } from "@/lib/data/inventory";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";

export default async function GarageAnalyticsPage() {
  const { garage } = await requireOnboardedGarage();

  const [bundle, workOrderItems, inventoryParts] = await Promise.all([
    getGarageWorkspaceBundle(garage.id),
    getGarageWorkOrderItems(garage.id),
    getGarageInventoryParts(garage.id),
  ]);

  const analytics = computeGarageAnalytics({
    workOrders: bundle.workOrders,
    workOrderItems,
    customers: bundle.customers,
    reminders: bundle.reminders,
    inventoryParts,
  });

  const quota = getEffectiveReminderQuota(garage);

  return (
    <GarageAnalyticsClient
      analytics={analytics}
      quota={{
        used: quota.used,
        quota: quota.quota,
        remaining: quota.remaining,
      }}
    />
  );
}

