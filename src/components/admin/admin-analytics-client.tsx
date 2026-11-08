"use client";

import {
  BellRing,
  Building2,
  Coins,
  Play,
  Users,
  Wrench,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminPlatformAnalyticsSummary } from "@/lib/analytics-metrics";
import { formatCurrency } from "@/lib/utils";
import type { AppLocale } from "@/types/domain";

interface AdminAnalyticsClientProps {
  summary: AdminPlatformAnalyticsSummary;
}

export function AdminAnalyticsClient({ summary }: AdminAnalyticsClientProps) {
  const t = useTranslations("adminPanel.analytics");
  const locale = useLocale() as AppLocale;
  const [runningSweep, setRunningSweep] = useState(false);

  const planChartData = [
    {
      name: t("freePlanLabel"),
      count: summary.freeGaragesCount,
      color: "#64748B",
    },
    {
      name: t("proPlanLabel"),
      count: summary.proGaragesCount,
      color: "#8B5CF6",
    },
  ];

  const handleManualSweep = async () => {
    setRunningSweep(true);
    try {
      const res = await fetch("/api/cron/reminders", { method: "POST" });
      if (!res.ok) {
        toast.error(t("sweepErrorToast"));
        return;
      }
      const data = (await res.json()) as {
        summary?: {
          dispatchedReminders?: number;
          dispatchedDocumentAlerts?: number;
        };
      };
      toast.success(
        t("sweepSuccessToast", {
          reminders: data.summary?.dispatchedReminders ?? 0,
          docs: data.summary?.dispatchedDocumentAlerts ?? 0,
        })
      );
    } catch {
      toast.error(t("sweepErrorToast"));
    } finally {
      setRunningSweep(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        <Button
          type="button"
          variant="gradient"
          disabled={runningSweep}
          onClick={() => void handleManualSweep()}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          {runningSweep ? t("runningSweepBtn") : t("runSweepBtn")}
        </Button>
      </div>

      {/* Real Firestore KPI Bento Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("totalUsers")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {summary.totalUsers}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("usersSplit", {
              owners: summary.carOwnersCount,
              garages: summary.garageOwnersCount,
              admins: summary.adminsCount,
            })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("workshopsCount")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {summary.approvedGaragesCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("workshopsSub", {
              pending: summary.pendingGaragesCount,
              rejected: summary.rejectedGaragesCount,
            })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("vehiclesAndOrders")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <Wrench className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {summary.totalVehicles} / {summary.totalWorkOrders}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {t("ordersVolumeSub", {
              volume: formatCurrency(summary.totalVolumeEur, locale, "EUR"),
            })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("subscriptionMrr")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Coins className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(summary.mrrEur, locale, "EUR")}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {t("arrSub", {
              arr: formatCurrency(summary.arrEur, locale, "EUR"),
              pro: summary.proGaragesCount,
            })}
          </p>
        </Card>
      </div>

      {/* Growth Over Time & Subscription Plan Breakdown */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">{t("growthOverTime")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={summary.growthByMonth}
                margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient
                    id="adminUsersGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient
                    id="adminOrdersGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
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
                  allowDecimals={false}
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
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name={t("seriesUsers")}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#adminUsersGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="workOrders"
                  name={t("seriesWorkOrders")}
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#adminOrdersGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">{t("planDistribution")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={planChartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.14)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
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
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {planChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Reminder & Notification Engine Telemetry */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("reminderEngineCard")}</CardTitle>
            <Badge variant="default">
              <BellRing className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Cloud Functions v2 + Cron
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <span className="text-xs text-muted-foreground">
                {t("scheduledReminders")}
              </span>
              <p className="mt-1.5 font-mono text-xl font-bold text-foreground">
                {summary.scheduledRemindersCount}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <span className="text-xs text-muted-foreground">
                {t("sentReminders")}
              </span>
              <p className="mt-1.5 font-mono text-xl font-bold text-primary">
                {summary.sentRemindersCount}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <span className="text-xs text-muted-foreground">
                {t("completedReminders")}
              </span>
              <p className="mt-1.5 font-mono text-xl font-bold text-emerald-400">
                {summary.completedRemindersCount}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <span className="text-xs text-muted-foreground">
                {t("deliveredVsFailed")}
              </span>
              <p className="mt-1.5 font-mono text-xl font-bold text-foreground">
                {summary.notificationsSentCount}{" "}
                <span className="text-xs text-muted-foreground">
                  / {summary.notificationsFailedCount}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
