import type { PlatformSettingsConfig, PromoCodeConfig } from "@/types/domain";

export type BillingTarget = "user" | "garage";
export type BillingCycle = "monthly" | "annual";

export interface BillingQuoteResult {
  target: BillingTarget;
  cycle: BillingCycle;
  baseMonthlyEur: number;
  annualDiscountPct: number;
  promoCodeInput: string | null;
  promoCodeMatched: PromoCodeConfig | null;
  promoInvalidReason: "not_found" | "inactive" | "wrong_target" | null;
  promoDiscountPct: number;
  subtotalEur: number;
  finalTotalEur: number;
  effectiveMonthlyEur: number;
  currency: "EUR" | "BGN";
}

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

/**
 * Computes monthly/annual subscription pricing including admin annual discount and promo code.
 */
export function calculateBillingQuote(params: {
  target: BillingTarget;
  cycle: BillingCycle;
  promoCode?: string | null;
  settings: Pick<
    PlatformSettingsConfig,
    | "defaultCurrency"
    | "proPlanPriceEur"
    | "userProPlanPriceEur"
    | "annualBillingDiscountPct"
    | "promoCodes"
  >;
}): BillingQuoteResult {
  const { target, cycle, settings } = params;
  const baseMonthlyEur = roundMoney(
    target === "user" ? settings.userProPlanPriceEur : settings.proPlanPriceEur
  );
  const annualDiscountPct =
    cycle === "annual"
      ? Math.min(80, Math.max(0, settings.annualBillingDiscountPct ?? 15))
      : 0;

  const subtotalEur =
    cycle === "annual"
      ? roundMoney(baseMonthlyEur * 12 * (1 - annualDiscountPct / 100))
      : baseMonthlyEur;

  const rawCode = params.promoCode?.trim().toUpperCase() || null;
  let promoCodeMatched: PromoCodeConfig | null = null;
  let promoInvalidReason: BillingQuoteResult["promoInvalidReason"] = null;
  let promoDiscountPct = 0;

  if (rawCode) {
    const found = (settings.promoCodes ?? []).find(
      (item) => item.code.toUpperCase() === rawCode
    );
    if (!found) {
      promoInvalidReason = "not_found";
    } else if (!found.active) {
      promoInvalidReason = "inactive";
    } else if (
      found.appliesTo &&
      found.appliesTo !== "all" &&
      found.appliesTo !== target
    ) {
      promoInvalidReason = "wrong_target";
    } else {
      promoCodeMatched = found;
      promoDiscountPct = Math.min(90, Math.max(0, found.discountPct));
    }
  }

  const finalTotalEur = roundMoney(subtotalEur * (1 - promoDiscountPct / 100));
  const effectiveMonthlyEur =
    cycle === "annual" ? roundMoney(finalTotalEur / 12) : finalTotalEur;

  return {
    target,
    cycle,
    baseMonthlyEur,
    annualDiscountPct,
    promoCodeInput: rawCode,
    promoCodeMatched,
    promoInvalidReason,
    promoDiscountPct,
    subtotalEur,
    finalTotalEur,
    effectiveMonthlyEur,
    currency: settings.defaultCurrency === "BGN" ? "BGN" : "EUR",
  };
}

