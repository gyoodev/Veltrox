import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { EDGE_SESSION_COOKIE, FB_SESSION_COOKIE } from "@/lib/auth/edge-session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function clearAuthSession(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.url.startsWith("https://") ||
    isProd;

  try {
    const cookieStore = await cookies();
    const fbCookie = cookieStore.get(FB_SESSION_COOKIE)?.value;
    const admin = getFirebaseAdmin();

    if (fbCookie && admin) {
      try {
        const revokePromise = (async () => {
          const decoded = await admin.adminAuth.verifySessionCookie(fbCookie, false);
          if (decoded?.sub) {
            await admin.adminAuth.revokeRefreshTokens(decoded.sub);
          }
        })();
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
        await Promise.race([revokePromise, timeoutPromise]);
      } catch {
        // Non-fatal
      }
    }
  } catch (err) {
    console.warn("Logout session clear error:", err);
  }

  const clearCookieOptions = {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax" as const,
  };

  return clearCookieOptions;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const clearCookieOptions = await clearAuthSession(request);
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(FB_SESSION_COOKIE, "", clearCookieOptions);
  response.cookies.set(EDGE_SESSION_COOKIE, "", clearCookieOptions);
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clearCookieOptions = await clearAuthSession(request);
  const response = NextResponse.json({ ok: true, redirectTo: "/login" });
  response.cookies.set(FB_SESSION_COOKIE, "", clearCookieOptions);
  response.cookies.set(EDGE_SESSION_COOKIE, "", clearCookieOptions);
  return response;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const clearCookieOptions = await clearAuthSession(request);
  const response = NextResponse.json({ ok: true, redirectTo: "/login" });
  response.cookies.set(FB_SESSION_COOKIE, "", clearCookieOptions);
  response.cookies.set(EDGE_SESSION_COOKIE, "", clearCookieOptions);
  return response;
}
