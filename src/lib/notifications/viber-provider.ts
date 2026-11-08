import type {
  NotificationProvider,
  OutboundMessagePayload,
  ProviderDeliveryResult,
} from "@/lib/notifications/types";

const PHONE_PATTERN = /^\+?[0-9\s\-()]{7,22}$/;

/**
 * Viber Business Messages Provider Interface & Mock Implementation.
 * Implements the shared `NotificationProvider` contract for Bulgarian/European workshops
 * where Viber is widely used alongside Email and SMS.
 */
export class MockViberNotificationProvider implements NotificationProvider {
  public readonly channel = "viber" as const;
  public readonly providerName = "mock-viber-business";

  public async send(
    payload: OutboundMessagePayload
  ): Promise<ProviderDeliveryResult> {
    const phone = payload.toPhone?.trim();
    if (!phone || !PHONE_PATTERN.test(phone)) {
      return {
        ok: false,
        channel: "viber",
        provider: this.providerName,
        externalMessageId: null,
        simulated: true,
        error: "INVALID_OR_MISSING_RECIPIENT_PHONE",
      };
    }

    return {
      ok: true,
      channel: "viber",
      provider: this.providerName,
      externalMessageId: `mock-viber-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      simulated: true,
    };
  }
}

