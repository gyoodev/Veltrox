"use client";

import {
  BarChart3,
  BellRing,
  CheckCircle2,
  Coins,
  Repeat,
  Send,
  TrendingUp,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  GarageAnalyticsSummary,
  OverdueCustomerItem,
} from "@/lib/analytics-metrics";
import { formatCurrency } from "@/lib/utils";
import type { AppLocale } from "@/types/domain";

const STATUS_COLORS: Record<string, string> = {
  received: "#64748B",
  diagnosing: "#F59E0B",
  waiting_parts: "#F97316",
  in_progress: "#3B82F6",
  ready: "#8B5CF6",
  completed: "#10B981",
};

interface GarageAnalyticsClientProps {
  analytics: GarageAnalyticsSummary;
  quota: {
    used: number;
    quota: number;
    remaining: number;
  };
}

export function GarageAnalyticsClient({
  analytics,
  quota: initialQuota,
}: GarageAnalyticsClientProps) {
  const t = useTranslations("garageAnalytics");
  const tStatus = useTranslations("garage.statuses");
  const locale = useLocale() as AppLocale;

  const [quota, setQuota] = useState(initialQuota);
  const [sentKeys, setSentKeys] = useState<Record<string, boolean>>({});
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const statusChartData = analytics.jobsByStatus.map((item) => ({
    name: tStatus(item.status),
    count: item.count,
    color: STATUS_COLORS[item.status] ?? "#3B82F6",
  }));

  const retentionPieData = [
    {
      name: t("returningCustomers"),
      value: analytics.returningCustomersCount,
      color: "#10B981",
    },
    {
      name: t("newCustomers"),
      value: analytics.newCustomersCount,
      color: "#3B82F6",
    },
  ];

  const handleSendOneReminder = async (item: OverdueCustomerItem) => {
    if (quota.remaining <= 0) {
      toast.error(t("quotaReachedToast"));
      return;
    }

    setSendingKey(item.key);
    try {
      const res = await fetch("/api/garage/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderId: item.reminderId,
          workOrderId: item.workOrderId,
          linkedOwnerId: item.linkedOwnerId,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          customerEmail: item.customerEmail,
          plateNumber: item.plateNumber,
          vehicleLabel: item.vehicleLabel,
          dueDate: item.dueDate,
          dueMileageKm: item.dueMileageKm,
        }),
      });

      if (res.status === 429) {
        toast.error(t("quotaReachedToast"));
        return;
      }

      if (!res.ok) {
        toast.error(t("sendErrorToast"));
        return;
      }

      setSentKeys((prev) => ({ ...prev, [item.key]: true }));
      setQuota((prev) => ({
        ...prev,
        used: prev.used + 1,
        remaining: Math.max(0, prev.remaining - 1),
      }));
      toast.success(t("reminderSentToast", { plate: item.plateNumber }));
    } catch {
      toast.error(t("sendErrorToast"));
    } finally {
      setSendingKey(null);
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

        <Badge variant={quota.remaining > 5 ? "default" : "warning"} className="font-mono">
          <BellRing className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("quotaBadge", { used: quota.used, quota: quota.quota })}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("totalRevenue")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Coins className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(analytics.totalRevenueEur, locale, "EUR")}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {t("laborPartsSplit", {
              labor: formatCurrency(analytics.totalLaborEur, locale, "EUR"),
              parts: formatCurrency(analytics.totalPartsEur, locale, "EUR"),
            })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("averageTicket")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(analytics.averageTicketEur, locale, "EUR")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("completedOfTotal", {
              completed: analytics.completedJobs,
              total: analytics.totalJobs,
            })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("customerRetention")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {analytics.returningRatePercent}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("returningVsNewSub", {
              returning: analytics.returningCustomersCount,
              newCount: analytics.newCustomersCount,
            })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("conversionRate")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <Repeat className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {analytics.reminderConversionRatePercent}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("conversionSub", {
              converted: analytics.convertedRemindersCount,
              sent: analytics.sentRemindersCount,
            })}
          </p>
        </Card>
      </div>

      {/* Revenue Area Chart & Jobs by Status Bar Chart */}
      {analytics.totalJobs === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-base">{t("revenuePerMonth")}</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics.revenueByMonth}
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient
                      id="garageRevGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
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
                    dataKey="revenueEur"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fill="url(#garageRevGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">{t("jobsByStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.14)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={115}
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
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Returning vs New Customers Donut + Most Common Services */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">
                {t("returningVsNewTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={retentionPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={4}
                    >
                      {retentionPieData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F1629",
                        borderColor: "rgba(255,255,255,0.12)",
                        borderRadius: "12px",
                        color: "#F8FAFC",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">
                    {t("returningCustomers")}:{" "}
                    <strong className="font-mono text-foreground">
                      {analytics.returningCustomersCount}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">
                    {t("newCustomers")}:{" "}
                    <strong className="font-mono text-foreground">
                      {analytics.newCustomersCount}
                    </strong>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-base">{t("commonServices")}</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.commonServices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("noServicesYet")}
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.commonServices.map((svc, idx) => (
                    <div
                      key={svc.service}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {svc.service}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("serviceJobsCount", { count: svc.count })}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                        {formatCurrency(svc.revenueEur, locale, "EUR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overdue-for-Service Customers with 1-Click Send Reminder */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{t("overdueTitle")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("overdueDesc")}
              </p>
            </div>
            <Badge variant="outline" className="font-mono">
              {analytics.overdueCustomers.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {analytics.overdueCustomers.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              <Wrench className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span>{t("noOverdue")}</span>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {analytics.overdueCustomers.map((item) => {
                const isSent = item.alreadySent || Boolean(sentKeys[item.key]);
                const isSending = sendingKey === item.key;
                const isOverdue =
                  item.daysUntilDue !== null && item.daysUntilDue < 0;

                return (
                  <div
                    key={item.key}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-border bg-secondary px-2.5 py-0.5 font-mono text-xs font-bold text-foreground">
                          {item.plateNumber}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {item.customerName}
                        </span>
                        <Badge variant={isOverdue ? "warning" : "default"}>
                          {item.daysUntilDue !== null
                            ? item.daysUntilDue < 0
                              ? t("daysOverdue", {
                                  days: Math.abs(item.daysUntilDue),
                                })
                              : t("daysRemaining", {
                                  days: item.daysUntilDue,
                                })
                            : t("mileageDue")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.vehicleLabel}
                        {item.dueDate ? ` • ${item.dueDate.slice(0, 10)}` : ""}
                        {item.dueMileageKm
                          ? ` • ${item.dueMileageKm.toLocaleString()} km`
                          : ""}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isSent ? (
                        <Badge variant="success" className="py-1.5 px-3">
                          <CheckCircle2
                            className="mr-1.5 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {t("reminderSentBadge")}
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="gradient"
                          disabled={isSending || quota.remaining <= 0}
                          onClick={() => void handleSendOneReminder(item)}
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          {isSending ? t("sendingBtn") : t("sendReminderBtn")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

