export type BulgariaFuelCode = "gasoline" | "diesel" | "lpg" | "methane";

export interface BulgariaFuelHistoryPoint {
  date: string;
  priceEur: number;
}

export interface BulgariaFuelItem {
  code: BulgariaFuelCode;
  priceEur: number;
  priceBgn: number;
  unit: "L" | "kg";
  delta30dEur: number;
  delta30dPercent: number;
  history: BulgariaFuelHistoryPoint[];
  sourceUrl: string;
}

export interface BulgariaFuelPricesPayload {
  country: "BG";
  provider: string;
  providerUrl: string;
  fetchedAt: string;
  live: boolean;
  fuels: BulgariaFuelItem[];
}

export const EUR_TO_BGN_FIXED_RATE = 1.95583;

const FUEL_META: ReadonlyArray<{
  code: BulgariaFuelCode;
  chartId: string;
  titleId: string;
  unit: "L" | "kg";
  sourceUrl: string;
}> = [
  {
    code: "gasoline",
    chartId: "chart_gasoline",
    titleId: "petrol-title",
    unit: "L",
    sourceUrl: "https://bg.fuelo.net/fuel/type/gasoline",
  },
  {
    code: "diesel",
    chartId: "chart_diesel",
    titleId: "diesel-title",
    unit: "L",
    sourceUrl: "https://bg.fuelo.net/fuel/type/diesel",
  },
  {
    code: "lpg",
    chartId: "chart_lpg",
    titleId: "lpg-title",
    unit: "L",
    sourceUrl: "https://bg.fuelo.net/fuel/type/lpg",
  },
  {
    code: "methane",
    chartId: "chart_methane",
    titleId: "cng-title",
    unit: "kg",
    sourceUrl: "https://bg.fuelo.net/fuel/type/methane",
  },
];

