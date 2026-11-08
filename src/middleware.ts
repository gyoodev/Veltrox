import { type NextRequest, NextResponse } from "next/server";
import { isValidLocale, LOCALE_COOKIE_NAME } from "@/i18n/config";
import {
  EDGE_SESSION_COOKIE,
  getRoleHomePath,
  verifyEdgeSession,
} from "@/lib/auth/edge-session";

/**
 * Next.js Edge Middleware:
 * 1. Syncs optional `?lang=bg|en` query parameter to `NEXT_LOCALE` cookie.
 * 2. Enforces strict role-based route protection:
 *    - `/app/*`    -> `USER` only
 *    - `/garage/*` -> `GARAGE_OWNER` only (unapproved restricted to `/garage/pending` & `/garage/profile`)
 *    - `/admin/*`  -> `ADMIN` only
 * 3. Redirects signed-in users away from `/login` and `/register` to their workspace.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;

  const langParam = searchParams.get("lang");
  const applyLocaleCookie = (res: NextResponse): NextResponse => {
    if (isValidLocale(langParam)) {
      res.cookies.set(LOCALE_COOKIE_NAME, langParam, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return res;
  };

  const sessionToken = request.cookies.get(EDGE_SESSION_COOKIE)?.value;
  const session = await verifyEdgeSession(sessionToken);

  const isUserRoute = pathname === "/app" || pathname.startsWith("/app/");
  const isGarageRoute =
    pathname === "/garage" || pathname.startsWith("/garage/");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isProtectedRoute = isUserRoute || isGarageRoute || isAdminRoute;

  const isGuestAuthRoute = pathname === "/login" || pathname === "/register";

  if (isProtectedRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return applyLocaleCookie(NextResponse.redirect(loginUrl));
  }

  if (session) {
    if (isGuestAuthRoute && searchParams.get("force") !== "1") {
      const target = getRoleHomePath(session.role, session.garageStatus);
      return applyLocaleCookie(
        NextResponse.redirect(new URL(target, request.url))
      );
    }

    if (isUserRoute && session.role !== "USER") {
      const target = getRoleHomePath(session.role, session.garageStatus);
      return applyLocaleCookie(
        NextResponse.redirect(new URL(target, request.url))
      );
    }

    if (isGarageRoute) {
      if (session.role !== "GARAGE_OWNER") {
        const target = getRoleHomePath(session.role, session.garageStatus);
        return applyLocaleCookie(
          NextResponse.redirect(new URL(target, request.url))
        );
      }

      const isAllowedWhilePending =
        pathname === "/garage/pending" ||
        pathname === "/garage/profile" ||
        pathname.startsWith("/garage/profile/");

      if (session.garageStatus !== "approved" && !isAllowedWhilePending) {
        return applyLocaleCookie(
          NextResponse.redirect(new URL("/garage/pending", request.url))
        );
      }

      if (session.garageStatus === "approved" && pathname === "/garage/pending") {
        return applyLocaleCookie(
          NextResponse.redirect(new URL("/garage", request.url))
        );
      }
    }

    if (isAdminRoute && session.role !== "ADMIN") {
      const target = getRoleHomePath(session.role, session.garageStatus);
      return applyLocaleCookie(
        NextResponse.redirect(new URL(target, request.url))
      );
    }
  }

  return applyLocaleCookie(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};

