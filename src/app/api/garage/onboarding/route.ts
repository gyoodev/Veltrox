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
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

  const ctx = await getCurrentAuthContext();
  if (
    !ctx ||
    (ctx.profile.role !== "GARAGE_OWNER" && ctx.profile.role !== "ADMIN") ||
    ctx.profile.isStaff
  ) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (
    ctx.profile.role === "GARAGE_OWNER" &&
    ctx.profile.garageStatus === "rejected"
  ) {
    return NextResponse.json({ error: "GARAGE_REJECTED" }, { status: 403 });
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

  // Check if garage already exists for this user (either via ctx.profile.garageId or ownerUid)
  let existingGarageId = ctx.profile.garageId ?? null;
  let existingGarageDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  if (existingGarageId) {
    const docSnap = await admin.adminDb
      .collection("garages")
      .doc(existingGarageId)
      .get();
    if (docSnap.exists) {
      existingGarageDoc = docSnap;
    }
  }

  if (!existingGarageDoc) {
    const ownerQuery = await admin.adminDb
      .collection("garages")
      .where("ownerUid", "==", uid)
      .limit(1)
      .get();
    if (!ownerQuery.empty && ownerQuery.docs[0]) {
      existingGarageDoc = ownerQuery.docs[0];
      existingGarageId = existingGarageDoc.id;
    }
  }

  const garageId =
    existingGarageId ?? admin.adminDb.collection("garages").doc().id;
  const garageRef = admin.adminDb.collection("garages").doc(garageId);
  const existingData = existingGarageDoc?.data() as Partial<Garage> | undefined;
  const nowIso = new Date().toISOString();

  // Ensure unique SEO slug
  const baseSlug = slugifyGarageName(data.name);
  let slug = existingData?.slug || baseSlug;
  if (!existingData || existingData.name !== data.name) {
    slug = baseSlug;
    let suffix = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existingSlug = await admin.adminDb
        .collection("garages")
        .where("slug", "==", slug)
        .limit(1)
        .get();
      if (existingSlug.empty || existingSlug.docs[0]?.id === garageId) break;
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  const finalLogoUrl =
    data.logoUrl !== undefined ? data.logoUrl : (existingData?.logoUrl ?? null);
  const finalLogoStoragePath =
    data.logoStoragePath !== undefined
      ? data.logoStoragePath
      : (existingData?.logoStoragePath ?? null);

  const garage: Garage = {
    id: garageId,
    ownerUid: existingData?.ownerUid || uid,
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
    logoUrl: finalLogoUrl,
    logoStoragePath: finalLogoStoragePath,
    workingHours: data.workingHours,
    servicesOffered: Array.from(new Set(data.servicesOffered)),
    plan: existingData?.plan ?? "free",
    monthlyReminderQuota: existingData?.monthlyReminderQuota ?? 50,
    monthlyRemindersUsed: existingData?.monthlyRemindersUsed ?? 0,
    quotaResetMonth: existingData?.quotaResetMonth ?? getCurrentMonthKey(),
    status: existingData?.status ?? "approved",
    createdAt: existingData?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  await garageRef.set(garage, { merge: true });

  await admin.adminDb.collection("users").doc(uid).set(
    {
      garageId,
      garageStatus: "approved",
      updatedAt: nowIso,
    },
    { merge: true }
  );

  try {
    await admin.adminAuth.setCustomUserClaims(uid, {
      role: ctx.profile.role,
      garageStatus: "approved",
      garageId,
    });
  } catch (claimErr) {
    console.warn(
      "Could not set custom user claims during garage onboarding:",
      claimErr
    );
  }

  await admin.adminDb.collection("auditLogs").add({
    action: existingGarageDoc ? "GARAGE_UPDATED" : "GARAGE_ONBOARDED",
    actorUid: uid,
    actorRole: ctx.profile.role,
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
    role: ctx.profile.role,
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
  } catch (error) {
    console.error("Garage onboarding failed with uncaught exception:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "INTERNAL_ERROR",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

