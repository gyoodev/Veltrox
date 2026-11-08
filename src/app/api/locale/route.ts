import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { APP_LOCALES } from "@/types/domain";

export const runtime = "nodejs";

const localeBodySchema = z.object({
  locale: z.enum(APP_LOCALES),
});

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = localeBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_LOCALE" }, { status: 400 });
  }

  const { locale } = parsed.data;

  // If authenticated, mirror preferred language into `users/{uid}` automatically
  const ctx = await getCurrentAuthContext();
  const admin = getFirebaseAdmin();
  if (ctx && admin && ctx.profile.language !== locale) {
    try {
      await admin.adminDb.collection("users").doc(ctx.session.uid).update({
        language: locale,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Non-fatal; cookie still updates immediately
    }
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

