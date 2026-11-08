import { type NextRequest, NextResponse } from "next/server";
import { fetchBulgariaFuelPrices } from "@/lib/fuel-prices";

/**
 * GET /api/fuel-prices — Returns live retail pump fuel prices in Bulgaria (EUR & BGN)
 * with 30-day price history. Supports `?refresh=1` to force a fresh upstream fetch.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const data = await fetchBulgariaFuelPrices({ bypassCache: forceRefresh });

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "FUEL_FEED_UNAVAILABLE" },
      { status: 503 }
    );
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
}

