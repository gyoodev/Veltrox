"use client";

import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Sparkles,
  Tag,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type BillingCycle,
  type BillingQuoteResult,
  type BillingTarget,
  calculateBillingQuote,
} from "@/lib/billing/quote";
import { getFirebaseClient } from "@/lib/firebase/client";
import type { PlatformSettingsConfig } from "@/types/domain";

const BGN_PER_EUR = 1.95583;

interface SubscriptionBillingCardProps {
  target: BillingTarget;
  currentPlan: "free" | "pro";
  subscriptionStatus?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "inactive"
    | null;
  billingCycle?: "monthly" | "annual" | null;
  stripeCustomerId?: string | null;
  settings: PlatformSettingsConfig;
  onPlanChanged?: (nextPlan: "free" | "pro") => void;
}

function formatEurAndBgn(eur: number, defaultCurrency: "EUR" | "BGN"): string {
  const eurStr = `€${eur.toFixed(2)}`;
  if (defaultCurrency === "BGN") {
    return `${eurStr} (≈ ${(eur * BGN_PER_EUR).toFixed(2)} лв.)`;
  }
  return eurStr;
}

export function SubscriptionBillingCard({
  target,
  currentPlan,
  subscriptionStatus,
  billingCycle,
  stripeCustomerId,
  settings,
  onPlanChanged,
}: SubscriptionBillingCardProps) {
  const t = useTranslations("billing");
  const router = useRouter();

  const [cycle, setCycle] = useState<BillingCycle>(
    billingCycle === "annual" ? "annual" : "monthly"
  );
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverQuote, setServerQuote] = useState<BillingQuoteResult | null>(
    null
  );

  const liveQuote = useMemo(() => {
    const calculated = calculateBillingQuote({
      target,
      cycle,
      promoCode: appliedPromo,
      settings,
    });
    if (
      serverQuote &&
      serverQuote.target === target &&
      serverQuote.cycle === cycle &&
      serverQuote.promoCodeInput === appliedPromo
    ) {
      return serverQuote;
    }
    return calculated;
  }, [target, cycle, appliedPromo, settings, serverQuote]);

  const subscriptionsEnabled =
    target === "user"
      ? settings.userSubscriptionsEnabled
      : settings.garageSubscriptionsEnabled;

  const isPro = currentPlan === "pro";

  async function buildAuthHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const fb = getFirebaseClient();
    if (fb?.auth.currentUser) {
      try {
        const token = await fb.auth.currentUser.getIdToken(false);
        headers.Authorization = `Bearer ${token}`;
      } catch {}
    }
    return headers;
  }

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      setServerQuote(null);
      return;
    }

    setPreviewing(true);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          target,
          action: "preview",
          cycle,
          promoCode: code,
        }),
      });
      if (!res.ok) {
        toast.error(t("checkoutError"));
        return;
      }
      const data = (await res.json()) as { quote: BillingQuoteResult };
      setAppliedPromo(code);
      setServerQuote(data.quote);
      if (data.quote.promoCodeMatched) {
        toast.success(
          t("promoAppliedToast", {
            code: data.quote.promoCodeMatched.code,
            pct: data.quote.promoCodeMatched.discountPct,
          })
        );
      } else {
        toast.error(t("promoInvalid"));
      }
    } catch {
      toast.error(t("checkoutError"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleStartCheckout = async () => {
    setSubmitting(true);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          target,
          action: "checkout",
          cycle,
          promoCode: appliedPromo,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        mode?: "stripe" | "simulated";
        url?: string | null;
        activated?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data) {
        toast.error(t("checkoutError"));
        return;
      }

      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.activated) {
        toast.success(t("upgradedToast"));
        onPlanChanged?.("pro");
        router.refresh();
      }
    } catch {
      toast.error(t("checkoutError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManagePortalOrCancel = async () => {
    setSubmitting(true);
    try {
      const headers = await buildAuthHeaders();
      if (stripeCustomerId && !stripeCustomerId.startsWith("cus_sim_")) {
        const res = await fetch("/api/billing/portal", {
          method: "POST",
          headers,
          body: JSON.stringify({ target }),
        });
        const data = (await res.json().catch(() => null)) as {
          mode?: "stripe" | "simulated";
          url?: string | null;
        } | null;
        if (res.ok && data?.mode === "stripe" && data.url) {
          window.location.href = data.url;
          return;
        }
      }

      const cancelRes = await fetch("/api/billing/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          target,
          action: "cancel",
          cycle,
        }),
      });
      if (!cancelRes.ok) {
        toast.error(t("checkoutError"));
        return;
      }
      toast.success(t("downgradedToast"));
      onPlanChanged?.("free");
      router.refresh();
    } catch {
      toast.error(t("checkoutError"));
    } finally {
      setSubmitting(false);
    }
  };

  const freeLimitDescription =
    target === "user"
      ? t("userFreeLimit", { limit: settings.freeUserVehicleLimit })
      : t("garageFreeLimit", { limit: settings.freeGarageMonthlyWorkOrders });

  return (
    <Card className="overflow-hidden border-primary/25 bg-primary/[0.03] shadow-sm">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {target === "user" ? t("driverProTitle") : t("garageProTitle")}
              </CardTitle>
              <CardDescription className="text-xs">
                {target === "user"
                  ? t("driverProSubtitle")
                  : t("garageProSubtitle")}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isPro ? "default" : "secondary"}>
              {isPro ? t("planProBadge") : t("planFreeBadge")}
            </Badge>
            {subscriptionStatus ? (
              <Badge variant="outline" className="text-[11px]">
                {subscriptionStatus}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {!isPro ? (
          <>
            <p className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-xs text-muted-foreground">
              {freeLimitDescription}
            </p>

            {subscriptionsEnabled ? (
              <>
                {/* Monthly / Annual cycle toggle */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCycle("monthly");
                      setServerQuote(null);
                    }}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      cycle === "monthly"
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-secondary/25 hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("monthlyBilling")}
                    </span>
                    <span className="mt-1 font-mono text-lg font-bold text-foreground">
                      {formatEurAndBgn(
                        liveQuote.baseMonthlyEur,
                        settings.defaultCurrency
                      )}
                      <span className="text-xs font-normal text-muted-foreground">
                        /{t("monthUnit")}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCycle("annual");
                      setServerQuote(null);
                    }}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      cycle === "annual"
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-secondary/25 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("annualBilling")}
                      </span>
                      {settings.annualBillingDiscountPct > 0 ? (
                        <Badge variant="success" className="text-[10px]">
                          -{settings.annualBillingDiscountPct}%
                        </Badge>
                      ) : null}
                    </div>
                    <span className="mt-1 font-mono text-lg font-bold text-foreground">
                      {formatEurAndBgn(
                        calculateBillingQuote({
                          target,
                          cycle: "annual",
                          promoCode: appliedPromo,
                          settings,
                        }).effectiveMonthlyEur,
                        settings.defaultCurrency
                      )}
                      <span className="text-xs font-normal text-muted-foreground">
                        /{t("monthUnit")}
                      </span>
                    </span>
                  </button>
                </div>

                {/* Promo Code Input */}
                <div className="space-y-1.5">
                  <Label htmlFor={`promo-${target}`} className="text-xs">
                    {t("promoCodeLabel")}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`promo-${target}`}
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder={t("promoCodePlaceholder")}
                        className="pl-9 font-mono uppercase"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleApplyPromo}
                      disabled={previewing}
                    >
                      {previewing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("applyPromo")
                      )}
                    </Button>
                  </div>
                  {liveQuote.promoCodeMatched ? (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("promoAppliedToast", {
                        code: liveQuote.promoCodeMatched.code,
                        pct: liveQuote.promoCodeMatched.discountPct,
                      })}
                    </p>
                  ) : liveQuote.promoInvalidReason ? (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5" />
                      {t("promoInvalid")}
                    </p>
                  ) : null}
                </div>

                {/* Total & Upgrade CTA */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-background/70 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {cycle === "annual"
                        ? t("billedAnnually")
                        : t("billedMonthly")}
                    </p>
                    <p className="font-mono text-xl font-extrabold text-foreground">
                      {formatEurAndBgn(
                        liveQuote.finalTotalEur,
                        settings.defaultCurrency
                      )}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="gradient"
                    onClick={handleStartCheckout}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {t("upgradeCta")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("subscriptionsDisabledNotice")}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                {t("proActiveHeading")}
              </p>
              <p className="text-xs text-muted-foreground">
                {billingCycle === "annual"
                  ? t("billedAnnually")
                  : t("billedMonthly")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleManagePortalOrCancel}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {stripeCustomerId && !stripeCustomerId.startsWith("cus_sim_")
                ? t("manageBillingPortal")
                : t("switchToFree")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

