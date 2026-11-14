import { NextResponse } from "next/server";
import { verifyStripeWebhookSignature } from "@/lib/billing/stripe";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

interface StripeWebhookEvent {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const sigHeader = request.headers.get("stripe-signature");

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  if (!verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody) as StripeWebhookEvent;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const obj = event.data?.object ?? {};
  const metadata = (obj.metadata as Record<string, unknown> | undefined) ?? {};
  const target =
    metadata.target === "user" || metadata.target === "garage"
      ? metadata.target
      : null;
  const targetId =
    typeof metadata.targetId === "string" ? metadata.targetId : null;
  const cycle =
    metadata.cycle === "annual" || metadata.cycle === "monthly"
      ? metadata.cycle
      : "monthly";

  if (event.type === "checkout.session.completed" && target && targetId) {
    const collection = target === "user" ? "users" : "garages";
    const updates: Record<string, unknown> = {
      plan: "pro",
      subscriptionStatus: "active",
      billingCycle: cycle,
      stripeCustomerId: typeof obj.customer === "string" ? obj.customer : null,
      stripeSubscriptionId:
        typeof obj.subscription === "string" ? obj.subscription : null,
      planUpdatedAt: nowIso,
      updatedAt: nowIso,
    };
    if (collection === "garages") {
      updates.monthlyReminderQuota = 500;
    }

    await admin.adminDb.collection(collection).doc(targetId).update(updates);
    await admin.adminDb.collection("auditLogs").add({
      action: "BILLING_SUBSCRIPTION_UPDATED",
      actorUid: "SYSTEM",
      actorRole: "SYSTEM",
      targetUid: target === "user" ? targetId : null,
      targetGarageId: target === "garage" ? targetId : null,
      metadata: {
        eventType: event.type,
        plan: "pro",
        cycle,
        stripeEventId: event.id ?? null,
      },
      createdAt: nowIso,
    });
  } else if (
    (event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted") &&
    target &&
    targetId
  ) {
    const collection = target === "user" ? "users" : "garages";
    const statusRaw = typeof obj.status === "string" ? obj.status : "canceled";
    const isCancelled =
      event.type === "customer.subscription.deleted" ||
      statusRaw === "canceled" ||
      statusRaw === "unpaid" ||
      statusRaw === "incomplete_expired";

    const nextPlan = isCancelled ? "free" : "pro";
    const updates: Record<string, unknown> = {
      plan: nextPlan,
      subscriptionStatus:
        statusRaw === "active" ||
        statusRaw === "trialing" ||
        statusRaw === "past_due" ||
        statusRaw === "canceled"
          ? statusRaw
          : isCancelled
            ? "canceled"
            : "inactive",
      planUpdatedAt: nowIso,
      updatedAt: nowIso,
    };
    if (collection === "garages") {
      updates.monthlyReminderQuota = nextPlan === "pro" ? 500 : 20;
    }

    await admin.adminDb.collection(collection).doc(targetId).update(updates);
    await admin.adminDb.collection("auditLogs").add({
      action: "BILLING_SUBSCRIPTION_UPDATED",
      actorUid: "SYSTEM",
      actorRole: "SYSTEM",
      targetUid: target === "user" ? targetId : null,
      targetGarageId: target === "garage" ? targetId : null,
      metadata: {
        eventType: event.type,
        plan: nextPlan,
        subscriptionStatus: statusRaw,
        stripeEventId: event.id ?? null,
      },
      createdAt: nowIso,
    });
  }

  return NextResponse.json({ received: true });
}

