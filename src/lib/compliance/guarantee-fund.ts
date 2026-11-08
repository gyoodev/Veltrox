import https from "node:https";
import crypto from "node:crypto";

/**
 * Official Guarantee Fund (Гаранционен фонд / ЕИСОУКР)
 * Mandatory Civil Liability Insurance Portal (Гражданска отговорност на автомобилистите)
 *
 * Official Portal: https://www.guaranteefund.org/bg/информационен-център-и-справки/услуги/проверка-за-валидна-застраховка-грaждaнскa-отговорност-на-автомобилистите
 */

export interface GfChallengeResponse {
  ok: boolean;
  challenge?: {
    algorithm: string;
    challenge: string;
    maxNumber: number;
    salt: string;
    signature: string;
  };
  sessionToken?: string; // Base64-encoded cookies
  error?: string;
}

export interface GfLiabilityResult {
  ok: boolean;
  found: boolean;
  plate: string;
  normalizedPlate: string;
  vin: string | null;
  insurer: string | null;
  startDate: string | null; // ISO YYYY-MM-DD
  endDate: string | null; // ISO YYYY-MM-DD
  rawStartDate: string | null;
  rawEndDate: string | null;
  pdfUrl: string | null;
  isValid: boolean;
  message: string | null;
  error?: string | null;
  checkedAt: string;
}

export const GF_CHECK_PAGE_URL =
  "https://www.guaranteefund.org/bg/%D0%B8%D0%BD%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%86%D0%B8%D0%BE%D0%BD%D0%B5%D0%BD-%D1%86%D0%B5%D0%BD%D1%82%D1%8A%D1%80-%D0%B8-%D1%81%D0%BF%D1%80%D0%B0%D0%B2%D0%BA%D0%B8/%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8/%D0%BF%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%BA%D0%B0-%D0%B7%D0%B0-%D0%B2%D0%B0%D0%BB%D0%B8%D0%B4%D0%BD%D0%B0-%D0%B7%D0%B0%D1%81%D1%82%D1%80%D0%B0%D1%85%D0%BE%D0%B2%D0%BA%D0%B0-%D0%B3%D1%80a%D0%B6%D0%B4a%D0%BD%D1%81%D0%BAa-%D0%BE%D1%82%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BD%D0%BE%D1%81%D1%82-%D0%BD%D0%B0-%D0%B0%D0%B2%D1%82%D0%BE%D0%BC%D0%BE%D0%B1%D0%B8%D0%BB%D0%B8%D1%81%D1%82%D0%B8%D1%82%D0%B5";

const GF_CHALLENGE_URL = "https://www.guaranteefund.org/ajax/altchagenchlange.php?code=1";

/**
 * Normalizes Bulgarian vehicle registration plate according to Guarantee Fund requirements.
 * Converts overlapping Cyrillic letters to Latin uppercase, strips spaces & dashes.
 */
export function normalizePlateForGf(plate: string): string {
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
 * Parses date string returned by Guarantee Fund (e.g. "14.04.2027г. 23:59:59ч." or "14.04.2027") into YYYY-MM-DD.
 */
export function parseGfDateToIso(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;

  const d = match[1].padStart(2, "0");
  const m = match[2].padStart(2, "0");
  const y = match[3];
  return `${y}-${m}-${d}`;
}

/**
 * Helper to execute HTTPS request with tolerant TLS options for Bulgarian state server.
 */
function requestHttps(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: string;
}> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {},
      agent: new https.Agent({ rejectUnauthorized: false }),
    };

    const req = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 200,
          headers: res.headers,
          text: data,
        });
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Solves the ALTCHA SHA-256 proof-of-work challenge.
 */
