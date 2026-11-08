/**
 * Executive Agency "Automobile Administration" (ИААА / РТА)
 * Periodic Motor Vehicle Inspection Safety Check (ГТП)
 *
 * Official Portal: https://rta.government.bg/services/check-inspection/index.html
 * Backend Service: https://rta.government.bg/services/check-inspection/checkinsp.php
 */

export interface RtaCaptchaResponse {
  ok: boolean;
  captchaImage: string; // "data:image/jpeg;base64,..."
  sessionToken: string; // Base64-encoded session cookie
  error?: string;
}

export interface RtaInspectionResult {
  ok: boolean;
  found: boolean;
  plate: string;
  normalizedPlate: string;
  vin: string | null;
  nextInspectionDate: string | null; // ISO YYYY-MM-DD for date inputs
  rawNextInspectionDate: string | null; // Original Bulgarian display date
  isValid: boolean;
  isPeriodic: boolean;
  ecoCategory: string | null;
  error?: string | null;
  captchaMismatch?: boolean;
  checkedAt: string;
}

/**
 * Normalizes Bulgarian vehicle registration plate according to RTA requirements.
 * Converts overlapping Cyrillic characters to Latin uppercase, strips spaces & dashes.
 */
export function normalizePlateForRta(plate: string): string {
  if (!plate) return "";

  const cyrToLatMap: Record<string, string> = {
    А: "A",
    а: "A",
    В: "B",
    в: "B",
    Е: "E",
    е: "E",
    К: "K",
    к: "K",
    М: "M",
    м: "M",
    Н: "H",
    н: "H",
    О: "O",
    о: "O",
    Р: "P",
    р: "P",
    С: "C",
    с: "C",
    Т: "T",
    т: "T",
    У: "Y",
    у: "Y",
    Х: "X",
    х: "X",
  };

  let cleaned = "";
  for (const char of plate.trim().toUpperCase()) {
    if (/[A-Z0-9]/.test(char)) {
      cleaned += char;
    } else if (cyrToLatMap[char]) {
      cleaned += cyrToLatMap[char];
    }
  }

  return cleaned;
}

/**
 * Parses date string returned by RTA (e.g. "24.08.2025" or "2025-08-24") into YYYY-MM-DD.
 */
export function parseRtaDateToIso(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Match DD.MM.YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
    const d = ddmmyyyy[1];
    const m = ddmmyyyy[2];
    const y = ddmmyyyy[3];
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Match YYYY-MM-DD
  const yyyymmdd = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (yyyymmdd && yyyymmdd[1] && yyyymmdd[2] && yyyymmdd[3]) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2];
    const d = yyyymmdd[3];
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Fetches a fresh CAPTCHA image and session token from the official RTA check-inspection service.
 */
export async function fetchRtaCaptcha(): Promise<RtaCaptchaResponse> {
  const url = `https://rta.government.bg/services/check-inspection/checkinsp.php?captcha/inspection=1&rand=${Math.random()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://rta.government.bg/services/check-inspection/index.html",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        captchaImage: "",
        sessionToken: "",
        error: `RTA_CAPTCHA_HTTP_${response.status}`,
      };
    }

    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) {
      return {
        ok: false,
        captchaImage: "",
        sessionToken: "",
        error: "NO_SESSION_COOKIE_FROM_RTA",
      };
    }

    // Extract PHPSESSID=...
    const cookieMatch = setCookie.match(/PHPSESSID=[^;]+/);
    const sessionCookie =
      (cookieMatch ? cookieMatch[0] : setCookie.split(";")[0]) ||
      "PHPSESSID=session";

    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:image/jpeg;base64,${base64Image}`;
    const sessionToken = Buffer.from(sessionCookie, "utf-8").toString("base64");

    return {
      ok: true,
      captchaImage: dataUri,
      sessionToken,
    };
  } catch (err) {
    console.error("fetchRtaCaptcha error:", err);
    return {
      ok: false,
      captchaImage: "",
      sessionToken: "",
      error: err instanceof Error ? err.message : "RTA_CAPTCHA_FETCH_FAILED",
    };
  }
}

interface RawRtaInspectionResponse {
  rvIdentNum?: string;
  nextInspectionDate?: string;
  isValid?: boolean;
  isPeriodic?: boolean;
  ecoCategory?: string;
  error?: string;
  validation?: {
    stickerNumValid?: boolean;
    captchaValid?: boolean;
    regNumValid?: boolean;
  };
}

/**
 * Submits license plate and user-solved CAPTCHA to RTA check-inspection service.
 */
