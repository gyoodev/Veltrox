import { WorkspaceSubscriptionView } from "@/components/shared/workspace-subscription-view";
import { requireGarageManagerPage } from "@/lib/auth/server-auth";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";

interface GarageSubscriptionPageProps {
  searchParams: Promise<{ billing?: string }>;
}

export default async function GarageSubscriptionPage({
  searchParams,
}: GarageSubscriptionPageProps) {
  const [{ garage }, settings, sp] = await Promise.all([
    requireGarageManagerPage(),
    getPlatformSettings(),
    searchParams,
  ]);

  const monthPrefix = new Date().toISOString().slice(0, 7);
  let monthlyWorkOrders = 0;

  const admin = getFirebaseAdmin();
  if (admin) {
    const ordersSnap = await admin.adminDb
      .collection("workOrders")
      .where("garageId", "==", garage.id)
      .select("createdAt")
      .get();

    monthlyWorkOrders = ordersSnap.docs.filter((doc) => {
      const createdAt = doc.data()?.createdAt;
      return typeof createdAt === "string" && createdAt.startsWith(monthPrefix);
    }).length;
  }

  const quotaInfo = getEffectiveReminderQuota(garage);
  const billingState =
    sp.billing === "success"
      ? "success"
      : sp.billing === "cancel"
        ? "cancel"
        : null;

  return (
    <WorkspaceSubscriptionView
      target="garage"
      entityLabel={garage.name}
      currentPlan={garage.plan}
      subscriptionStatus={garage.subscriptionStatus ?? null}
      billingCycle={garage.billingCycle ?? null}
      planUpdatedAt={garage.planUpdatedAt ?? null}
      stripeCustomerId={garage.stripeCustomerId ?? null}
      settings={settings}
      usageMetrics={{
        primaryUsed: monthlyWorkOrders,
        primaryLimit:
          garage.plan === "pro" ? null : settings.freeGarageMonthlyWorkOrders,
        secondaryUsed: quotaInfo.used,
        secondaryQuota: quotaInfo.quota,
      }}
      backHref="/garage"
      billingQueryState={billingState}
    />
  );
}