export function solveAltcha(challenge: {
  algorithm: string;
  challenge: string;
  maxNumber: number;
  salt: string;
  signature: string;
}): string | null {
  const { algorithm, challenge: targetHash, maxNumber, salt, signature } = challenge;
  const max = maxNumber || 50000;

  for (let n = 0; n <= max; n++) {
    const hash = crypto.createHash("sha256").update(salt + n).digest("hex");
    if (hash === targetHash) {
      const payload = {
        algorithm,
        challenge: targetHash,
        number: n,
        salt,
        signature,
      };
      return Buffer.from(JSON.stringify(payload)).toString("base64");
    }
  }
  return null;
}

/**
 * Fetches initial Guarantee Fund session cookies and fresh ALTCHA challenge.
 */
export async function fetchGfChallenge(): Promise<GfChallengeResponse> {
  try {
    const pageRes = await requestHttps(GF_CHECK_PAGE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const setCookie = pageRes.headers["set-cookie"] || [];
    const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
    const cookieHeader = cookieArray.map((c) => c.split(";")[0]).join("; ");

    const chalRes = await requestHttps(GF_CHALLENGE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Cookie: cookieHeader,
        Referer: GF_CHECK_PAGE_URL,
      },
    });

    if (chalRes.status !== 200) {
      return { ok: false, error: `GF_CHALLENGE_HTTP_${chalRes.status}` };
    }

    const chalData = JSON.parse(chalRes.text) as {
      algorithm: string;
      challenge: string;
      maxNumber: number;
      salt: string;
      signature: string;
    };

    return {
      ok: true,
      challenge: chalData,
      sessionToken: Buffer.from(cookieHeader).toString("base64"),
    };
  } catch (err) {
    console.error("fetchGfChallenge error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "GF_CHALLENGE_FAILED",
    };
  }
}

/**
 * Submits query to the Guarantee Fund registry for a vehicle plate or VIN.
 */
