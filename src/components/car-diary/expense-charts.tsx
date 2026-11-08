"use client";

import { CalendarRange, Coins, Gauge, PieChart as PieIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeExpenseAnalytics } from "@/lib/diary-metrics";
import { formatCurrency } from "@/lib/utils";
import type { AppLocale, DiaryEntry, Vehicle } from "@/types/domain";

const CATEGORY_COLORS: Record<string, string> = {
  service: "#3B82F6",
  repair: "#F97316",
  fuel: "#8B5CF6",
  tyres: "#06B6D4",
  inspection: "#10B981",
  insurance: "#6366F1",
  note: "#64748B",
};

interface ExpenseChartsProps {
  entries: DiaryEntry[];
  vehicles: Vehicle[];
  showVehicleFilter?: boolean;
}

export function ExpenseCharts({
  entries,
  vehicles,
  showVehicleFilter = false,
}: ExpenseChartsProps) {
  const t = useTranslations("carDiary.expenses");
  const tCat = useTranslations("carDiary.categories");
  const locale = useLocale() as AppLocale;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");

  const filteredEntries = useMemo(
    () =>
      selectedVehicleId === "all"
        ? entries
        : entries.filter((e) => e.vehicleId === selectedVehicleId),
    [entries, selectedVehicleId]
  );

  const filteredVehicles = useMemo(
    () =>
      selectedVehicleId === "all"
        ? vehicles
        : vehicles.filter((v) => v.id === selectedVehicleId),
    [selectedVehicleId, vehicles]
  );

  const summary = useMemo(
    () => computeExpenseAnalytics(filteredEntries, filteredVehicles),
    [filteredEntries, filteredVehicles]
  );

  const categoryChartData = useMemo(
    () =>
      summary.byCategory.map((item) => ({
        name: tCat(item.category),
        amountEur: item.amountEur,
        color: CATEGORY_COLORS[item.category] ?? "#3B82F6",
      })),
    [summary.byCategory, tCat]
  );

  return (
    <div className="space-y-6">
      {showVehicleFilter && vehicles.length > 1 ? (
        <div className="flex justify-end">
          <div className="w-full sm:w-72">
            <Select
              value={selectedVehicleId}
              onValueChange={setSelectedVehicleId}
            >
              <SelectTrigger aria-label={t("filterAllVehicles")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterAllVehicles")}</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.make} {v.model} ({v.plateNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {/* KPI Bento Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("totalSpent")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground sm:text-3xl">
            {formatCurrency(summary.totalAmountEur, locale, "EUR")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("entriesCount", { count: summary.entriesCount })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("costPerKm")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground sm:text-3xl">
            {summary.costPerKmEur !== null
              ? `€${summary.costPerKmEur.toFixed(3)} / km`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.trackedSpanKm >= 10
              ? t("trackedSpan", {
                  km: summary.trackedSpanKm.toLocaleString(),
                })
              : t("costPerKmHint")}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("costPerMonth")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <CalendarRange className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground sm:text-3xl">
            {formatCurrency(summary.averageMonthlyEur, locale, "EUR")}
          </p>
        </Card>
      </div>

      {summary.totalAmountEur <= 0 ? (
        <EmptyState
          icon={PieIcon}
          title={t("noDataTitle")}
          description={t("noDataDesc")}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Category Breakdown Bar Chart */}
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle className="text-base">
                {t("categoryBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 18, left: 10, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.14)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(59,130,246,0.08)" }}
                    contentStyle={{
                      backgroundColor: "#0F1629",
                      borderColor: "rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      color: "#F8FAFC",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`€${value.toFixed(2)}`, ""]}
                  />
                  <Bar dataKey="amountEur" radius={[0, 8, 8, 0]}>
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 6-Month Spend Area Chart */}
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle className="text-base">{t("monthlyTrend")}</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={summary.byMonth}
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient
                      id="veltroxSpendGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.14)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="monthKey"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F1629",
                      borderColor: "rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      color: "#F8FAFC",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`€${value.toFixed(2)}`, ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amountEur"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    fill="url(#veltroxSpendGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

