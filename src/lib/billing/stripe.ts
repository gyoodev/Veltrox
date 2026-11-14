import "server-only";

import crypto from "node:crypto";
import type { BillingCycle, BillingTarget } from "@/lib/billing/quote";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

function encodeFormBody(entries: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) {
    params.append(k, v);
  }
  return params.toString();
}

export interface CreateCheckoutSessionParams {
  target: BillingTarget;
  targetId: string;
  actorUid: string;
  email: string;
  existingStripeCustomerId?: string | null;
  cycle: BillingCycle;
  finalTotalEur: number;
  promoCode?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  mode: "stripe" | "simulated";
  sessionId: string;
  url: string | null;
}

/**
 * Creates a Stripe Checkout Session via REST API when STRIPE_SECRET_KEY is set,
 * or falls back cleanly to a local simulation handle when unconfigured.
 */
export async function createStripeCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const unitAmountCents = Math.round(Math.max(0, params.finalTotalEur) * 100);

  if (!secretKey || unitAmountCents <= 0) {
    return {
      mode: "simulated",
      sessionId: `sim_cs_${crypto.randomUUID().slice(0, 12)}`,
      url: null,
    };
  }

  const productName =
    params.target === "user" ? "Veltrox Driver Pro" : "Veltrox Garage Pro";

  const payload: Record<string, string> = {
    mode: "subscription",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: `${params.target}:${params.targetId}`,
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(Math.max(50, unitAmountCents)),
    "line_items[0][price_data][recurring][interval]":
      params.cycle === "annual" ? "year" : "month",
    "line_items[0][price_data][product_data][name]": productName,
    "line_items[0][quantity]": "1",
    "metadata[target]": params.target,
    "metadata[targetId]": params.targetId,
    "metadata[actorUid]": params.actorUid,
    "metadata[cycle]": params.cycle,
    "subscription_data[metadata][target]": params.target,
    "subscription_data[metadata][targetId]": params.targetId,
    "subscription_data[metadata][cycle]": params.cycle,
  };

  if (params.promoCode) {
    payload["metadata[promoCode]"] = params.promoCode;
  }

  if (
    params.existingStripeCustomerId &&
    !params.existingStripeCustomerId.startsWith("cus_sim_")
  ) {
    payload.customer = params.existingStripeCustomerId;
  } else if (params.email) {
    payload.customer_email = params.email;
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeFormBody(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Stripe Checkout failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: string; url?: string | null };
  return {
    mode: "stripe",
    sessionId: data.id,
    url: data.url ?? null,
  };
}

export async function createStripePortalSession(params: {
  stripeCustomerId?: string | null;
  returnUrl: string;
}): Promise<{ mode: "stripe" | "simulated"; url: string | null }> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const customerId = params.stripeCustomerId?.trim();

  if (!secretKey || !customerId || customerId.startsWith("cus_sim_")) {
    return {
      mode: "simulated",
      url: null,
    };
  }

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeFormBody({
      customer: customerId,
      return_url: params.returnUrl,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Stripe Portal failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { url?: string | null };
  return {
    mode: "stripe",
    url: data.url ?? null,
  };
}

/**
 * Verifies Stripe webhook HMAC-SHA256 signatures (`Stripe-Signature: t=...,v1=...`).
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const parts = signatureHeader.split(",");
  let timestampStr = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t" && v) timestampStr = v;
    if (k === "v1" && v) signatures.push(v);
  }

  if (!timestampStr || signatures.length === 0) return false;

  const timestamp = Number.parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestampStr}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  return signatures.some((sig) => {
    try {
      const actualBuf = Buffer.from(sig, "hex");
      return (
        actualBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(actualBuf, expectedBuf)
      );
    } catch {
      return false;
    }
  });
}

