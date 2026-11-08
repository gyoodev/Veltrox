import {
  GARAGE_APPROVAL_STATUSES,
  type GarageApprovalStatus,
  type SessionPayload,
  USER_ROLES,
  type UserRole,
} from "@/types/domain";

/**
 * Edge-Compatible HMAC-SHA256 Session Token Signer & Verifier
 *
 * Uses Web Crypto (`crypto.subtle`) so Next.js Edge Middleware can cryptographically
 * verify user role (`USER`, `GARAGE_OWNER`, `ADMIN`) and garage approval state
 * without requiring Node-only `firebase-admin` at the Edge.
 *
 * Server API routes & Server Components additionally verify the companion
 * `veltrox_fb_session` cookie directly against Firebase Admin SDK.
 */

export const EDGE_SESSION_COOKIE = "veltrox_session";
export const FB_SESSION_COOKIE = "veltrox_fb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days

function getSecretBytes(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    "veltrox-dev-fallback-session-secret-change-in-production-32b";
  return new TextEncoder().encode(secret);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(base64Url: string): Uint8Array | null {
  try {
    const padded = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

async function importHmacKey(): Promise<CryptoKey> {
  const secretBytes = getSecretBytes();
  return crypto.subtle.importKey(
    "raw",
    secretBytes.buffer.slice(
      secretBytes.byteOffset,
      secretBytes.byteOffset + secretBytes.byteLength
    ) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signEdgeSession(
  payload: Omit<SessionPayload, "exp">,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(fullPayload));
  const encodedPayload = toBase64Url(payloadBytes);

  const key = await importHmacKey();
  const dataBytes = new TextEncoder().encode(encodedPayload);
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    dataBytes.buffer.slice(
      dataBytes.byteOffset,
      dataBytes.byteOffset + dataBytes.byteLength
    ) as ArrayBuffer
  );
  const encodedSig = toBase64Url(new Uint8Array(sigBuffer));

  return `${encodedPayload}.${encodedSig}`;
}

export async function verifyEdgeSession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const sigBytes = fromBase64Url(encodedSig);
  const payloadBytes = fromBase64Url(encodedPayload);
  if (!sigBytes || !payloadBytes) return null;

  const key = await importHmacKey();
  const dataBytes = new TextEncoder().encode(encodedPayload);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes.buffer.slice(
      sigBytes.byteOffset,
      sigBytes.byteOffset + sigBytes.byteLength
    ) as ArrayBuffer,
    dataBytes.buffer.slice(
      dataBytes.byteOffset,
      dataBytes.byteOffset + dataBytes.byteLength
    ) as ArrayBuffer
  );

  if (!isValid) return null;

  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(payloadBytes)
    ) as Partial<SessionPayload>;

    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.emailVerified !== "boolean" ||
      typeof parsed.exp !== "number" ||
      !USER_ROLES.includes(parsed.role as UserRole) ||
      !GARAGE_APPROVAL_STATUSES.includes(
        parsed.garageStatus as GarageApprovalStatus
      )
    ) {
      return null;
    }

    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      uid: parsed.uid,
      email: parsed.email,
      emailVerified: parsed.emailVerified,
      role: parsed.role as UserRole,
      garageStatus: parsed.garageStatus as GarageApprovalStatus,
      garageId: typeof parsed.garageId === "string" ? parsed.garageId : null,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the canonical home route for an authenticated user based on role
 * and garage approval state.
 */
export function getRoleHomePath(
  role: UserRole,
  garageStatus: GarageApprovalStatus
): string {
  switch (role) {
    case "ADMIN":
      return "/app";
    case "GARAGE_OWNER":
      return garageStatus === "approved" ? "/garage" : "/garage/pending";
    case "USER":
    default:
      return "/app";
  }
}

