"use client";

import { ArrowRight, Check, Crown, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ProGateStatItem {
  label: string;
  value: string;
}

interface ProFeatureGateProps {
  target: "user" | "garage";
  title: string;
  subtitle: string;
  features: string[];
  upgradeHref: string;
  monthlyPriceEur: number;
  subscriptionsEnabled: boolean;
  previewStats?: ProGateStatItem[];
}

export function ProFeatureGate({
  target,
  title,
  subtitle,
  features,
  upgradeHref,
  monthlyPriceEur,
  subscriptionsEnabled,
  previewStats = [],
}: ProFeatureGateProps) {
  const t = useTranslations("proGate");

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-amber-500/35 bg-gradient-to-br from-amber-500/[0.09] via-background to-primary/[0.08]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              variant="warning"
              className="gap-1.5 border-amber-500/40 bg-amber-500/15 text-amber-300"
            >
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              {target === "user" ? "DRIVER PRO" : "GARAGE PRO"}
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Lock className="h-3 w-3" aria-hidden="true" />
              {t("freePlanBadge")}
            </Badge>
          </div>
          <CardTitle className="text-xl sm:text-2xl flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground max-w-2xl">
            {subtitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {previewStats.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {previewStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/70 bg-secondary/40 p-3.5"
                >
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("includedToolsHeading")}
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {features.map((feat) => (
                <li
                  key={feat}
                  className="flex items-start gap-2.5 text-sm text-foreground"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("pricingLabel")}
              </p>
              <p className="font-mono text-xl font-bold text-foreground">
                €{monthlyPriceEur.toFixed(2)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {t("perMonth")}
                </span>
              </p>
            </div>

            {subscriptionsEnabled ? (
              <Button asChild variant="gradient" className="gap-2">
                <Link href={upgradeHref}>
                  <Crown className="h-4 w-4" aria-hidden="true" />
                  {t("unlockProCta")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs">
                {t("subscriptionsDisabled")}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

