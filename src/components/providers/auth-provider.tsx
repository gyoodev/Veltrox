"use client";

import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import type { RegistrableRole, UserProfile } from "@/types/domain";

interface SyncSessionOptions {
  requestedRole?: RegistrableRole;
  displayName?: string;
  forceRefresh?: boolean;
}

interface SyncSessionResult {
  profile: UserProfile;
  redirectTo: string;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  syncServerSession: (
    user: FirebaseUser,
    options?: SyncSessionOptions
  ) => Promise<SyncSessionResult>;
  refreshProfile: () => Promise<void>;
  setProfileState: (profile: UserProfile | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialProfile = null,
}: {
  children: ReactNode;
  initialProfile?: UserProfile | null;
}) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [loading, setLoading] = useState<boolean>(
    isFirebaseClientConfigured && !initialProfile
  );

  const syncServerSession = useCallback(
    async (
      user: FirebaseUser,
      options?: SyncSessionOptions
    ): Promise<SyncSessionResult> => {
      let idToken = await user.getIdToken(Boolean(options?.forceRefresh));

      const callSessionEndpoint = async (token: string) =>
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken: token,
            ...(options?.requestedRole
              ? { requestedRole: options.requestedRole }
              : {}),
            ...(options?.displayName
              ? { displayName: options.displayName }
              : {}),
          }),
        });

      const response = await callSessionEndpoint(idToken);
      if (!response.ok) {
        const errPayload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errPayload.error || "SESSION_SYNC_FAILED");
      }

      let data = (await response.json()) as {
        profile: UserProfile;
        redirectTo: string;
        claimsUpdated?: boolean;
      };

      // If custom claims were just minted on first sign-up or role update,
      // force-refresh the client ID token so Firestore client rules immediately see the new claims!
      if (data.claimsUpdated) {
        idToken = await user.getIdToken(true);
        const refreshed = await callSessionEndpoint(idToken);
        if (refreshed.ok) {
          data = (await refreshed.json()) as {
            profile: UserProfile;
            redirectTo: string;
          };
        }
      }

      setProfile(data.profile);
      return {
        profile: data.profile,
        redirectTo: data.redirectTo,
      };
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "GET",
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as { profile: UserProfile };
        setProfile(json.profile);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    const client = getFirebaseClient();
    if (!client) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(client.auth, async (user) => {
      // If force=1 is present in the query string, user explicitly requested a fresh unauthenticated session
      const isForceSignout =
        typeof window !== "undefined" &&
        window.location.search.includes("force=1");

      if (isForceSignout) {
        if (user) {
          try {
            await firebaseSignOut(client.auth);
          } catch {
            // Ignore
          }
        }
        setFirebaseUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as { profile: UserProfile };
          setProfile(json.profile);
        }
      } catch {
        // Session will be established explicitly during login/register action
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    // 1. Immediately wipe React client state
    setProfile(null);
    setFirebaseUser(null);

    // 2. Clear Firebase client SDK (Google OAuth / Password tokens in IndexedDB & memory)
    try {
      const client = getFirebaseClient();
      if (client?.auth) {
        await firebaseSignOut(client.auth);
      }
    } catch (fbErr) {
      console.warn("Firebase client signOut error:", fbErr);
    }

    // 3. Clear server session cookies across all handlers
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch (err) {
      console.warn("Sign-out server cookie delete error:", err);
    }

    // 4. Force hard browser navigation to /login?force=1 which triggers middleware cookie destruction and client purge
    window.location.href = "/login?force=1";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      isConfigured: isFirebaseClientConfigured,
      syncServerSession,
      refreshProfile,
      setProfileState: setProfile,
      signOut,
    }),
    [firebaseUser, profile, loading, syncServerSession, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
