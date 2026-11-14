import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { calculateBillingQuote } from "@/lib/billing/quote";
import {
  createStripeCheckoutSession,
  isStripeConfigured,
} from "@/lib/billing/stripe";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  target: z.enum(["user", "garage"]),
  action: z.enum(["preview", "checkout", "cancel"]).default("checkout"),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
  promoCode: z.string().trim().max(32).optional().nullable(),
});

function resolveRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { target, action, cycle, promoCode } = parsed.data;
  const settings = await getPlatformSettings();

  let targetId = ctx.profile.uid;
  let targetCollection: "users" | "garages" = "users";
  let targetEmail = ctx.profile.email;
  let existingStripeCustomerId = ctx.profile.stripeCustomerId ?? null;

  if (target === "garage") {
    if (
      (ctx.profile.role !== "GARAGE_OWNER" && ctx.profile.role !== "ADMIN") ||
      ctx.profile.isStaff ||
      !ctx.profile.garageId
    ) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const garageSnap = await admin.adminDb
      .collection("garages")
      .doc(ctx.profile.garageId)
      .get();
    if (!garageSnap.exists) {
      return NextResponse.json({ error: "GARAGE_NOT_FOUND" }, { status: 404 });
    }
    const garageData = garageSnap.data() as {
      status?: string;
      email?: string;
      stripeCustomerId?: string | null;
    };
    if (garageData.status !== "approved" && ctx.profile.role !== "ADMIN") {
      return NextResponse.json({ error: "GARAGE_NOT_APPROVED" }, { status: 403 });
    }

    targetId = garageSnap.id;
    targetCollection = "garages";
    targetEmail = garageData.email || ctx.profile.email;
    existingStripeCustomerId = garageData.stripeCustomerId ?? null;
  }

  const quote = calculateBillingQuote({
    target,
    cycle,
    promoCode,
    settings,
  });

  if (action === "preview") {
    return NextResponse.json({
      ok: true,
      stripeConfigured: isStripeConfigured(),
      quote,
    });
  }

  const nowIso = new Date().toISOString();

  if (action === "cancel") {
    const updatePayload: Record<string, unknown> = {
      plan: "free",
      subscriptionStatus: "canceled",
      planUpdatedAt: nowIso,
      updatedAt: nowIso,
    };
    if (targetCollection === "garages") {
      updatePayload.monthlyReminderQuota = 20;
    }

    await admin.adminDb
      .collection(targetCollection)
      .doc(targetId)
      .update(updatePayload);

    await admin.adminDb.collection("auditLogs").add({
      action: "BILLING_SUBSCRIPTION_UPDATED",
      actorUid: ctx.profile.uid,
      actorRole: ctx.profile.role,
      targetUid: target === "user" ? targetId : null,
      targetGarageId: target === "garage" ? targetId : null,
      metadata: {
        target,
        plan: "free",
        subscriptionStatus: "canceled",
        mode: "self_serve",
      },
      createdAt: nowIso,
    });

    return NextResponse.json({
      ok: true,
      mode: "simulated",
      plan: "free",
      subscriptionStatus: "canceled",
    });
  }

  // action === "checkout"
  if (target === "user" && !settings.userSubscriptionsEnabled) {
    return NextResponse.json(
      { error: "SUBSCRIPTIONS_DISABLED" },
      { status: 403 }
    );
  }
  if (target === "garage" && !settings.garageSubscriptionsEnabled) {
    return NextResponse.json(
      { error: "SUBSCRIPTIONS_DISABLED" },
      { status: 403 }
    );
  }

  const origin = resolveRequestOrigin(request);
  const returnPath = target === "user" ? "/app/profile" : "/garage/settings";
  const checkout = await createStripeCheckoutSession({
    target,
    targetId,
    actorUid: ctx.profile.uid,
    email: targetEmail,
    existingStripeCustomerId,
    cycle,
    finalTotalEur: quote.finalTotalEur,
    promoCode: quote.promoCodeMatched?.code ?? null,
    successUrl: `${origin}${returnPath}?billing=success`,
    cancelUrl: `${origin}${returnPath}?billing=cancel`,
  });

  if (checkout.mode === "stripe" && checkout.url) {
    await admin.adminDb.collection("auditLogs").add({
      action: "BILLING_CHECKOUT_STARTED",
      actorUid: ctx.profile.uid,
      actorRole: ctx.profile.role,
      targetUid: target === "user" ? targetId : null,
      targetGarageId: target === "garage" ? targetId : null,
      metadata: {
        target,
        cycle,
        finalTotalEur: quote.finalTotalEur,
        promoCode: quote.promoCodeMatched?.code ?? null,
        sessionId: checkout.sessionId,
      },
      createdAt: nowIso,
    });

    return NextResponse.json({
      ok: true,
      mode: "stripe",
      url: checkout.url,
      quote,
    });
  }

  // Simulated instant activation when STRIPE_SECRET_KEY is unset or 100%-off promo
  const updatePayload: Record<string, unknown> = {
    plan: "pro",
    subscriptionStatus: "active",
    billingCycle: cycle,
    planUpdatedAt: nowIso,
    updatedAt: nowIso,
  };
  if (targetCollection === "garages") {
    updatePayload.monthlyReminderQuota = 500;
  }

  await admin.adminDb
    .collection(targetCollection)
    .doc(targetId)
    .update(updatePayload);

  await admin.adminDb.collection("auditLogs").add({
    action: "BILLING_SUBSCRIPTION_UPDATED",
    actorUid: ctx.profile.uid,
    actorRole: ctx.profile.role,
    targetUid: target === "user" ? targetId : null,
    targetGarageId: target === "garage" ? targetId : null,
    metadata: {
      target,
      plan: "pro",
      cycle,
      finalTotalEur: quote.finalTotalEur,
      promoCode: quote.promoCodeMatched?.code ?? null,
      mode: "simulated",
    },
    createdAt: nowIso,
  });

  return NextResponse.json({
    ok: true,
    mode: "simulated",
    activated: true,
    plan: "pro",
    billingCycle: cycle,
    subscriptionStatus: "active",
    quote,
  });
}

