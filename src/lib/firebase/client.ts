import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, GoogleAuthProvider, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  ...(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    ? { measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID }
    : {}),
};

/**
 * True when all required public Firebase client environment variables are present.
 * Allows local development UI inspection before `.env.local` is populated without crashing.
 */
export const isFirebaseClientConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

export interface FirebaseClientServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  googleProvider: GoogleAuthProvider;
}

let cachedServices: FirebaseClientServices | null = null;

export function getFirebaseClient(): FirebaseClientServices | null {
  if (!isFirebaseClientConfigured) {
    return null;
  }
  if (cachedServices) {
    return cachedServices;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  cachedServices = { app, auth, db, storage, googleProvider };
  return cachedServices;
}

/**
 * Synchronizes Firebase Analytics collection with the user's GDPR Cookie Consent choice.
 * Runs exclusively in the browser when `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is configured.
 */
export async function syncFirebaseAnalyticsConsent(
  enabled: boolean
): Promise<void> {
  if (
    typeof window === "undefined" ||
    !process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  ) {
    return;
  }

  const services = getFirebaseClient();
  if (!services) return;

  try {
    const { getAnalytics, isSupported, setAnalyticsCollectionEnabled } =
      await import("firebase/analytics");
    if (await isSupported()) {
      const analytics = getAnalytics(services.app);
      setAnalyticsCollectionEnabled(analytics, enabled);
    }
  } catch {
    // Ignore ad-blocker or unsupported browser environments
  }
}
