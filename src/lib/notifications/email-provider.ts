import type {
  NotificationProvider,
  OutboundMessagePayload,
  ProviderDeliveryResult,
} from "@/lib/notifications/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Production HTTP Email Provider (Resend REST API compatible).
 * When `RESEND_API_KEY` is configured, dispatches live transactional emails.
 * When unset in local/dev environments, executes a clean structured simulation
 * so reminder workflows can be verified end-to-end without external credentials.
 */
export class EmailNotificationProvider implements NotificationProvider {
  public readonly channel = "email" as const;
  public readonly providerName = "resend-http";

  public async send(
    payload: OutboundMessagePayload
  ): Promise<ProviderDeliveryResult> {
    const to = payload.toEmail?.trim();
    if (!to || !EMAIL_PATTERN.test(to)) {
      return {
        ok: false,
        channel: "email",
        provider: this.providerName,
        externalMessageId: null,
        simulated: false,
        error: "INVALID_OR_MISSING_RECIPIENT_EMAIL",
      };
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail =
      process.env.NOTIFICATION_FROM_EMAIL?.trim() ||
      "Veltrox <notifications@veltrox.app>";

    if (!apiKey) {
      return {
        ok: true,
        channel: "email",
        provider: `${this.providerName}:simulated`,
        externalMessageId: `sim-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        simulated: true,
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: payload.subject,
          text: payload.textBody,
          ...(payload.htmlBody ? { html: payload.htmlBody } : {}),
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "HTTP_ERROR");
        return {
          ok: false,
          channel: "email",
          provider: this.providerName,
          externalMessageId: null,
          simulated: false,
          error: `RESEND_${response.status}: ${errBody.slice(0, 180)}`,
        };
      }

      const json = (await response.json()) as { id?: string };
      return {
        ok: true,
        channel: "email",
        provider: this.providerName,
        externalMessageId: json.id ?? `resend-${Date.now()}`,
        simulated: false,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        channel: "email",
        provider: this.providerName,
        externalMessageId: null,
        simulated: false,
        error: err instanceof Error ? err.message : "EMAIL_NETWORK_ERROR",
      };
    }
  }
}

