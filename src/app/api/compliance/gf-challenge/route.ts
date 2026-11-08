import { NextResponse } from "next/server";
import { fetchGfChallenge } from "@/lib/compliance/guarantee-fund";

/**
 * GET /api/compliance/gf-challenge
 *
 * Fetches session tokens and a fresh challenge from Guarantee Fund.
 */
export async function GET(): Promise<NextResponse> {
  const result = await fetchGfChallenge();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 502,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

