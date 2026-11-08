import { type NextRequest, NextResponse } from "next/server";
import { checkGfLiability } from "@/lib/compliance/guarantee-fund";

/**
 * POST /api/compliance/check-liability
 *
 * Verifies motor third-party liability insurance directly with the official
 * Guarantee Fund registry (Гаранционен фонд / ЕИСОУКР):
 * https://www.guaranteefund.org/bg/информационен-център-и-справки/услуги/проверка-за-валидна-застраховка-грaждaнскa-отговорност-на-автомобилистите
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      plate?: string;
      vin?: string | null;
      altchaPayload?: string | null;
      sessionToken?: string | null;
    };

    const { plate, vin, altchaPayload, sessionToken } = body;

    if (!plate || !plate.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "PLATE_REQUIRED",
          message: "Липсва регистрационен номер на автомобила.",
        },
        { status: 400 }
      );
    }

    const result = await checkGfLiability({
      plate,
      vin,
      altchaPayload,
      sessionToken,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("API /compliance/check-liability error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_ERROR",
        message: "Грешка при обработка на справката към Гаранционния фонд.",
      },
      { status: 500 }
    );
  }
}

