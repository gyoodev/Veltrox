import { SubscriptionsManagementClient } from "@/components/admin/subscriptions-management-client";
import { requireRole } from "@/lib/auth/server-auth";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminSubscriptionsPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return (
    <SubscriptionsManagementClient
      initialUsers={bundle.users}
      initialGarages={bundle.garages}
      initialSettings={bundle.settings}
      stripeConfigured={isStripeConfigured()}
    />
  );
}

