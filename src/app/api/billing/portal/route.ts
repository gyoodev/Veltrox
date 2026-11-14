import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { createStripePortalSession } from "@/lib/billing/stripe";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const portalSchema = z.object({
  target: z.enum(["user", "garage"]),
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
  const parsed = portalSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED" },
      { status: 400 }
    );
  }

  const { target } = parsed.data;
  let stripeCustomerId: string | null = ctx.profile.stripeCustomerId ?? null;

  if (target === "garage") {
    if (
      (ctx.profile.role !== "GARAGE_OWNER" && ctx.profile.role !== "ADMIN") ||
      ctx.profile.isStaff ||
      !ctx.profile.garageId
    ) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const gSnap = await admin.adminDb
      .collection("garages")
      .doc(ctx.profile.garageId)
      .get();
    if (!gSnap.exists) {
      return NextResponse.json({ error: "GARAGE_NOT_FOUND" }, { status: 404 });
    }
    stripeCustomerId =
      (gSnap.data() as { stripeCustomerId?: string | null }).stripeCustomerId ??
      null;
  }

  const origin = resolveRequestOrigin(request);
  const returnUrl =
    target === "user" ? `${origin}/app/profile` : `${origin}/garage/settings`;

  const portal = await createStripePortalSession({
    stripeCustomerId,
    returnUrl,
  });

  return NextResponse.json({
    ok: true,
    mode: portal.mode,
    url: portal.url,
  });
}

