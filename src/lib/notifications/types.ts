import type { AppLocale } from "@/types/domain";

export type NotificationChannel = "email" | "sms" | "viber";

export interface OutboundMessagePayload {
  toEmail?: string | null;
  toPhone?: string | null;
  recipientName?: string | null;
  locale: AppLocale;
  subject: string;
  textBody: string;
  htmlBody?: string;
  actionUrl?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ProviderDeliveryResult {
  ok: boolean;
  channel: NotificationChannel;
  provider: string;
  externalMessageId: string | null;
  simulated: boolean;
  error?: string;
}

/**
 * Pluggable Notification Provider Contract.
 * Email delivers live via HTTP (Resend API) with local dev fallback;
 * SMS & Viber implement the exact same interface with mock adapters ready for Twilio/Infobip.
 */
export interface NotificationProvider {
  readonly channel: NotificationChannel;
  readonly providerName: string;
  send(payload: OutboundMessagePayload): Promise<ProviderDeliveryResult>;
}

