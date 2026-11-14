import { PlatformSettingsClient } from "@/components/admin/platform-settings-client";
import { requireRole } from "@/lib/auth/server-auth";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { isWebPushConfigured } from "@/lib/notifications/push-provider";
import { isTwilioSmsConfigured } from "@/lib/notifications/sms-provider";
import { isViberConfigured } from "@/lib/notifications/viber-provider";

export default async function AdminSettingsPage() {
  await requireRole(["ADMIN"]);
  const settings = await getPlatformSettings();

  return (
    <PlatformSettingsClient
      initialSettings={settings}
      integrationStatus={{
        stripe: isStripeConfigured(),
        email: Boolean(process.env.RESEND_API_KEY?.trim()),
        sms: isTwilioSmsConfigured(),
        viber: isViberConfigured(),
        webPush: isWebPushConfigured(),
      }}
    />
  );
}

