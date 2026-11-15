"use client";

import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type UserCredential,
} from "firebase/auth";
import { isCapacitorNative } from "@/lib/capacitor";
import type { FirebaseClientServices } from "./client";

/**
 * Universal Google Sign-In helper:
 * - On Native mobile (Capacitor Android/iOS): uses Google Play Services native account picker
 *   via @capacitor-firebase/authentication and bridges the resulting ID token into Firebase JS SDK.
 * - On Web browsers: uses standard Firebase signInWithPopup.
 */
export async function signInWithGooglePlatform(
  client: FirebaseClientServices
): Promise<UserCredential> {
  if (isCapacitorNative()) {
    const { FirebaseAuthentication } = await import(
      "@capacitor-firebase/authentication"
    );
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw new Error("GOOGLE_ID_TOKEN_MISSING");
    }
    const credential = GoogleAuthProvider.credential(idToken);
    return await signInWithCredential(client.auth, credential);
  }

  return await signInWithPopup(client.auth, client.googleProvider);
}

