import "server-only";

import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
  const fbSessionCookie = cookieStore.get(FB_SESSION_COOKIE)?.value;
  const edgeCookie = cookieStore.get(EDGE_SESSION_COOKIE)?.value;

  if (!fbSessionCookie || !edgeCookie) {
    return null;
  }

  const edgePayload = await verifyEdgeSession(edgeCookie);
  if (!edgePayload) {
    return null;
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return null;
  }

  try {
    const decoded = await admin.adminAuth.verifySessionCookie(
      fbSessionCookie,
      true
    );
    if (decoded.uid !== edgePayload.uid) {
      return null;
    }

    const userSnap = await admin.adminDb
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!userSnap.exists) {
      return null;
    }

    const profile = userSnap.data() as UserProfile;
    if (profile.suspended) {
      return null;
    }

    const authoritativeSession: SessionPayload = {
      uid: decoded.uid,
      email: decoded.email ?? profile.email,
      emailVerified: Boolean(decoded.email_verified),
      role: profile.role,
      garageStatus: profile.garageStatus,
      garageId: profile.garageId ?? null,
      exp: edgePayload.exp,
    };

    return {
      session: authoritativeSession,
      profile: {
        ...profile,
        emailVerified: Boolean(decoded.email_verified),
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
  if (!ctx || ctx.profile.role !== "GARAGE_OWNER") {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  if (ctx.profile.garageStatus !== "approved") {
    return { ok: false, status: 403, error: "GARAGE_NOT_APPROVED" };
  }

  const garageId = ctx.profile.garageId;
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