export async function checkGfLiability(params: {
  plate: string;
  vin?: string | null;
  altchaPayload?: string | null;
  sessionToken?: string | null;
}): Promise<GfLiabilityResult> {
  const { plate, vin } = params;
  const normalizedPlate = normalizePlateForGf(plate);
  const now = new Date().toISOString();

  if (!normalizedPlate) {
    return {
      ok: false,
      found: false,
      plate,
      normalizedPlate: "",
      vin: vin || null,
      insurer: null,
      startDate: null,
      endDate: null,
      rawStartDate: null,
      rawEndDate: null,
      pdfUrl: null,
      isValid: false,
      message: "Липсва регистрационен номер.",
      error: "INVALID_PLATE",
      checkedAt: now,
    };
  }

  try {
    let cookieHeader = "";
    let altcha = params.altchaPayload?.trim() || "";

    if (params.sessionToken) {
      try {
        cookieHeader = Buffer.from(params.sessionToken, "base64").toString("utf-8");
      } catch {
        cookieHeader = "";
      }
    }

    // If no active session or solved ALTCHA, initialize challenge & solve
    if (!cookieHeader || !altcha) {
      const challengeRes = await fetchGfChallenge();
      if (!challengeRes.ok || !challengeRes.challenge || !challengeRes.sessionToken) {
        return {
          ok: false,
          found: false,
          plate,
          normalizedPlate,
          vin: vin || null,
          insurer: null,
          startDate: null,
          endDate: null,
          rawStartDate: null,
          rawEndDate: null,
          pdfUrl: null,
          isValid: false,
          message: "Неуспешно свързване с Гаранционния фонд.",
          error: challengeRes.error || "CHALLENGE_FAILED",
          checkedAt: now,
        };
      }

      cookieHeader = Buffer.from(challengeRes.sessionToken, "base64").toString("utf-8");
      const solved = solveAltcha(challengeRes.challenge);
      if (!solved) {
        return {
          ok: false,
          found: false,
          plate,
          normalizedPlate,
          vin: vin || null,
          insurer: null,
          startDate: null,
          endDate: null,
          rawStartDate: null,
          rawEndDate: null,
          pdfUrl: null,
          isValid: false,
          message: "Неуспешна проверка на кода за сигурност.",
          error: "ALTCHA_SOLVE_FAILED",
          checkedAt: now,
        };
      }
      altcha = solved;
    }

    // Current Bulgarian date & time format
    const currDate = new Date();
    const day = String(currDate.getDate()).padStart(2, "0");
    const month = String(currDate.getMonth() + 1).padStart(2, "0");
    const year = currDate.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    const hours = String(currDate.getHours()).padStart(2, "0");
    const mins = String(currDate.getMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${mins}`;

    const formData = new URLSearchParams();
    formData.append("dkn", normalizedPlate);
    formData.append("rama", (vin || "").trim().toUpperCase());
    formData.append("stiker", "");
    formData.append("seria", "");
    formData.append("date", dateStr);
    formData.append("datepickertime", timeStr);
    formData.append("altcha", altcha);
    formData.append("send", "търси");

    const postRes = await requestHttps(`${GF_CHECK_PAGE_URL}#validgo`, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader,
        Referer: GF_CHECK_PAGE_URL,
      },
      body: formData.toString(),
    });

    if (postRes.status !== 200) {
      return {
        ok: false,
        found: false,
        plate,
        normalizedPlate,
        vin: vin || null,
        insurer: null,
        startDate: null,
        endDate: null,
        rawStartDate: null,
        rawEndDate: null,
        pdfUrl: null,
        isValid: false,
        message: `Грешка от сървъра на Гаранционен фонд (HTTP ${postRes.status}).`,
        error: `GF_HTTP_${postRes.status}`,
        checkedAt: now,
      };
    }

    const html = postRes.text;

    // 1. Check for success-results table
    const tableMatch = html.match(/<table class="success-results"[\s\S]*?<\/table>/i);
    if (tableMatch) {
      const tableHtml = tableMatch[0];
      const cells = [...tableHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        (m[1] ?? "").trim()
      );

      const insurer = (cells[0] ?? "").replace(/<[^>]+>/g, "").trim() || "Застраховател";
      const rawStart = (cells[1] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const rawEnd = (cells[2] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const startDate = parseGfDateToIso(rawStart);
      const endDate = parseGfDateToIso(rawEnd);

      const pdfMatch = tableHtml.match(/href="([^"]*gengopdf[^"]*)"/i);
      const pdfUrl = pdfMatch && pdfMatch[1]
        ? pdfMatch[1].startsWith("http")
          ? pdfMatch[1]
          : `https://www.guaranteefund.org${pdfMatch[1]}`
        : null;

      return {
        ok: true,
        found: true,
        plate,
        normalizedPlate,
        vin: vin || null,
        insurer,
        startDate,
        endDate,
        rawStartDate: rawStart || null,
        rawEndDate: rawEnd || null,
        pdfUrl,
        isValid: true,
        message: `Превозно средство с рег. номер ${normalizedPlate} има валидна задължителна застраховка Гражданска отговорност.`,
        error: null,
        checkedAt: now,
      };
    }

    // 2. Check for explicit not-found warning
    const h6Match = html.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
    const message = h6Match?.[1]
      ? h6Match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : `В регистъра на Гаранционния фонд няма активна застраховка Гражданска отговорност за рег. номер ${normalizedPlate}.`;

    return {
      ok: true,
      found: false,
      plate,
      normalizedPlate,
      vin: vin || null,
      insurer: null,
      startDate: null,
      endDate: null,
      rawStartDate: null,
      rawEndDate: null,
      pdfUrl: null,
      isValid: false,
      message,
      error: "NO_ACTIVE_POLICY",
      checkedAt: now,
    };
  } catch (err) {
    console.error("checkGfLiability error:", err);
    return {
      ok: false,
      found: false,
      plate,
      normalizedPlate,
      vin: vin || null,
      insurer: null,
      startDate: null,
      endDate: null,
      rawStartDate: null,
      rawEndDate: null,
      pdfUrl: null,
      isValid: false,
      message: "Възникна техническа грешка при връзка с Гаранционния фонд.",
      error: err instanceof Error ? err.message : "GF_REQUEST_FAILED",
      checkedAt: now,
    };
  }
}

