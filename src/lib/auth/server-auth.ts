import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  EDGE_SESSION_COOKIE,
  FB_SESSION_COOKIE,
  getRoleHomePath,
  verifyEdgeSession,
} from "@/lib/auth/edge-session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type {
  Garage,
  GarageStaff,
  SessionPayload,
  UserProfile,
  UserRole,
} from "@/types/domain";

export interface AuthenticatedContext {
  session: SessionPayload;
  profile: UserProfile;
}

export interface GarageWorkspaceContext extends AuthenticatedContext {
  garage: Garage;
  isManager: boolean;
}

/**
 * Verifies the user's session server-side using Firebase Admin SDK (`verifySessionCookie`)
 * AND loads the authoritative `users/{uid}` profile document from Firestore.
 *
 * Authorization is NEVER enforced solely in the UI or client token.
 */
export async function getCurrentAuthContext(): Promise<AuthenticatedContext | null> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return null;
  }

  let authenticatedUid: string | null = null;
  let verifiedEmail: string | undefined = undefined;
  let verifiedEmailVerified = false;
  let tokenExp: number | undefined = undefined;

  // 1. Check Authorization: Bearer <idToken> header (if present)
  try {
    const headerList = await headers();
    const authHeader = headerList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.slice(7).trim();
      if (idToken) {
        try {
          const decoded = await admin.adminAuth.verifyIdToken(idToken);
          authenticatedUid = decoded.uid;
          verifiedEmail = decoded.email;
          verifiedEmailVerified = Boolean(decoded.email_verified);
          tokenExp = decoded.exp;
        } catch {
          // Token expired or invalid, fall back to cookies
        }
      }
    }
  } catch {
    // Non-fatal if headers() cannot be read
  }

  // 2. Check session cookies
  let fbSessionCookie: string | undefined;
  let edgeCookie: string | undefined;
  let edgePayload: SessionPayload | null = null;
  try {
    const cookieStore = await cookies();
    fbSessionCookie = cookieStore.get(FB_SESSION_COOKIE)?.value;
    edgeCookie = cookieStore.get(EDGE_SESSION_COOKIE)?.value;

    if (edgeCookie) {
      edgePayload = await verifyEdgeSession(edgeCookie);
    }
  } catch {
    // Non-fatal if cookies() or edge verification fails
  }

  if (!authenticatedUid && fbSessionCookie) {
    try {
      // Use checkRevoked = false to prevent premature session revocation when custom claims update
      const decoded = await admin.adminAuth.verifySessionCookie(
        fbSessionCookie,
        false
      );
      authenticatedUid = decoded.uid;
      verifiedEmail = decoded.email;
      verifiedEmailVerified = Boolean(decoded.email_verified);
      tokenExp = decoded.exp;
    } catch {
      // Cookie invalid, check edge payload fallback
    }
  }

  // 3. Fallback to valid edge session payload if available
  if (!authenticatedUid && edgePayload) {
    authenticatedUid = edgePayload.uid;
    verifiedEmail = edgePayload.email;
    verifiedEmailVerified = edgePayload.emailVerified;
    tokenExp = edgePayload.exp;
  }

  if (!authenticatedUid) {
    return null;
  }

  try {
    const userSnap = await admin.adminDb
      .collection("users")
      .doc(authenticatedUid)
      .get();

    if (!userSnap.exists) {
      return null;
    }

    const profile = userSnap.data() as UserProfile;
    if (profile.suspended) {
      return null;
    }

    let effectiveGarageStatus = profile.garageStatus;
    let effectiveGarageId = profile.garageId ?? null;

    if (profile.role === "GARAGE_OWNER") {
      if (effectiveGarageId) {
        try {
          const gSnap = await admin.adminDb
            .collection("garages")
            .doc(effectiveGarageId)
            .get();
          if (gSnap.exists) {
            const gData = gSnap.data() as Garage;
            const mappedStatus =
              gData.status === "suspended" ? "rejected" : gData.status;
            if (mappedStatus && mappedStatus !== effectiveGarageStatus) {
              effectiveGarageStatus = mappedStatus;
              void userSnap.ref.update({
                garageStatus: mappedStatus,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          console.warn("Could not check garage status:", err);
        }
      } else {
        try {
          const gQuery = await admin.adminDb
            .collection("garages")
            .where("ownerUid", "==", authenticatedUid)
            .limit(1)
            .get();
          if (!gQuery.empty && gQuery.docs[0]) {
            const gDoc = gQuery.docs[0];
            const gData = gDoc.data() as Garage;
            effectiveGarageId = gDoc.id;
            const mappedStatus =
              gData.status === "suspended"
                ? "rejected"
                : gData.status || "approved";
            effectiveGarageStatus = mappedStatus;
            void userSnap.ref.update({
              garageId: effectiveGarageId,
              garageStatus: effectiveGarageStatus,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn("Could not find garage by ownerUid:", err);
        }
      }
    }

    const resolvedExp =
      tokenExp ?? edgePayload?.exp ?? Math.floor(Date.now() / 1000) + 86400 * 5;

    const authoritativeSession: SessionPayload = {
      uid: authenticatedUid,
      email: verifiedEmail ?? profile.email,
      emailVerified: verifiedEmailVerified,
      role: profile.role,
      garageStatus: effectiveGarageStatus,
      garageId: effectiveGarageId,
      exp: resolvedExp,
    };

    return {
      session: authoritativeSession,
      profile: {
        ...profile,
        garageStatus: effectiveGarageStatus,
        garageId: effectiveGarageId,
        emailVerified: verifiedEmailVerified,
      },
    };
  } catch {
    return null;
  }
}

export async function requireRole(
  allowedRoles: readonly UserRole[]
): Promise<AuthenticatedContext> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    redirect("/login");
  }

  if (!allowedRoles.includes(ctx.profile.role)) {
    redirect(getRoleHomePath(ctx.profile.role, ctx.profile.garageStatus));
  }

  return ctx;
}

export async function requireApprovedGarage(): Promise<AuthenticatedContext> {
  const ctx = await requireRole(["GARAGE_OWNER"]);
  if (ctx.profile.garageStatus !== "approved") {
    redirect("/garage/pending");
  }
  return ctx;
}

/**
 * Server Component guard for onboarded garage pages (`/garage`, `/garage/work-orders`, etc.).
 * Redirects approved owners without a `garageId` to `/garage/onboarding`, and verifies
 * that staff members are active in `garageStaff/{garageId}_{uid}`.
 */
export async function requireOnboardedGarage(): Promise<GarageWorkspaceContext> {
  const ctx = await requireApprovedGarage();
  const garageId = ctx.profile.garageId;
  if (!garageId) {
    redirect("/garage/onboarding");
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    redirect("/garage/onboarding");
  }

  const garageSnap = await admin.adminDb
    .collection("garages")
    .doc(garageId)
    .get();

  if (!garageSnap.exists) {
    redirect("/garage/onboarding");
  }

  const garage = { ...(garageSnap.data() as Garage), id: garageSnap.id };
  const isOwner = garage.ownerUid === ctx.session.uid && !ctx.profile.isStaff;

  if (!isOwner) {
    const staffSnap = await admin.adminDb
      .collection("garageStaff")
      .doc(`${garageId}_${ctx.session.uid}`)
      .get();
    const staffData = staffSnap.exists
      ? (staffSnap.data() as GarageStaff)
      : null;
    if (!staffData || !staffData.active) {
      redirect("/login?force=1");
    }
  }

  return {
    ...ctx,
    garage,
    isManager: isOwner,
  };
}

export async function requireGarageManagerPage(): Promise<GarageWorkspaceContext> {
  const ctx = await requireOnboardedGarage();
  if (!ctx.isManager) {
    redirect("/garage");
  }
  return ctx;
}

export type GarageApiAuthResult =
  | ({ ok: true } & GarageWorkspaceContext)
  | { ok: false; status: 401 | 403 | 409 | 503; error: string };

/**
 * Route Handler authorization guard for `/api/garage/*` endpoints.
 * Enforces `garageId` tenant membership and optional manager-only permissions.
 */
export async function resolveGarageApiAuth(options?: {
  requireManager?: boolean;
}): Promise<GarageApiAuthResult> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "FIREBASE_ADMIN_NOT_CONFIGURED",
    };
  }

  const ctx = await getCurrentAuthContext();
  if (!ctx || (ctx.profile.role !== "GARAGE_OWNER" && ctx.profile.role !== "ADMIN")) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  if (
    ctx.profile.role === "GARAGE_OWNER" &&
    ctx.profile.garageStatus !== "approved"
  ) {
    return { ok: false, status: 403, error: "GARAGE_NOT_APPROVED" };
  }

  let garageId = ctx.profile.garageId;
  if (!garageId) {
    try {
      const gQuery = await admin.adminDb
        .collection("garages")
        .where("ownerUid", "==", ctx.session.uid)
        .limit(1)
        .get();
      if (!gQuery.empty && gQuery.docs[0]) {
        garageId = gQuery.docs[0].id;
        void admin.adminDb.collection("users").doc(ctx.session.uid).update({
          garageId,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {}
  }

  if (!garageId) {
    return { ok: false, status: 409, error: "GARAGE_NOT_ONBOARDED" };
  }

  const garageSnap = await admin.adminDb
    .collection("garages")
    .doc(garageId)
    .get();
  if (!garageSnap.exists) {
    return { ok: false, status: 409, error: "GARAGE_NOT_ONBOARDED" };
  }

  const garage = { ...(garageSnap.data() as Garage), id: garageSnap.id };
  if (garage.status === "suspended") {
    return { ok: false, status: 403, error: "GARAGE_SUSPENDED" };
  }

  const isManager = garage.ownerUid === ctx.session.uid && !ctx.profile.isStaff;

  if (!isManager) {
    const staffSnap = await admin.adminDb
      .collection("garageStaff")
      .doc(`${garageId}_${ctx.session.uid}`)
      .get();
    const staffData = staffSnap.exists
      ? (staffSnap.data() as GarageStaff)
      : null;
    if (!staffData || !staffData.active) {
      return { ok: false, status: 403, error: "STAFF_ACCESS_REVOKED" };
    }
  }

  if (options?.requireManager && !isManager) {
    return { ok: false, status: 403, error: "MANAGER_PERMISSION_REQUIRED" };
  }

  return {
    ok: true,
    ...ctx,
    garage,
    isManager,
  };
}

export type AdminApiAuthResult =
  | ({ ok: true } & AuthenticatedContext)
  | { ok: false; status: 401 | 403 | 503; error: string };

/**
 * Route Handler authorization guard for `/api/admin/*` endpoints.
 * Strictly requires `role === "ADMIN"` verified via Firebase Admin SDK + Firestore.
 */
export async function resolveAdminApiAuth(): Promise<AdminApiAuthResult> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "FIREBASE_ADMIN_NOT_CONFIGURED",
    };
  }

  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  if (ctx.profile.role !== "ADMIN") {
    return { ok: false, status: 403, error: "ADMIN_ROLE_REQUIRED" };
  }

  return {
    ok: true,
    ...ctx,
  };
}
