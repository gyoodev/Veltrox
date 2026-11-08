import { type NextRequest, NextResponse } from "next/server";
import { checkBgTollVignette } from "@/lib/compliance/bgtoll";

/**
 * GET /api/compliance/check-bgtoll?plate=CB1234AB
 *
 * Real-time verification of electronic vignettes against the official Bulgarian
 * BGTOLL registry without CAPTCHA.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const plate = request.nextUrl.searchParams.get("plate")?.trim();

  if (!plate) {
    return NextResponse.json(
      { ok: false, error: "PLATE_REQUIRED", message: "Липсва регистрационен номер." },
      { status: 400 }
    );
  }

  const result = await checkBgTollVignette(plate);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

