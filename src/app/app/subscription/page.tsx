import { WorkspaceSubscriptionView } from "@/components/shared/workspace-subscription-view";
import { requireRole } from "@/lib/auth/server-auth";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

interface UserSubscriptionPageProps {
  searchParams: Promise<{ billing?: string }>;
}

export default async function UserSubscriptionPage({
  searchParams,
}: UserSubscriptionPageProps) {
  const [{ profile }, settings, sp] = await Promise.all([
    requireRole(["USER", "ADMIN"]),
    getPlatformSettings(),
    searchParams,
  ]);

  let vehicleCount = 0;
  const admin = getFirebaseAdmin();
  if (admin) {
    const snap = await admin.adminDb
      .collection("vehicles")
      .where("ownerId", "==", profile.uid)
      .select("id")
      .get();
    vehicleCount = snap.size;
  }

  const billingState =
    sp.billing === "success"
      ? "success"
      : sp.billing === "cancel"
        ? "cancel"
        : null;

  return (
    <WorkspaceSubscriptionView
      target="user"
      entityLabel={profile.displayName}
      currentPlan={profile.plan ?? "free"}
      subscriptionStatus={profile.subscriptionStatus ?? null}
      billingCycle={profile.billingCycle ?? null}
      planUpdatedAt={profile.planUpdatedAt ?? null}
      stripeCustomerId={profile.stripeCustomerId ?? null}
      settings={settings}
      usageMetrics={{
        primaryUsed: vehicleCount,
        primaryLimit:
          (profile.plan ?? "free") === "pro"
            ? null
            : settings.freeUserVehicleLimit,
      }}
      backHref="/app"
      billingQueryState={billingState}
    />
  );
}

