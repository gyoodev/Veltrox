import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";
import { type Storage, getStorage } from "firebase-admin/storage";

interface ResolvedServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function resolveServiceAccountCredentials(): ResolvedServiceAccount | null {
  const envProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  // Local development convenience: auto-detect Git-ignored service account JSON in repo root
  if (process.env.NODE_ENV !== "production") {
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
          const raw = JSON.parse(readFileSync(fullPath, "utf8")) as {
            project_id?: string;
            client_email?: string;
            private_key?: string;
          };
          if (raw.project_id && raw.client_email && raw.private_key) {
            return {
              projectId: raw.project_id,
              clientEmail: raw.client_email,
              privateKey: raw.private_key,
            };
          }
        }
      }
    } catch {
      // Ignore filesystem errors
    }
  }

  return null;
}

export function isFirebaseAdminConfigured(): boolean {
  return resolveServiceAccountCredentials() !== null;
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
 */
export function getFirebaseAdmin(): FirebaseAdminServices | null {
  if (cachedAdmin) {
    return cachedAdmin;
  }

  const creds = resolveServiceAccountCredentials();
  if (!creds) {
    return null;
  }

  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: creds.projectId,
        clientEmail: creds.clientEmail,
        privateKey: creds.privateKey,
      }),
      ...(storageBucket ? { storageBucket } : {}),
    });

  cachedAdmin = {
    app,
    adminAuth: getAuth(app),
    adminDb: getFirestore(app),
    adminStorage: getStorage(app),
  };

  return cachedAdmin;
}
