import type {
  NotificationProvider,
  OutboundMessagePayload,
  ProviderDeliveryResult,
} from "@/lib/notifications/types";

export function isTwilioSmsConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from =
    process.env.TWILIO_FROM_NUMBER?.trim() ||
    process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  return Boolean(sid && token && from);
}

/**
 * Normalizes local Bulgarian numbers (`0888123456` / `00359...`) to E.164 (`+359...`).
 */
export function normalizePhoneE164(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const cleaned = rawPhone.trim().replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith("0") && cleaned.length >= 9) {
    return `+359${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("359") && cleaned.length >= 11) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Pluggable SMS Provider backed by Twilio REST API with safe simulation fallback
 * when `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` are unset.
 */
export class SmsNotificationProvider implements NotificationProvider {
  readonly channel = "sms" as const;
  readonly providerName = isTwilioSmsConfigured()
    ? "twilio-sms"
    : "mock-sms-gateway";

  async send(payload: OutboundMessagePayload): Promise<ProviderDeliveryResult> {
    const toPhone = normalizePhoneE164(payload.toPhone);
    if (!toPhone) {
      return {
        ok: false,
        channel: this.channel,
        provider: this.providerName,
        externalMessageId: null,
        simulated: false,
        error: "MISSING_RECIPIENT_PHONE",
      };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
      const simulatedId = `sim_sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.info(
        `[Veltrox SMS Mock] -> ${toPhone} | ${payload.subject}: ${payload.textBody.slice(0, 120)}`
      );
      return {
        ok: true,
        channel: this.channel,
        provider: "twilio_simulated",
        externalMessageId: simulatedId,
        simulated: true,
      };
    }

    const bodyText = payload.actionUrl
      ? `${payload.subject}\n${payload.textBody}\n${payload.actionUrl}`
      : `${payload.subject}\n${payload.textBody}`;

    const form = new URLSearchParams();
    form.append("To", toPhone);
    form.append("Body", bodyText.slice(0, 1500));
    if (messagingServiceSid) {
      form.append("MessagingServiceSid", messagingServiceSid);
    } else if (fromNumber) {
      form.append("From", fromNumber);
    }

    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString(
      "base64"
    );

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        }
      );

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return {
          ok: false,
          channel: this.channel,
          provider: "twilio-sms",
          externalMessageId: null,
          simulated: false,
          error: `TWILIO_${res.status}: ${errBody.slice(0, 180)}`,
        };
      }

      const data = (await res.json()) as { sid?: string };
      return {
        ok: true,
        channel: this.channel,
        provider: "twilio-sms",
        externalMessageId: data.sid ?? null,
        simulated: false,
      };
    } catch (err) {
      return {
        ok: false,
        channel: this.channel,
        provider: "twilio-sms",
        externalMessageId: null,
        simulated: false,
        error: err instanceof Error ? err.message : "TWILIO_REQUEST_FAILED",
      };
    }
  }
}

export const MockSmsNotificationProvider = SmsNotificationProvider;
