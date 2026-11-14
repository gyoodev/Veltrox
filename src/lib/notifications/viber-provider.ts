import { normalizePhoneE164 } from "@/lib/notifications/sms-provider";
import type {
  NotificationProvider,
  OutboundMessagePayload,
  ProviderDeliveryResult,
} from "@/lib/notifications/types";

export function isViberConfigured(): boolean {
  return Boolean(process.env.VIBER_AUTH_TOKEN?.trim());
}

/**
 * Pluggable Viber Provider backed by Viber PA / Business Messages REST API
 * with safe simulation fallback when `VIBER_AUTH_TOKEN` is unset.
 */
export class ViberNotificationProvider implements NotificationProvider {
  readonly channel = "viber" as const;
  readonly providerName = isViberConfigured()
    ? "viber-business"
    : "mock-viber-business";

  async send(payload: OutboundMessagePayload): Promise<ProviderDeliveryResult> {
    const receiver = normalizePhoneE164(payload.toPhone);
    if (!receiver) {
      return {
        ok: false,
        channel: this.channel,
        provider: this.providerName,
        externalMessageId: null,
        simulated: false,
        error: "MISSING_RECIPIENT_PHONE",
      };
    }

    const authToken = process.env.VIBER_AUTH_TOKEN?.trim();
    if (!authToken) {
      const simulatedId = `sim_viber_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.info(
        `[Veltrox Viber Mock] -> ${receiver} | ${payload.subject}: ${payload.textBody.slice(0, 120)}`
      );
      return {
        ok: true,
        channel: this.channel,
        provider: "viber_simulated",
        externalMessageId: simulatedId,
        simulated: true,
      };
    }

    const endpoint =
      process.env.VIBER_API_URL?.trim() ||
      "https://chatapi.viber.com/pa/send_message";
    const senderName = process.env.VIBER_SENDER_NAME?.trim() || "Veltrox";

    const text = payload.actionUrl
      ? `${payload.subject}\n\n${payload.textBody}\n${payload.actionUrl}`
      : `${payload.subject}\n\n${payload.textBody}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Viber-Auth-Token": authToken,
        },
        body: JSON.stringify({
          receiver,
          min_api_version: 1,
          sender: { name: senderName },
          type: "text",
          text: text.slice(0, 7000),
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        status?: number;
        status_message?: string;
        message_token?: string | number;
      } | null;

      if (!res.ok || (data && typeof data.status === "number" && data.status !== 0)) {
        return {
          ok: false,
          channel: this.channel,
          provider: "viber-business",
          externalMessageId: null,
          simulated: false,
          error: data?.status_message || `VIBER_${res.status}`,
        };
      }

      return {
        ok: true,
        channel: this.channel,
        provider: "viber-business",
        externalMessageId: data?.message_token ? String(data.message_token) : null,
        simulated: false,
      };
    } catch (err) {
      return {
        ok: false,
        channel: this.channel,
        provider: "viber-business",
        externalMessageId: null,
        simulated: false,
        error: err instanceof Error ? err.message : "VIBER_REQUEST_FAILED",
      };
    }
  }
}

export const MockViberNotificationProvider = ViberNotificationProvider;
