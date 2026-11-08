import { type NextRequest, NextResponse } from "next/server";
import { checkRtaInspection } from "@/lib/compliance/rta";

/**
 * POST /api/compliance/check-inspection
 *
 * Verifies motor vehicle technical inspection status directly with the official
 * Executive Agency "Automobile Administration" (ИААА / РТА) registry:
 * https://rta.government.bg/services/check-inspection/index.html
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      plate?: string;
      captcha?: string;
      sessionToken?: string;
    };

    const { plate, captcha, sessionToken } = body;

    if (!plate || !plate.trim()) {
      return NextResponse.json(
        { ok: false, error: "PLATE_REQUIRED", message: "Липсва регистрационен номер." },
        { status: 400 }
      );
    }

    if (!captcha || !captcha.trim()) {
      return NextResponse.json(
        { ok: false, error: "CAPTCHA_REQUIRED", message: "Моля, въведете кода за сигурност от картинката." },
        { status: 400 }
      );
    }

    if (!sessionToken || !sessionToken.trim()) {
      return NextResponse.json(
        { ok: false, error: "SESSION_EXPIRED", message: "Сесията за проверка е изтекла. Презаредете кода." },
        { status: 400 }
      );
    }

    const result = await checkRtaInspection(plate, captcha, sessionToken);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("API /compliance/check-inspection error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_ERROR",
        message: "Грешка при обработка на заявката към РТА.",
      },
      { status: 500 }
    );
  }
}

