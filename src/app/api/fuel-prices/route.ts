import { type NextRequest, NextResponse } from "next/server";
import {
  fetchBulgariaFuelPrices,
  getFallbackBulgariaFuelPrices,
} from "@/lib/fuel-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/fuel-prices — Returns live retail pump fuel prices in Bulgaria (EUR & BGN)
 * with 30-day price history. Supports `?refresh=1` to force a fresh upstream fetch.
 * Guaranteed 100% availability with resilient baseline data fallback.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    let data = await fetchBulgariaFuelPrices({ bypassCache: forceRefresh });

    if (!data || !data.fuels || data.fuels.length === 0) {
      data = getFallbackBulgariaFuelPrices();
    }

    return NextResponse.json(
      { ok: true, data },
      {
        headers: {
          "Cache-Control": forceRefresh
            ? "no-store"
            : "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/fuel-prices error, using fallback data:", error);
    const fallbackData = getFallbackBulgariaFuelPrices();
    return NextResponse.json({ ok: true, data: fallbackData });
  }
}
