import type {
  NotificationProvider,
  OutboundMessagePayload,
  ProviderDeliveryResult,
} from "@/lib/notifications/types";

const PHONE_PATTERN = /^\+?[0-9\s\-()]{7,22}$/;

/**
 * SMS Provider Interface & Mock Implementation.
 * Validates phone E.164/local formatting and simulates gateway acknowledgement.
 * Drop-in ready for Twilio / Infobip / MessageBird credentials in production.
 */
export class MockSmsNotificationProvider implements NotificationProvider {
  public readonly channel = "sms" as const;
  public readonly providerName = "mock-sms-gateway";

  public async send(
    payload: OutboundMessagePayload
  ): Promise<ProviderDeliveryResult> {
    const phone = payload.toPhone?.trim();
    if (!phone || !PHONE_PATTERN.test(phone)) {
      return {
        ok: false,
        channel: "sms",
        provider: this.providerName,
        externalMessageId: null,
        simulated: true,
        error: "INVALID_OR_MISSING_RECIPIENT_PHONE",
      };
    }

    return {
      ok: true,
      channel: "sms",
      provider: this.providerName,
      externalMessageId: `mock-sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      simulated: true,
    };
  }
}

