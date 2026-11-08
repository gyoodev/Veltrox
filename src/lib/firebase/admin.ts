import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";
import { type Storage, getStorage } from "firebase-admin/storage";

interface ResolvedServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function parseServiceAccountJsonString(
  rawJson: string
): ResolvedServiceAccount | null {
  try {
    const trimmed = rawJson.trim();
    const jsonText = trimmed.startsWith("{")
      ? trimmed
      : Buffer.from(trimmed, "base64").toString("utf8");
    const parsed = JSON.parse(jsonText) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      };
    }
  } catch {
    // Ignore malformed JSON
  }
  return null;
}

function resolveServiceAccountCredentials(): ResolvedServiceAccount | null {
  const envProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    ""
  ).trim();
  const envClientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const rawPrivateKey = (process.env.FIREBASE_PRIVATE_KEY || "").trim();
  const unquotedPrivateKey =
    (rawPrivateKey.startsWith('"') && rawPrivateKey.endsWith('"')) ||
    (rawPrivateKey.startsWith("'") && rawPrivateKey.endsWith("'"))
      ? rawPrivateKey.slice(1, -1)
      : rawPrivateKey;

  if (
    envProjectId &&
    envClientEmail &&
    unquotedPrivateKey &&
    !unquotedPrivateKey.includes("YOUR_PRIVATE_KEY_HERE")
  ) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: unquotedPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  // Optional single-variable JSON (raw or base64) for serverless hosts
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const fromEnvJson = parseServiceAccountJsonString(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );
    if (fromEnvJson) return fromEnvJson;
  }

  // Standard GOOGLE_APPLICATION_CREDENTIALS file path
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const adcPath = resolve(
      process.cwd(),
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
    if (existsSync(adcPath)) {
      const fromAdcFile = parseServiceAccountJsonString(
        readFileSync(adcPath, "utf8")
      );
      if (fromAdcFile) return fromAdcFile;
    }
  }

  // Auto-detect Git-ignored service account JSON in repo root
  try {
    const cwd = process.cwd();
    const files = readdirSync(cwd);
    const candidate = files.find(
      (name) =>
        name === "serviceAccountKey.json" ||
        (name.includes("firebase-adminsdk") && name.endsWith(".json"))
    );
    if (candidate) {
      const fullPath = resolve(cwd, candidate);
      if (existsSync(fullPath)) {
        const fromRootFile = parseServiceAccountJsonString(
          readFileSync(fullPath, "utf8")
        );
        if (fromRootFile) return fromRootFile;
      }
    }
  } catch {
    // Ignore filesystem errors
  }

  return null;
}

function isEmulatorOrManagedCloudRuntime(): boolean {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.K_SERVICE ||
      process.env.FIREBASE_CONFIG
  );
}

export function isFirebaseAdminConfigured(): boolean {
  return (
    resolveServiceAccountCredentials() !== null ||
    isEmulatorOrManagedCloudRuntime()
  );
}

export interface FirebaseAdminServices {
  app: App;
  adminAuth: Auth;
  adminDb: Firestore;
  adminStorage: Storage;
}

let cachedAdmin: FirebaseAdminServices | null = null;

/**
 * Returns singleton Firebase Admin SDK instances for server-side custom claims,
 * session cookie verification, multi-tenant Firestore operations, and GDPR erasure.
 * Supports `.env.local` keys, `FIREBASE_SERVICE_ACCOUNT_JSON`, `serviceAccountKey.json`,
 * Firebase Local Emulators, and Firebase App Hosting / Cloud Run ADC.
 */
export function getFirebaseAdmin(): FirebaseAdminServices | null {
  if (cachedAdmin) {
    return cachedAdmin;
  }

  const creds = resolveServiceAccountCredentials();
  const fallbackProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  let app: App | undefined = getApps()[0];

  if (!app) {
    if (creds) {
      app = initializeApp({
        credential: cert({
          projectId: creds.projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.privateKey,
        }),
        projectId: creds.projectId,
        ...(storageBucket ? { storageBucket } : {}),
      });
    } else if (
      process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST
    ) {
      if (!fallbackProjectId) return null;
      app = initializeApp({
        projectId: fallbackProjectId,
        ...(storageBucket ? { storageBucket } : {}),
      });
    } else if (process.env.K_SERVICE || process.env.FIREBASE_CONFIG) {
      app = initializeApp({
        credential: applicationDefault(),
        ...(fallbackProjectId ? { projectId: fallbackProjectId } : {}),
        ...(storageBucket ? { storageBucket } : {}),
      });
    } else {
      return null;
    }
  }

  cachedAdmin = {
    app,
    adminAuth: getAuth(app),
    adminDb: getFirestore(app),
    adminStorage: getStorage(app),
  };

  return cachedAdmin;
}
