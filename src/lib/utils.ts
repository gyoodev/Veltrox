import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AppLocale } from "@/types/domain";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string | undefined | null): string {
  if (!name) return "VX";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "VX";
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? "VX").toUpperCase();
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function formatCurrency(
  amount: number,
  locale: AppLocale = "bg",
  currency: "EUR" | "BGN" = "EUR"
): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(
  isoDate: string,
  locale: AppLocale = "bg"
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export const formatDateShort = formatDate;

