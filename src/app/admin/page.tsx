import {
  ArrowRight,
  BarChart3,
  Building2,
  FileClock,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeAdminPlatformAnalytics } from "@/lib/analytics-metrics";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import type { AppLocale } from "@/types/domain";

export default async function AdminDashboardPage() {
  await requireRole(["ADMIN"]);
  const t = await getTranslations("adminPanel.overview");
  const locale = (await getLocale()) as AppLocale;

  const bundle = await getAdminDashboardBundle();
  const summary = computeAdminPlatformAnalytics({
    users: bundle.users,
    garages: bundle.garages,
    vehicles: bundle.vehicles,
    workOrders: bundle.workOrders,
    reminders: bundle.reminders,
    notifications: bundle.notifications,
  });

  const pendingGarageUsers = bundle.users
    .filter((u) => u.role === "GARAGE_OWNER" && !u.isStaff && u.garageStatus === "pending")
    .slice(0, 5);

  const recentLogs = bundle.auditLogs.slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="gradient" size="sm">
            <Link href="/admin/approvals">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              {t("reviewApprovalsCta", { count: summary.pendingGaragesCount })}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/analytics">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              {t("openAnalyticsCta")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Real Firestore KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("kpiPendingApprovals")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {summary.pendingGaragesCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("kpiApprovedSub", { count: summary.approvedGaragesCount })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("kpiTotalUsers")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {summary.totalUsers}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("kpiVehiclesSub", { count: summary.totalVehicles })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("kpiWorkOrders")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {summary.totalWorkOrders}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatCurrency(summary.totalVolumeEur, locale, "EUR")}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("kpiMrr")}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(summary.mrrEur, locale, "EUR")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("kpiProPlansSub", {
              pro: summary.proGaragesCount,
              free: summary.freeGaragesCount,
            })}
          </p>
        </Card>
      </div>

      {/* Pending Garages Preview & Recent Audit Trail */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("pendingCardTitle")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/approvals">
                {t("viewAllLink")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingGarageUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t("noPendingGarages")}
              </p>
            ) : (
              <div className="space-y-2.5">
                {pendingGarageUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {u.displayName}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("recentAuditTitle")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/audit-logs">
                <FileClock className="h-3.5 w-3.5" />
                {t("viewAllLink")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t("noAuditLogs")}
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px]"
                      >
                        {log.action}
                      </Badge>
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {log.actorUid}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {formatDateShort(log.createdAt, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
