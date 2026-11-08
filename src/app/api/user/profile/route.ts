import { NextResponse } from "next/server";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { updateProfileSchema } from "@/lib/validators/profile";
import type { UserProfile } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.json({ profile: ctx.profile });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

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

  const parsed = updateProfileSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Ensure avatar storage path, if supplied, strictly belongs to the caller's UID
  if (
    data.avatarStoragePath &&
    !data.avatarStoragePath.startsWith(`users/${ctx.session.uid}/avatar/`)
  ) {
    return NextResponse.json(
      { error: "FORBIDDEN_STORAGE_PATH" },
      { status: 403 }
    );
  }

  const previousStoragePath = ctx.profile.avatarStoragePath;
  const nextAvatarUrl =
    data.avatarUrl !== undefined ? data.avatarUrl : ctx.profile.avatarUrl;
  const nextAvatarStoragePath =
    data.avatarStoragePath !== undefined
      ? data.avatarStoragePath
      : ctx.profile.avatarStoragePath;

  // Clean up replaced or removed avatar object in Firebase Storage
  if (
    previousStoragePath &&
    previousStoragePath !== nextAvatarStoragePath &&
    previousStoragePath.startsWith(`users/${ctx.session.uid}/avatar/`)
  ) {
    try {
      await admin.adminStorage.bucket().file(previousStoragePath).delete({
        ignoreNotFound: true,
      });
    } catch {
      // Non-fatal storage cleanup
    }
  }

  const nowIso = new Date().toISOString();
  const normalizedPhone =
    data.phone && data.phone.trim().length > 0 ? data.phone.trim() : null;
  const updatedFields = {
    displayName: data.displayName,
    phone: normalizedPhone,
    avatarUrl: nextAvatarUrl,
    avatarStoragePath: nextAvatarStoragePath,
    language: data.language,
    notificationPreferences: data.notificationPreferences,
    updatedAt: nowIso,
  };

  await admin.adminDb
    .collection("users")
    .doc(ctx.session.uid)
    .update(updatedFields);

  await admin.adminAuth.updateUser(ctx.session.uid, {
    displayName: data.displayName,
    ...(nextAvatarUrl ? { photoURL: nextAvatarUrl } : {}),
  });

  const updatedProfile: UserProfile = {
    ...ctx.profile,
    ...updatedFields,
  };

  const response = NextResponse.json({ profile: updatedProfile });
  response.cookies.set(LOCALE_COOKIE_NAME, data.language, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
