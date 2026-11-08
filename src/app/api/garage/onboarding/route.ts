import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  EDGE_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signEdgeSession,
} from "@/lib/auth/edge-session";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getCurrentMonthKey, slugifyGarageName } from "@/lib/garage-utils";
import { garageOnboardingSchema } from "@/lib/validators/garage";
import type { Garage } from "@/types/domain";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.profile.role !== "GARAGE_OWNER" || ctx.profile.isStaff) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (ctx.profile.garageStatus !== "approved") {
    return NextResponse.json({ error: "GARAGE_NOT_APPROVED" }, { status: 403 });
  }

  if (ctx.profile.garageId) {
    return NextResponse.json(
      { error: "ALREADY_ONBOARDED", garageId: ctx.profile.garageId },
      { status: 409 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = garageOnboardingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const uid = ctx.session.uid;

  // Ensure unique SEO slug
  const baseSlug = slugifyGarageName(data.name);
  let slug = baseSlug;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existingSlug = await admin.adminDb
      .collection("garages")
      .where("slug", "==", slug)
      .limit(1)
      .get();
    if (existingSlug.empty) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const garageRef = admin.adminDb.collection("garages").doc();
  const garageId = garageRef.id;
  const nowIso = new Date().toISOString();

  const garage: Garage = {
    id: garageId,
    ownerUid: uid,
    name: data.name,
    slug,
    description:
      data.description && data.description.trim().length > 0
        ? data.description.trim()
        : null,
    address: data.address,
    city: data.city,
    phone: data.phone,
    email: data.email,
    logoUrl: data.logoUrl ?? null,
    logoStoragePath: data.logoStoragePath ?? null,
    workingHours: data.workingHours,
    servicesOffered: Array.from(new Set(data.servicesOffered)),
    plan: "free",
    monthlyReminderQuota: 50,
    monthlyRemindersUsed: 0,
    quotaResetMonth: getCurrentMonthKey(),
    status: "approved",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await garageRef.set(garage);

  await admin.adminDb.collection("users").doc(uid).update({
    garageId,
    updatedAt: nowIso,
  });

  await admin.adminAuth.setCustomUserClaims(uid, {
    role: "GARAGE_OWNER",
    garageStatus: "approved",
    garageId,
  });

  await admin.adminDb.collection("auditLogs").add({
    action: "GARAGE_ONBOARDED",
    actorUid: uid,
    actorRole: "GARAGE_OWNER",
    targetUid: uid,
    targetGarageId: garageId,
    metadata: {
      garageName: garage.name,
      slug: garage.slug,
      city: garage.city,
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  const edgeSessionToken = await signEdgeSession({
    uid,
    email: ctx.profile.email,
    emailVerified: ctx.profile.emailVerified,
    role: "GARAGE_OWNER",
    garageStatus: "approved",
    garageId,
  });

  const response = NextResponse.json({ garage }, { status: 201 });
  response.cookies.set(EDGE_SESSION_COOKIE, edgeSessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