export async function checkRtaInspection(
  plate: string,
  captcha: string,
  sessionToken: string
): Promise<RtaInspectionResult> {
  const normalizedPlate = normalizePlateForRta(plate);
  const now = new Date().toISOString();

  if (!normalizedPlate) {
    return {
      ok: false,
      found: false,
      plate,
      normalizedPlate: "",
      vin: null,
      nextInspectionDate: null,
      rawNextInspectionDate: null,
      isValid: false,
      isPeriodic: true,
      ecoCategory: null,
      error: "INVALID_PLATE",
      checkedAt: now,
    };
  }

  let cookieString = "";
  try {
    cookieString = Buffer.from(sessionToken, "base64").toString("utf-8");
  } catch {
    return {
      ok: false,
      found: false,
      plate,
      normalizedPlate,
      vin: null,
      nextInspectionDate: null,
      rawNextInspectionDate: null,
      isValid: false,
      isPeriodic: true,
      ecoCategory: null,
      error: "INVALID_SESSION_TOKEN",
      checkedAt: now,
    };
  }

  const endpoint = "https://rta.government.bg/services/check-inspection/checkinsp.php";

  const formData = new URLSearchParams();
  formData.append("regNum", normalizedPlate);
  formData.append("captcha", captcha.trim());

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: "https://rta.government.bg/services/check-inspection/index.html",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieString,
      },
      body: formData.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        found: false,
        plate,
        normalizedPlate,
        vin: null,
        nextInspectionDate: null,
        rawNextInspectionDate: null,
        isValid: false,
        isPeriodic: true,
        ecoCategory: null,
        error: `RTA_HTTP_${response.status}`,
        checkedAt: now,
      };
    }

    const data = (await response.json()) as RawRtaInspectionResponse;

    // Check CAPTCHA mismatch
    if (data.validation?.captchaValid === false) {
      return {
        ok: false,
        found: false,
        plate,
        normalizedPlate,
        vin: null,
        nextInspectionDate: null,
        rawNextInspectionDate: null,
        isValid: false,
        isPeriodic: true,
        ecoCategory: null,
        captchaMismatch: true,
        error: "CaptchaMismatchException",
        checkedAt: now,
      };
    }

    if (data.error) {
      if (data.error === "InspectionNotFoundException") {
        return {
          ok: true,
          found: false,
          plate,
          normalizedPlate,
          vin: null,
          nextInspectionDate: null,
          rawNextInspectionDate: null,
          isValid: false,
          isPeriodic: true,
          ecoCategory: null,
          error: "InspectionNotFoundException",
          checkedAt: now,
        };
      }

      if (data.error === "CaptchaMismatchException") {
        return {
          ok: false,
          found: false,
          plate,
          normalizedPlate,
          vin: null,
          nextInspectionDate: null,
          rawNextInspectionDate: null,
          isValid: false,
          isPeriodic: true,
          ecoCategory: null,
          captchaMismatch: true,
          error: "CaptchaMismatchException",
          checkedAt: now,
        };
      }

      return {
        ok: false,
        found: false,
        plate,
        normalizedPlate,
        vin: null,
        nextInspectionDate: null,
        rawNextInspectionDate: null,
        isValid: false,
        isPeriodic: true,
        ecoCategory: null,
        error: data.error,
        checkedAt: now,
      };
    }

    // Found inspection record
    if (data.nextInspectionDate !== undefined) {
      const isoDate = parseRtaDateToIso(data.nextInspectionDate);
      return {
        ok: true,
        found: true,
        plate,
        normalizedPlate,
        vin: data.rvIdentNum || null,
        nextInspectionDate: isoDate,
        rawNextInspectionDate: data.nextInspectionDate,
        isValid: Boolean(data.isValid),
        isPeriodic: data.isPeriodic !== undefined ? Boolean(data.isPeriodic) : true,
        ecoCategory: data.ecoCategory || null,
        error: null,
        checkedAt: now,
      };
    }

    return {
      ok: true,
      found: false,
      plate,
      normalizedPlate,
      vin: null,
      nextInspectionDate: null,
      rawNextInspectionDate: null,
      isValid: false,
      isPeriodic: true,
      ecoCategory: null,
      error: "UNRECOGNIZED_RESPONSE",
      checkedAt: now,
    };
  } catch (err) {
    console.error("checkRtaInspection error:", err);
    return {
      ok: false,
      found: false,
      plate,
      normalizedPlate,
      vin: null,
      nextInspectionDate: null,
      rawNextInspectionDate: null,
      isValid: false,
      isPeriodic: true,
      ecoCategory: null,
      error: err instanceof Error ? err.message : "RTA_REQUEST_FAILED",
      checkedAt: now,
    };
  }
}

