"use client";

import {
  Calculator,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Fuel,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  EUR_TO_BGN_FIXED_RATE,
  type BulgariaFuelCode,
  type BulgariaFuelPricesPayload,
} from "@/lib/fuel-prices";
import { cn, formatDateShort } from "@/lib/utils";
import type { AppLocale } from "@/types/domain";

const FUEL_ACCENTS: Record<BulgariaFuelCode, string> = {
  gasoline: "#3B82F6",
  diesel: "#F59E0B",
  lpg: "#10B981",
  methane: "#8B5CF6",
};

interface BulgariaFuelPricesWidgetProps {
  initialData?: BulgariaFuelPricesPayload | null;
  className?: string;
  defaultCollapsed?: boolean;
}

export function BulgariaFuelPricesWidget({
  initialData = null,
  className,
  defaultCollapsed = false,
}: BulgariaFuelPricesWidgetProps) {
  const t = useTranslations("fuelWidget");
  const locale = useLocale() as AppLocale;

  const [payload, setPayload] = useState<BulgariaFuelPricesPayload | null>(
    initialData
  );
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [selectedCode, setSelectedCode] = useState<BulgariaFuelCode>("gasoline");
  const [distanceKm, setDistanceKm] = useState<string>("100");
  const [consumption, setConsumption] = useState<string>("7.0");
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("veltrox_fuel_widget_collapsed");
      if (stored !== null) {
        setCollapsed(stored === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("veltrox_fuel_widget_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const fetchPrices = async (forceRefresh: boolean) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(false);

    try {
      const url = forceRefresh
        ? "/api/fuel-prices?refresh=1"
        : "/api/fuel-prices";
      const res = await fetch(url, {
        cache: forceRefresh ? "no-store" : "default",
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const json = (await res.json()) as {
        ok?: boolean;
        data?: BulgariaFuelPricesPayload;
      };
      if (json.ok && json.data) {
        setPayload(json.data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      void fetchPrices(false);
    }
  }, [initialData]);

  const activeFuel = useMemo(
    () =>
      payload?.fuels.find((f) => f.code === selectedCode) ??
      payload?.fuels[0] ??
      null,
    [payload, selectedCode]
  );

  const tripEstimate = useMemo(() => {
    if (!activeFuel) return null;
    const km = Number.parseFloat(distanceKm);
    const cons = Number.parseFloat(consumption);
    if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(cons) || cons <= 0) {
      return null;
    }
    const unitsNeeded = (km / 100) * cons;
    const costEur = unitsNeeded * activeFuel.priceEur;
    const costBgn = costEur * EUR_TO_BGN_FIXED_RATE;
    return {
      unitsNeeded: Number(unitsNeeded.toFixed(1)),
      costEur: Number(costEur.toFixed(2)),
      costBgn: Number(costBgn.toFixed(2)),
    };
  }, [activeFuel, distanceKm, consumption]);

  return (
    <Card
      className={cn(
        "overflow-hidden border-primary/25 shadow-sm transition-all",
        className
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Fuel className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("title")}
              </CardTitle>
              <Badge variant="success" className="text-[11px]">
                {t("liveBadge")}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              {t("subtitle")}
              {payload ? (
                <span className="ml-1.5 font-mono text-[11px]">
                  • {formatDateShort(payload.fetchedAt, locale)}
                </span>
              ) : null}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => void fetchPrices(true)}
              aria-label={t("refreshBtn")}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  (loading || refreshing) && "animate-spin"
                )}
                aria-hidden="true"
              />
              <span>{t("refreshBtn")}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={toggleCollapsed}
              className="h-8 gap-1 text-xs"
              aria-label={collapsed ? t("expandBtn") : t("collapseBtn")}
            >
              {collapsed ? (
                <>
                  <span>{t("expandBtn")}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <span>{t("collapseBtn")}</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Compact Live Ticker Strip when Collapsed */}
        {collapsed && payload ? (
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            {payload.fuels.map((fuel) => {
              const unitLabel =
                fuel.unit === "kg" ? t("unitKg") : t("unitLiter");
              const isDown = fuel.delta30dEur < 0;
              const isUp = fuel.delta30dEur > 0;
              return (
                <button
                  key={fuel.code}
                  type="button"
                  onClick={() => {
                    setSelectedCode(fuel.code);
                    toggleCollapsed();
                  }}
                  className="flex items-center justify-between sm:justify-start gap-2 rounded-xl border border-border bg-secondary/35 px-2.5 py-1.5 text-xs font-mono hover:border-primary/40 hover:bg-secondary/60 transition-colors cursor-pointer text-left w-full sm:w-auto"
                >
                  <span className="font-sans font-medium text-foreground">
                    {t(`fuels.${fuel.code}`)}:
                  </span>
                  <span className="font-extrabold text-primary">
                    €{fuel.priceEur.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({fuel.priceBgn.toFixed(2)} {t("bgnShort")}/{unitLabel})
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold shrink-0",
                      isDown
                        ? "text-emerald-400"
                        : isUp
                          ? "text-amber-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {fuel.delta30dPercent > 0 ? "+" : ""}
                    {fuel.delta30dPercent.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </CardHeader>

      {!collapsed ? (
        <CardContent className="space-y-5">
        {loading && !payload ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-28 animate-pulse rounded-2xl border border-border bg-secondary/40"
              />
            ))}
          </div>
        ) : error && !payload ? (
          <div className="rounded-xl border border-border bg-secondary/25 p-4 text-xs text-muted-foreground">
            {t("unavailable")}
          </div>
        ) : payload ? (
          <>
            {/* 4 Live Fuel Cards (EUR + Official Dual-Display BGN) */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {payload.fuels.map((fuel) => {
                const isSelected = activeFuel?.code === fuel.code;
                const unitLabel =
                  fuel.unit === "kg" ? t("unitKg") : t("unitLiter");
                const isDown = fuel.delta30dEur < 0;
                const isUp = fuel.delta30dEur > 0;

                return (
                  <button
                    key={fuel.code}
                    type="button"
                    onClick={() => setSelectedCode(fuel.code)}
                    className={cn(
                      "flex flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary/60 bg-primary/[0.08] shadow-glow-blue"
                        : "border-border bg-secondary/25 hover:border-primary/35 hover:bg-secondary/45"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {t(`fuels.${fuel.code}`)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                          isDown
                            ? "bg-emerald-500/15 text-emerald-400"
                            : isUp
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {isDown ? (
                          <TrendingDown className="h-3 w-3" aria-hidden="true" />
                        ) : isUp ? (
                          <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Minus className="h-3 w-3" aria-hidden="true" />
                        )}
                        {fuel.delta30dPercent > 0 ? "+" : ""}
                        {fuel.delta30dPercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-2xl font-extrabold text-foreground">
                          €{fuel.priceEur.toFixed(2)}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          / {unitLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {fuel.priceBgn.toFixed(2)} {t("bgnShort")} / {unitLabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Fuel 30-Day Trend Sparkline + Quick Trip Cost Estimator */}
            {activeFuel ? (
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="rounded-2xl border border-border bg-secondary/20 p-4 lg:col-span-7">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {t("trend30dTitle", {
                        fuel: t(`fuels.${activeFuel.code}`),
                      })}
                    </span>
                    <a
                      href={activeFuel.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      {payload.provider}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>

                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={activeFuel.history}
                        margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="bgFuelTrendGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={FUEL_ACCENTS[activeFuel.code]}
                              stopOpacity={0.42}
                            />
                            <stop
                              offset="95%"
                              stopColor={FUEL_ACCENTS[activeFuel.code]}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(148,163,184,0.12)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(val: string) => val.slice(5)}
                          minTickGap={28}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tickFormatter={(v: number) => `€${v.toFixed(2)}`}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0F1629",
                            borderColor: "rgba(255,255,255,0.12)",
                            borderRadius: "10px",
                            color: "#F8FAFC",
                            fontSize: "12px",
                          }}
                          formatter={(val: number) => [
                            `€${val.toFixed(2)} (${(val * EUR_TO_BGN_FIXED_RATE).toFixed(2)} ${t("bgnShort")})`,
                            t(`fuels.${activeFuel.code}`),
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="priceEur"
                          stroke={FUEL_ACCENTS[activeFuel.code]}
                          strokeWidth={2.2}
                          fill="url(#bgFuelTrendGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Instant Trip Fuel Cost Calculator */}
                <div className="flex flex-col justify-between rounded-2xl border border-border bg-secondary/20 p-4 lg:col-span-5">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Calculator
                        className="h-3.5 w-3.5 text-primary"
                        aria-hidden="true"
                      />
                      <span>{t("calculatorTitle")}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label
                          htmlFor="trip-distance-km"
                          className="text-[11px] text-muted-foreground"
                        >
                          {t("distanceKmLabel")}
                        </Label>
                        <Input
                          id="trip-distance-km"
                          type="number"
                          min="1"
                          step="10"
                          value={distanceKm}
                          onChange={(e) => setDistanceKm(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label
                          htmlFor="trip-consumption"
                          className="text-[11px] text-muted-foreground"
                        >
                          {t("consumptionLabel", {
                            unit:
                              activeFuel.unit === "kg"
                                ? t("unitKg")
                                : t("unitLiter"),
                          })}
                        </Label>
                        <Input
                          id="trip-consumption"
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={consumption}
                          onChange={(e) => setConsumption(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {tripEstimate ? (
                    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.08] px-3.5 py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("estimatedCost")} ({tripEstimate.unitsNeeded}{" "}
                          {activeFuel.unit === "kg"
                            ? t("unitKg")
                            : t("unitLiter")}
                          )
                        </span>
                        <span className="font-mono text-base font-bold text-foreground">
                          €{tripEstimate.costEur.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-right font-mono text-[11px] text-muted-foreground">
                        ≈ {tripEstimate.costBgn.toFixed(2)} {t("bgnShort")}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
      ) : null}
    </Card>
  );
}

