/**
 * BGTOLL Electronic Vignette Verification Engine (Bulgaria)
 *
 * Bulgarian license plates only use glyphs present in both Cyrillic and Latin alphabets:
 * A, B, E, K, M, H, O, P, C, T, Y, X.
 *
 * The official public BGTOLL check service expects normalized uppercase ASCII characters.
 */

export interface BgTollVignetteRecord {
  vignetteNumber: string;
  validDateFrom: string;
  validDateTo: string;
  status: "ACTIVE" | "EXPIRED" | "UNUSED" | string;
  price?: string | number;
  currency?: string;
  vehicleCategory?: string;
  productType?: string;
  licensePlate: string;
  countryCode: string;
}

export interface BgTollCheckResponse {
  ok: boolean;
  found: boolean;
  active: boolean;
  plate: string;
  normalizedPlate: string;
  vignette: BgTollVignetteRecord | null;
  message?: string;
  checkedAt: string;
}

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  У: "Y",
  Х: "X",
  а: "A",
  в: "B",
  е: "E",
  к: "K",
  м: "M",
  н: "H",
  о: "O",
  р: "P",
  с: "C",
  т: "T",
  у: "Y",
  х: "X",
};

/**
 * Normalizes Bulgarian vehicle license plate string to clean uppercase Latin ASCII
 * suitable for the BGTOLL REST API (e.g. "СВ 1234 АВ" -> "CB1234AB").
 */
export function normalizePlateForBgToll(rawPlate: string): string {
  if (!rawPlate) return "";
  return rawPlate
    .replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, "")
    .trim()
    .split("")
    .map((ch) => CYRILLIC_TO_LATIN_MAP[ch] || ch.toUpperCase())
    .join("");
}

/**
 * Queries the official BGTOLL public endpoint to verify if an active e-vignette exists.
 */
export async function checkBgTollVignette(
  plate: string
): Promise<BgTollCheckResponse> {
  const normalized = normalizePlateForBgToll(plate);
  const now = new Date().toISOString();

  if (!normalized || normalized.length < 4) {
    return {
      ok: false,
      found: false,
      active: false,
      plate,
      normalizedPlate: normalized,
      vignette: null,
      message: "Невалиден регистрационен номер.",
      checkedAt: now,
    };
  }

  const endpoint = `https://check.bgtoll.bg/check/vignette/plate/BG/${encodeURIComponent(
    normalized
  )}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 VeltroxAutoCheck/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok && response.status !== 500 && response.status !== 404) {
      return {
        ok: false,
        found: false,
        active: false,
        plate,
        normalizedPlate: normalized,
        vignette: null,
        message: `BGTOLL услугата върна грешка (${response.status}).`,
        checkedAt: now,
      };
    }

    const json = (await response.json()) as {
      ok?: boolean;
      vignette?: {
        vignetteNumber?: string;
        validDateFrom?: string;
        validDateTo?: string;
        status?: string;
        productType?: string;
        price?: string | number;
        currency?: string;
        vehicleCategory?: string;
      } | null;
      vignettes?: Array<{
        vignetteNumber?: string;
        validDateFrom?: string;
        validDateTo?: string;
        status?: string;
        productType?: string;
        price?: string | number;
        currency?: string;
        vehicleCategory?: string;
      }>;
      status?: {
        code?: number;
        message?: string;
      };
    };

    // 1. Direct active vignette property
    let candidate = json.vignette ?? null;

    // 2. In some versions, an array of vignettes is returned
    if (!candidate && Array.isArray(json.vignettes) && json.vignettes.length > 0) {
      candidate =
        json.vignettes.find((v) => v.status?.toUpperCase() === "ACTIVE") ??
        json.vignettes[0] ??
        null;
    }

    if (candidate && candidate.validDateTo) {
      // Validate date
      const validToSlice = candidate.validDateTo.slice(0, 10);
      const isExpired = Date.parse(candidate.validDateTo) < Date.now();
      const isActive =
        candidate.status?.toUpperCase() === "ACTIVE" ||
        (!isExpired && Boolean(candidate.validDateTo));

      return {
        ok: true,
        found: true,
        active: isActive,
        plate,
        normalizedPlate: normalized,
        vignette: {
          vignetteNumber: candidate.vignetteNumber || "Няма номер",
          validDateFrom: candidate.validDateFrom || now,
          validDateTo: validToSlice,
          status: isActive ? "ACTIVE" : candidate.status || "EXPIRED",
          price: candidate.price,
          currency: candidate.currency || "BGN",
          vehicleCategory: candidate.vehicleCategory || "K1",
          productType: candidate.productType || "Електронна винетка",
          licensePlate: normalized,
          countryCode: "BG",
        },
        message: isActive
          ? `Намерена е активна винетка до ${validToSlice}.`
          : `Намерена е изтекла винетка (${validToSlice}).`,
        checkedAt: now,
      };
    }

    return {
      ok: true,
      found: false,
      active: false,
      plate,
      normalizedPlate: normalized,
      vignette: null,
      message: "Няма намерена активна винетка в регистъра на BGTOLL.",
      checkedAt: now,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error && err.name === "AbortError"
        ? "Връзката с BGTOLL регистъра отне твърде много време."
        : "Неуспешна връзка със сървъра на BGTOLL.";

    return {
      ok: false,
      found: false,
      active: false,
      plate,
      normalizedPlate: normalized,
      vignette: null,
      message: errorMsg,
      checkedAt: now,
    };
  }
}

