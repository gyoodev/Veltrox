import type { Garage, WorkingHoursMap } from "@/types/domain";

const CYRILLIC_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};

/**
 * Converts a Bulgarian Cyrillic or Latin garage name into a clean URL slug.
 */
export function slugifyGarageName(raw: string): string {
  const transliterated = raw
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join("");

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);

  return slug.length >= 2 ? slug : "garage";
}

/**
 * Masks a license plate for GDPR-safe public status links (`CB 1234 AB` -> `CB **** AB`).
 */
export function maskLicensePlate(plate: string): string {
  const clean = plate.trim().toUpperCase().replace(/\s+/g, "");
  if (clean.length <= 4) {
    return `${clean.slice(0, 1)}***`;
  }
  const prefix = clean.slice(0, 2);
  const suffix = clean.slice(-2);
  return `${prefix} **** ${suffix}`;
}

/**
 * Generates a high-entropy URL-safe public status token (128-bit entropy).
 */
export function generatePublicStatusToken(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(22);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return out;
}

export function buildDefaultWorkingHours(): WorkingHoursMap {
  return {
    mon: { open: "08:30", close: "18:00", closed: false },
    tue: { open: "08:30", close: "18:00", closed: false },
    wed: { open: "08:30", close: "18:00", closed: false },
    thu: { open: "08:30", close: "18:00", closed: false },
    fri: { open: "08:30", close: "18:00", closed: false },
    sat: { open: "09:00", close: "14:00", closed: false },
    sun: { open: "09:00", close: "14:00", closed: true },
  };
}

export function getCurrentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getEffectiveReminderQuota(
  garage: Pick<
    Garage,
    "monthlyReminderQuota" | "monthlyRemindersUsed" | "quotaResetMonth"
  >,
  now = new Date()
): { used: number; quota: number; remaining: number; monthKey: string } {
  const monthKey = getCurrentMonthKey(now);
  const used =
    garage.quotaResetMonth === monthKey ? garage.monthlyRemindersUsed : 0;
  const quota = Math.max(0, garage.monthlyReminderQuota);
  return {
    used,
    quota,
    remaining: Math.max(0, quota - used),
    monthKey,
  };
}

/**
 * Escapes CSV cells against spreadsheet formula injection (`=`, `+`, `-`, `@`)
 * and prepends UTF-8 BOM (`\uFEFF`) so Excel renders Bulgarian Cyrillic cleanly.
 */
export function serializeCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>
): string {
  const escapeCell = (
    raw: string | number | boolean | null | undefined
  ): string => {
    if (raw === null || raw === undefined) return "";
    let str = String(raw);
    if (
      typeof raw === "string" &&
      str.length > 0 &&
      /^[=+\-@\t\r]/.test(str)
    ) {
      str = `'${str}`;
    }
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

