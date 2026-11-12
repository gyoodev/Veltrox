import { AdminAnalyticsClient } from "@/components/admin/admin-analytics-client";
import { computeAdminPlatformAnalytics } from "@/lib/analytics-metrics";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminAnalyticsPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  const summary = computeAdminPlatformAnalytics({
    users: bundle.users,
    garages: bundle.garages,
    vehicles: bundle.vehicles,
    workOrders: bundle.workOrders,
    reminders: bundle.reminders,
    notifications: bundle.notifications,
    proPlanPriceEur: bundle.settings.proPlanPriceEur,
    userProPlanPriceEur: bundle.settings.userProPlanPriceEur,
    garageSubscriptionsEnabled: bundle.settings.garageSubscriptionsEnabled,
    userSubscriptionsEnabled: bundle.settings.userSubscriptionsEnabled,
  });

  return <AdminAnalyticsClient summary={summary} />;
}

