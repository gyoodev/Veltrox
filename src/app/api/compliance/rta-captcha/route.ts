import { NextResponse } from "next/server";
import { fetchRtaCaptcha } from "@/lib/compliance/rta";

/**
 * GET /api/compliance/rta-captcha
 *
 * Fetches a fresh CAPTCHA image and session token from the official
 * Executive Agency "Automobile Administration" (RTA) inspection portal:
 * https://rta.government.bg/services/check-inspection/index.html
 */
export async function GET(): Promise<NextResponse> {
  const result = await fetchRtaCaptcha();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 502,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

