import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { defaultLocale, isValidLocale, LOCALE_COOKIE_NAME } from "@/i18n/config";
import {
  EDGE_SESSION_COOKIE,
  FB_SESSION_COOKIE,
  getRoleHomePath,
  SESSION_MAX_AGE_SECONDS,
  signEdgeSession,
} from "@/lib/auth/edge-session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { createSessionRequestSchema } from "@/lib/validators/auth";
import type {
  GarageApprovalStatus,
  UserProfile,
  UserRole,
} from "@/types/domain";

export const runtime = "nodejs";

/**
 * POST /api/auth/session
 * Verifies a Firebase ID token, initializes or synchronizes the user's Firestore
 * profile + Firebase Custom Claims (strictly preventing privilege escalation),
 * and sets httpOnly session cookies for Server + Edge Middleware enforcement.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = createSessionRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { idToken, requestedRole, displayName, locale } = parsed.data;

  try {
    const decoded = await admin.adminAuth.verifyIdToken(idToken, true);
    const uid = decoded.uid;
    const email = decoded.email ?? "";
    const emailVerified = Boolean(decoded.email_verified);

    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    const resolvedLocale =
      locale ?? (isValidLocale(cookieLocale) ? cookieLocale : defaultLocale);

    const userRef = admin.adminDb.collection("users").doc(uid);
    const existingSnap = await userRef.get();
    const nowIso = new Date().toISOString();

    let profile: UserProfile;
    let claimsNeedSync = false;

    if (!existingSnap.exists) {
      // Brand-new account: only USER or GARAGE_OWNER is ever allowed here.
      const initialRole: UserRole =
        requestedRole === "GARAGE_OWNER" ? "GARAGE_OWNER" : "USER";
      const initialGarageStatus: GarageApprovalStatus =
        initialRole === "GARAGE_OWNER" ? "pending" : "none";

      const fallbackName =
        displayName ||
        decoded.name ||
        email.split("@")[0] ||
        "Veltrox User";

      profile = {
        uid,
        email,
        emailVerified,
        displayName: fallbackName.slice(0, 80),
        phone: decoded.phone_number ?? null,
        avatarUrl: decoded.picture ?? null,
        avatarStoragePath: null,
        role: initialRole,
        garageStatus: initialGarageStatus,
        garageRejectionReason: null,
        garageId: null,
        language: resolvedLocale,
        notificationPreferences: {
          emailReminders: true,
          serviceUpdates: true,
          documentExpiryAlerts: true,
          marketingEmails: false,
          preferredChannel: "email",
        },
        suspended: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await userRef.set(profile);
      claimsNeedSync = true;

      await admin.adminDb.collection("auditLogs").add({
        action: "USER_REGISTERED",
        actorUid: uid,
        actorRole: initialRole,
        targetUid: uid,
        targetGarageId: null,
        metadata: {
          role: initialRole,
          garageStatus: initialGarageStatus,
        },
        createdAt: nowIso,
        serverTimestamp: FieldValue.serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data() as UserProfile;

      if (existingData.suspended) {
        return NextResponse.json(
          { error: "ACCOUNT_SUSPENDED" },
          { status: 403 }
        );
      }

      profile = {
        ...existingData,
        email: email || existingData.email,
        emailVerified,
        updatedAt: nowIso,
      };

      if (existingData.emailVerified !== emailVerified) {
        await userRef.update({
          emailVerified,
          updatedAt: nowIso,
        });
      }

      if (
        decoded.role !== profile.role ||
        decoded.garageStatus !== profile.garageStatus ||
        (profile.garageId && decoded.garageId !== profile.garageId) ||
        Boolean(decoded.isStaff) !== Boolean(profile.isStaff)
      ) {
        claimsNeedSync = true;
      }
    }

    if (claimsNeedSync) {
      await admin.adminAuth.setCustomUserClaims(uid, {
        role: profile.role,
        garageStatus: profile.garageStatus,
        ...(profile.garageId ? { garageId: profile.garageId } : {}),
        ...(profile.isStaff
          ? { isStaff: true, staffRole: profile.staffRole ?? "mechanic" }
          : {}),
      });
    }

    const fbSessionCookie = await admin.adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const edgeSessionToken = await signEdgeSession({
      uid: profile.uid,
      email: profile.email,
      emailVerified: profile.emailVerified,
      role: profile.role,
      garageStatus: profile.garageStatus,
      garageId: profile.garageId ?? null,
    });

    const isProd = process.env.NODE_ENV === "production";
    const redirectTo = getRoleHomePath(profile.role, profile.garageStatus);

    const response = NextResponse.json({
      profile,
      redirectTo,
      claimsUpdated: claimsNeedSync,
    });

    response.cookies.set(FB_SESSION_COOKIE, fbSessionCookie, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    response.cookies.set(EDGE_SESSION_COOKIE, edgeSessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    response.cookies.set(LOCALE_COOKIE_NAME, profile.language, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (err: unknown) {
    console.error("[POST /api/auth/session] Error:", err);
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

/**
 * DELETE /api/auth/session
 * Signs the user out server-side, revokes Firebase refresh tokens when possible,
 * and clears both session cookies.
 */
export async function DELETE(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const fbCookie = cookieStore.get(FB_SESSION_COOKIE)?.value;
  const admin = getFirebaseAdmin();

  if (fbCookie && admin) {
    try {
      const decoded = await admin.adminAuth.verifySessionCookie(fbCookie);
      await admin.adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Ignore expired/invalid cookie during sign-out cleanup
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(FB_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  response.cookies.set(EDGE_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  response.cookies.delete(FB_SESSION_COOKIE);
  response.cookies.delete(EDGE_SESSION_COOKIE);
  return response;
}

