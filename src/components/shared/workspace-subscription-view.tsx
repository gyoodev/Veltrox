"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Gauge,
  Info,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SubscriptionBillingCard } from "@/components/shared/subscription-billing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils";
import type { AppLocale, PlatformSettingsConfig } from "@/types/domain";

const BGN_PER_EUR = 1.95583;

interface WorkspaceSubscriptionViewProps {
  target: "user" | "garage";
  entityLabel: string;
  currentPlan: "free" | "pro";
  subscriptionStatus?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "inactive"
    | null;
  billingCycle?: "monthly" | "annual" | null;
  planUpdatedAt?: string | null;
  stripeCustomerId?: string | null;
  settings: PlatformSettingsConfig;
  usageMetrics: {
    primaryUsed: number;
    primaryLimit: number | null;
    secondaryUsed?: number;
    secondaryQuota?: number;
  };
  backHref: string;
  billingQueryState?: "success" | "cancel" | null;
}

function formatEurPrice(eur: number, currency: "EUR" | "BGN"): string {
  const eurStr = `€${eur.toFixed(2)}`;
  if (currency === "BGN") {
    return `${eurStr} (≈ ${(eur * BGN_PER_EUR).toFixed(2)} лв.)`;
  }
  return eurStr;
}

export function WorkspaceSubscriptionView({
  target,
  entityLabel,
  currentPlan: initialPlan,
  subscriptionStatus,
  billingCycle,
  planUpdatedAt,
  stripeCustomerId,
  settings,
  usageMetrics,
  backHref,
  billingQueryState,
}: WorkspaceSubscriptionViewProps) {
  const t = useTranslations("subscriptionPage");
  const tBilling = useTranslations("billing");
  const locale = useLocale() as AppLocale;

  const [plan, setPlan] = useState<"free" | "pro">(initialPlan);

  const isPro = plan === "pro";
  const proMonthlyEur =
    target === "user"
      ? settings.userProPlanPriceEur
      : settings.proPlanPriceEur;

  const primaryPct =
    usageMetrics.primaryLimit && usageMetrics.primaryLimit > 0
      ? Math.min(
          100,
          Math.round((usageMetrics.primaryUsed / usageMetrics.primaryLimit) * 100)
        )
      : 0;

  const secondaryQuota = usageMetrics.secondaryQuota ?? 0;
  const secondaryUsed = usageMetrics.secondaryUsed ?? 0;
  const secondaryPct =
    secondaryQuota > 0
      ? Math.min(100, Math.round((secondaryUsed / secondaryQuota) * 100))
      : 0;

  const freeFeatures =
    target === "user"
      ? [
          t("userFreeFeature1", { limit: settings.freeUserVehicleLimit }),
          t("userFreeFeature2"),
          t("userFreeFeature3"),
          t("userFreeFeature4"),
        ]
      : [
          t("garageFreeFeature1", {
            limit: settings.freeGarageMonthlyWorkOrders,
          }),
          t("garageFreeFeature2"),
          t("garageFreeFeature3"),
          t("garageFreeFeature4"),
        ];

  const proFeatures =
    target === "user"
      ? [
          t("userProFeature1"),
          t("userProFeature2"),
          t("userProFeature3"),
          t("userProFeature4"),
        ]
      : [
          t("garageProFeature1"),
          t("garageProFeature2"),
          t("garageProFeature3"),
          t("garageProFeature4"),
        ];

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              {t("backToWorkspace")}
            </Link>
          </Button>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <CreditCard className="h-6 w-6 text-primary" />
            {target === "user" ? t("userPageTitle") : t("garagePageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {target === "user"
              ? t("userPageSubtitle")
              : t("garagePageSubtitle", { garage: entityLabel })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={isPro ? "success" : "secondary"}
            className="gap-1.5 px-3 py-1 text-xs font-semibold"
          >
            {isPro ? <Crown className="h-3.5 w-3.5" /> : null}
            {isPro ? tBilling("planProBadge") : tBilling("planFreeBadge")}
          </Badge>
          {isPro && billingCycle ? (
            <Badge variant="outline" className="text-xs">
              {billingCycle === "annual"
                ? tBilling("annualBilling")
                : tBilling("monthlyBilling")}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Stripe Return Banners */}
      {billingQueryState === "success" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{t("checkoutSuccessBanner")}</span>
        </div>
      ) : null}
      {billingQueryState === "cancel" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-300">
          <Info className="h-5 w-5 shrink-0 text-amber-400" />
          <span>{t("checkoutCancelBanner")}</span>
        </div>
      ) : null}

      {/* Top Grid: Usage Meters + Subscription Checkout Card */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-primary" />
                {t("usageCardTitle")}
              </CardTitle>
              <CardDescription>{entityLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primary Limit Meter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {target === "user"
                      ? t("vehiclesUsageLabel")
                      : t("monthlyWorkOrdersLabel")}
                  </span>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {isPro || usageMetrics.primaryLimit === null
                      ? `${usageMetrics.primaryUsed} / ∞`
                      : `${usageMetrics.primaryUsed} / ${usageMetrics.primaryLimit}`}
                  </span>
                </div>
                {!isPro && usageMetrics.primaryLimit ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${
                        primaryPct >= 100
                          ? "bg-destructive"
                          : primaryPct >= 80
                            ? "bg-amber-500"
                            : "bg-primary"
                      }`}
                      style={{ width: `${primaryPct}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400">
                    {t("unlimitedActive")}
                  </p>
                )}
              </div>

              {/* Secondary Meter for Garage Reminders Quota */}
              {target === "garage" && secondaryQuota > 0 ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {t("monthlyRemindersLabel")}
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {secondaryUsed} / {secondaryQuota}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${secondaryPct}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {/* Subscription Metadata */}
              <div className="space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t("statusField")}</span>
                  <span className="font-mono font-semibold text-foreground">
                    {subscriptionStatus ?? (isPro ? "active" : "inactive")}
                  </span>
                </div>
                {planUpdatedAt ? (
                  <div className="flex justify-between">
                    <span>{t("updatedField")}</span>
                    <span className="font-mono text-foreground">
                      {formatDateShort(planUpdatedAt, locale)}
                    </span>
                  </div>
                ) : null}
                {stripeCustomerId ? (
                  <div className="flex justify-between">
                    <span>Stripe ID</span>
                    <span className="font-mono text-foreground">
                      {stripeCustomerId.slice(0, 14)}…
                    </span>
                  </div>
                ) : null}
              </div>

              <Button
                asChild
                variant={isPro ? "gradient" : "outline"}
                size="sm"
                className="w-full gap-2"
              >
                <Link
                  href={target === "user" ? "/app/pro-tools" : "/garage/pro-tools"}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {t("openProToolsCta")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <SubscriptionBillingCard
            target={target}
            currentPlan={plan}
            subscriptionStatus={subscriptionStatus}
            billingCycle={billingCycle}
            stripeCustomerId={stripeCustomerId}
            settings={settings}
            onPlanChanged={(next) => setPlan(next)}
          />
        </div>
      </div>

      {/* Plan Comparison Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("comparePlansHeading")}
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {/* Free Tier Card */}
          <Card
            className={`p-6 ${
              !isPro ? "border-primary/40 ring-1 ring-primary/20" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {target === "user" ? t("userFreeTier") : t("garageFreeTier")}
                </h3>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                  €0.00{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {tBilling("monthUnit")}
                  </span>
                </p>
              </div>
              {!isPro ? (
                <Badge variant="default">{t("currentPlanTag")}</Badge>
              ) : null}
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
              {freeFeatures.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Pro Tier Card */}
          <Card
            className={`border-primary/40 bg-primary/[0.03] p-6 ${
              isPro ? "ring-1 ring-primary/35" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {target === "user" ? t("userProTier") : t("garageProTier")}
                </h3>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {formatEurPrice(proMonthlyEur, settings.defaultCurrency)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {tBilling("monthUnit")}
                  </span>
                </p>
              </div>
              {isPro ? (
                <Badge variant="success">{t("currentPlanTag")}</Badge>
              ) : (
                <Badge variant="violet">PRO</Badge>
              )}
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-foreground/90">
              {proFeatures.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

