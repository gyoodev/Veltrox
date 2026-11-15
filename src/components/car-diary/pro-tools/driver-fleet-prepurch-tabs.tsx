"use client";

import {
  AlertTriangle,
  Car,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Scale,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeDriverFleetComparison,
  computePrePurchaseScore,
  type InspectionItemStatus,
  PRE_PURCHASE_CHECKLIST_ITEMS,
  type PrePurchaseCheckKey,
} from "@/lib/subscriptions/pro-metrics-extended";
import { formatCurrency } from "@/lib/utils";
import type { AppLocale, DiaryEntry, Vehicle } from "@/types/domain";

interface DriverFleetKeepReplaceTabProps {
  vehicles: Vehicle[];
  entries: DiaryEntry[];
  locale: AppLocale;
}

export function DriverFleetKeepReplaceTab({
  vehicles,
  entries,
  locale,
}: DriverFleetKeepReplaceTabProps) {
  const t = useTranslations("driverProTools");

  const [marketValues, setMarketValues] = useState<Record<string, number>>(
    () => {
      const init: Record<string, number> = {};
      for (const v of vehicles) {
        init[v.id] = 8500;
      }
      return init;
    }
  );
  const [selectedId, setSelectedId] = useState<string>(vehicles[0]?.id ?? "");
  const [replacementMonthlyEur, setReplacementMonthlyEur] =
    useState<number>(320);

  const fleetRows = useMemo(
    () => computeDriverFleetComparison(vehicles, entries, marketValues),
    [entries, marketValues, vehicles]
  );

  const focusedRow =
    fleetRows.find((r) => r.vehicle.id === selectedId) ?? fleetRows[0] ?? null;

  const currentMarketVal = focusedRow
    ? (marketValues[focusedRow.vehicle.id] ?? 8500)
    : 8500;
  const keepYearlyProjectedEur = focusedRow
    ? Math.max(focusedRow.repairs12mEur, focusedRow.monthlyBurnEur * 12)
    : 0;
  const replaceYearlyCostEur = Math.max(0, replacementMonthlyEur) * 12;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("fleetCompareTitle")}
          </CardTitle>
          <CardDescription>{t("fleetCompareDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fleetRows.map((row) => {
            const pct = row.repairToValuePct;
            const verdictVariant =
              pct === null
                ? "secondary"
                : pct >= 35
                  ? "destructive"
                  : pct >= 20
                    ? "warning"
                    : "success";
            const verdictLabel =
              pct === null
                ? "—"
                : pct >= 35
                  ? t("fleetVerdictReplace")
                  : pct >= 20
                    ? t("fleetVerdictWatch")
                    : t("fleetVerdictKeep");
            return (
              <div
                key={row.vehicle.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {row.vehicle.make} {row.vehicle.model} ({row.vehicle.year})
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.vehicle.plateNumber}
                    </Badge>
                    <Badge variant={verdictVariant} className="text-xs">
                      {verdictLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {t("fleetStatsLine", {
                      burn: formatCurrency(row.monthlyBurnEur, locale, "EUR"),
                      repairs: formatCurrency(row.repairs12mEur, locale, "EUR"),
                      total: formatCurrency(row.totalSpendEur, locale, "EUR"),
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {t("fleetMarketValLabel")}
                  </Label>
                  <Input
                    type="number"
                    min={500}
                    step={500}
                    className="w-28 font-mono"
                    value={marketValues[row.vehicle.id] ?? 8500}
                    onChange={(e) => {
                      const next = Number(e.target.value) || 0;
                      setMarketValues((prev) => ({
                        ...prev,
                        [row.vehicle.id]: next,
                      }));
                    }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {focusedRow ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp
                className="h-4 w-4 text-emerald-400"
                aria-hidden="true"
              />
              {t("fleetSimulatorTitle")}
            </CardTitle>
            <CardDescription>{t("fleetSimulatorDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t("quickFuelVehicleLabel")}</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.make} {v.model} ({v.plateNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("fleetMarketValLabel")}</Label>
                <Input
                  type="number"
                  min={500}
                  step={500}
                  value={currentMarketVal}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 0;
                    setMarketValues((prev) => ({
                      ...prev,
                      [focusedRow.vehicle.id]: next,
                    }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fleetReplacementPaymentLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  step={25}
                  value={replacementMonthlyEur}
                  onChange={(e) =>
                    setReplacementMonthlyEur(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-border/60 bg-background/50 p-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("fleetRepairRatioLabel")}
                </p>
                <p className="font-mono text-xl font-bold text-primary">
                  {focusedRow.repairToValuePct ?? 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("fleetKeepAnnualLabel")}
                </p>
                <p className="font-mono text-xl font-bold text-foreground">
                  {formatCurrency(keepYearlyProjectedEur, locale, "EUR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("fleetReplaceAnnualLabel")}
                </p>
                <p className="font-mono text-xl font-bold text-amber-400">
                  {formatCurrency(replaceYearlyCostEur, locale, "EUR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface DriverPrePurchaseTabProps {
  locale: AppLocale;
}

export function DriverPrePurchaseTab({ locale }: DriverPrePurchaseTabProps) {
  const t = useTranslations("driverProTools");

  const [carTitle, setCarTitle] = useState("VW Passat 2.0 TDI 2018");
  const [askingPriceEur, setAskingPriceEur] = useState<number>(12500);
  const [notaryTaxEur, setNotaryTaxEur] = useState<number>(480);
  const [initialServiceEur, setInitialServiceEur] = useState<number>(520);
  const [tyresBrakesEur, setTyresBrakesEur] = useState<number>(380);
  const [insuranceVignetteEur, setInsuranceVignetteEur] =
    useState<number>(210);

  const [statuses, setStatuses] = useState<
    Record<PrePurchaseCheckKey, InspectionItemStatus>
  >(() => {
    const init = {} as Record<PrePurchaseCheckKey, InspectionItemStatus>;
    for (const k of PRE_PURCHASE_CHECKLIST_ITEMS) {
      init[k] = "ok";
    }
    return init;
  });

  const [copied, setCopied] = useState(false);

  const result = useMemo(() => computePrePurchaseScore(statuses), [statuses]);

  const catchUpTotalEur =
    Math.max(0, notaryTaxEur) +
    Math.max(0, initialServiceEur) +
    Math.max(0, tyresBrakesEur) +
    Math.max(0, insuranceVignetteEur);
  const suggestedCounterOfferEur = Math.round(
    Math.max(0, askingPriceEur) * (1 - result.suggestedDiscountPct / 100)
  );
  const trueDayOneTotalEur = suggestedCounterOfferEur + catchUpTotalEur;

  const handleCopySummary = async () => {
    const flagged = PRE_PURCHASE_CHECKLIST_ITEMS.filter(
      (k) => statuses[k] !== "ok"
    )
      .map((k) => `- ${t(`ppItem_${k}`)}: ${statuses[k].toUpperCase()}`)
      .join("\n");
    const text = [
      `Veltrox Pre-Purchase Inspection: ${carTitle}`,
      `Score: ${result.scorePct}/100 (${result.redFlagCount} Red Flags, ${result.attentionCount} Attention)`,
      `Asking: €${askingPriceEur} | Suggested Counter-Offer: €${suggestedCounterOfferEur}`,
      `Day-1 Catch-Up Costs (Notary/Tax + Service + Tyres + GO/Vignette): €${catchUpTotalEur}`,
      `True Drive-Away Budget: €${trueDayOneTotalEur}`,
      flagged ? `\nInspection Findings:\n${flagged}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("ppCopiedToast"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("dossierCopyError"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("ppScoreLabel")}</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold ${
              result.scorePct >= 80
                ? "text-emerald-400"
                : result.scorePct >= 60
                  ? "text-amber-400"
                  : "text-destructive"
            }`}
          >
            {result.scorePct} / 100
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("ppRedFlagsLabel")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-400">
            {result.redFlagCount} / {result.attentionCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("ppTargetOfferLabel")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-primary">
            {formatCurrency(suggestedCounterOfferEur, locale, "EUR")}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("ppDayOneTotalLabel")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(trueDayOneTotalEur, locale, "EUR")}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              {t("ppChecklistTitle")}
            </CardTitle>
            <CardDescription>{t("ppChecklistDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {PRE_PURCHASE_CHECKLIST_ITEMS.map((key) => {
              const cur = statuses[key];
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5"
                >
                  <span className="text-sm font-medium text-foreground">
                    {t(`ppItem_${key}`)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(["ok", "attention", "red_flag"] as const).map((st) => (
                      <Button
                        key={st}
                        type="button"
                        size="sm"
                        variant={
                          cur === st
                            ? st === "ok"
                              ? "default"
                              : st === "attention"
                                ? "secondary"
                                : "destructive"
                            : "outline"
                        }
                        className="h-7 px-2.5 text-xs"
                        onClick={() =>
                          setStatuses((prev) => ({ ...prev, [key]: st }))
                        }
                      >
                        {st === "ok" ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : st === "attention" ? (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        ) : null}
                        {t(`ppStatus_${st}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              {t("ppBudgetTitle")}
            </CardTitle>
            <CardDescription>{t("ppBudgetDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("ppCarLabel")}</Label>
              <Input
                value={carTitle}
                onChange={(e) => setCarTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("ppAskingPriceLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={askingPriceEur}
                  onChange={(e) =>
                    setAskingPriceEur(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("ppNotaryTaxLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  step={20}
                  value={notaryTaxEur}
                  onChange={(e) => setNotaryTaxEur(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("ppInitialServiceLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  step={20}
                  value={initialServiceEur}
                  onChange={(e) =>
                    setInitialServiceEur(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("ppTyresBrakesLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  step={20}
                  value={tyresBrakesEur}
                  onChange={(e) =>
                    setTyresBrakesEur(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("ppInsuranceVignetteLabel")}</Label>
              <Input
                type="number"
                min={0}
                step={10}
                value={insuranceVignetteEur}
                onChange={(e) =>
                  setInsuranceVignetteEur(Number(e.target.value) || 0)
                }
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ppDiscountLabel")}</span>
                <span className="font-mono font-semibold text-amber-400">
                  -{result.suggestedDiscountPct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ppCatchUpTotalLabel")}</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatCurrency(catchUpTotalEur, locale, "EUR")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleCopySummary}
              >
                {copied ? (
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("ppCopyBriefBtn")}
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/app/cars">{t("ppAddVehicleCta")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