function normalizeRawJsonpString(raw: string): string {
  // Unescape JS string escapes inside the JSONP wrapper (`\/`, `\n`, `\t`, `\"`)
  return raw
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

/**
 * Parses Fuelo.net Bulgaria's public widget feed (`https://bg.fuelo.net/widget/small`),
 * extracting current average retail prices in EUR, fixed-rate BGN equivalents, and
 * the 31-day daily price series for Petrol A95, Diesel, LPG, and CNG/Methane.
 */
export function parseFueloSmallWidgetPayload(
  rawPayload: string,
  fetchedAtIso = new Date().toISOString()
): BulgariaFuelPricesPayload | null {
  if (!rawPayload || rawPayload.length < 100) {
    return null;
  }

  const decoded = normalizeRawJsonpString(rawPayload);
  const fuels: BulgariaFuelItem[] = [];
  const baseAnchorDate = new Date(fetchedAtIso);

  for (const meta of FUEL_META) {
    // 1. Extract header price fallback (`id="petrol-title"...>1,59€/л<`)
    const titleRegex = new RegExp(
      `id=["']${meta.titleId}["'][\\s\\S]{0,420}?class=["']price["']>\\s*([0-9]+[.,][0-9]+)\\s*(€|лв)`,
      "i"
    );
    const titleMatch = decoded.match(titleRegex);
    let headerPriceEur: number | null = null;
    if (titleMatch?.[1]) {
      const parsedVal = Number.parseFloat(titleMatch[1].replace(",", "."));
      if (Number.isFinite(parsedVal) && parsedVal > 0) {
        const isBgn = titleMatch[2]?.toLowerCase() === "лв";
        headerPriceEur = isBgn
          ? Number((parsedVal / EUR_TO_BGN_FIXED_RATE).toFixed(2))
          : parsedVal;
      }
    }

    // 2. Extract 31-day series from Highcharts config (`renderTo: "chart_gasoline" ... data: [...]`)
    const chartIdx = decoded.indexOf(`renderTo: "${meta.chartId}"`);
    let seriesNumbers: number[] = [];
    if (chartIdx !== -1) {
      const chartSlice = decoded.slice(chartIdx, chartIdx + 1600);
      const dataMatch = chartSlice.match(/data:\s*\[([0-9.,\s]+)\]/);
      const suffixMatch = chartSlice.match(/valueSuffix:\s*"([^"]+)"/);
      const seriesInBgn = suffixMatch?.[1]?.includes("лв") ?? false;

      if (dataMatch?.[1]) {
        seriesNumbers = dataMatch[1]
          .split(",")
          .map((s) => Number.parseFloat(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
          .map((n) =>
            seriesInBgn ? Number((n / EUR_TO_BGN_FIXED_RATE).toFixed(2)) : n
          );
      }
    }

    const latestSeriesPrice =
      seriesNumbers.length > 0
        ? (seriesNumbers[seriesNumbers.length - 1] ?? null)
        : null;
    const priceEur = headerPriceEur ?? latestSeriesPrice;
    if (priceEur === null || priceEur <= 0) {
      continue;
    }

    const firstSeriesPrice =
      seriesNumbers.length > 0 ? (seriesNumbers[0] ?? priceEur) : priceEur;
    const delta30dEur = Number((priceEur - firstSeriesPrice).toFixed(2));
    const delta30dPercent =
      firstSeriesPrice > 0
        ? Number(((delta30dEur / firstSeriesPrice) * 100).toFixed(1))
        : 0;

    // Anchor history dates backwards from `fetchedAtIso` (1 day per data point)
    const history: BulgariaFuelHistoryPoint[] = seriesNumbers.map((val, idx) => {
      const daysBack = seriesNumbers.length - 1 - idx;
      const d = new Date(
        Date.UTC(
          baseAnchorDate.getUTCFullYear(),
          baseAnchorDate.getUTCMonth(),
          baseAnchorDate.getUTCDate() - daysBack
        )
      );
      return {
        date: d.toISOString().slice(0, 10),
        priceEur: Number(val.toFixed(2)),
      };
    });

    fuels.push({
      code: meta.code,
      priceEur: Number(priceEur.toFixed(2)),
      priceBgn: Number((priceEur * EUR_TO_BGN_FIXED_RATE).toFixed(2)),
      unit: meta.unit,
      delta30dEur,
      delta30dPercent,
      history,
      sourceUrl: meta.sourceUrl,
    });
  }

  if (fuels.length === 0) {
    return null;
  }

  return {
    country: "BG",
    provider: "Fuelo.net Bulgaria",
    providerUrl: "https://bg.fuelo.net",
    fetchedAt: fetchedAtIso,
    live: true,
    fuels,
  };
}

/**
 * Fetches actual current fuel prices for Bulgaria from Fuelo.net's public feed
 * (and optionally enriches with `FUELO_API_KEY` JSON endpoint if configured).
 */
export async function fetchBulgariaFuelPrices(options?: {
  bypassCache?: boolean;
}): Promise<BulgariaFuelPricesPayload | null> {
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch("https://bg.fuelo.net/widget/small", {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "User-Agent": "Veltrox-CarDiary/1.0 (+https://veltrox-gkdev.web.app)",
      },
      ...(options?.bypassCache
        ? { cache: "no-store" as const }
        : { next: { revalidate: 3600 } }),
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      return null;
    }

    const rawText = await response.text();
    const parsed = parseFueloSmallWidgetPayload(rawText, fetchedAt);
    if (!parsed) {
      return null;
    }

    // Optional enrichment via official Fuelo REST API key if user configured FUELO_API_KEY
    const apiKey = process.env.FUELO_API_KEY?.trim();
    if (apiKey) {
      await Promise.all(
        parsed.fuels.map(async (item) => {
          try {
            const apiRes = await fetch(
              `https://fuelo.net/api/price?key=${encodeURIComponent(apiKey)}&fuel=${item.code}`,
              {
                ...(options?.bypassCache
                  ? { cache: "no-store" as const }
                  : { next: { revalidate: 3600 } }),
                signal: AbortSignal.timeout(4000),
              }
            );
            if (!apiRes.ok) return;
            const json = (await apiRes.json()) as {
              status?: string;
              price?: number | string;
              dimension?: string;
            };
            if (json.status === "OK" && json.price !== undefined) {
              const num = Number(json.price);
              if (Number.isFinite(num) && num > 0) {
                const isBgn = (json.dimension ?? "").includes("лв");
                const eur = isBgn
                  ? Number((num / EUR_TO_BGN_FIXED_RATE).toFixed(2))
                  : Number(num.toFixed(2));
                item.priceEur = eur;
                item.priceBgn = Number((eur * EUR_TO_BGN_FIXED_RATE).toFixed(2));
              }
            }
          } catch {
            // Keep parsed widget price on API key error
          }
        })
      );
    }

    return parsed;
  } catch {
    return null;
  }
}

