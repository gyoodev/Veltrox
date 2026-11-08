import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { OverviewQuickActions } from "@/components/garage/overview-quick-actions";
import { STATUS_BADGE_VARIANT } from "@/components/garage/work-orders-board-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getGarageWorkspaceBundle } from "@/lib/data/garage";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AppLocale } from "@/types/domain";

export default async function GarageDashboardPage() {
  const { garage, isManager } = await requireOnboardedGarage();
  const bundle = await getGarageWorkspaceBundle(garage.id);

  const locale = (await getLocale()) as AppLocale;
  const tDash = await getTranslations("dashboards.garage");
  const tOv = await getTranslations("garageWorkspace.overview");
  const tStatuses = await getTranslations("garageWorkspace.statuses");

  const openOrders = bundle.workOrders.filter(
    (wo) => wo.status !== "completed"
  );
  const readyOrders = bundle.workOrders.filter((wo) => wo.status === "ready");

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayAppointments = bundle.appointments.filter(
    (a) =>
      a.scheduledStart.slice(0, 10) === todayPrefix &&
      a.status !== "cancelled"
  );
  const upcomingAppointments = bundle.appointments.filter(
    (a) =>
      a.scheduledStart.slice(0, 10) >= todayPrefix &&
      a.status !== "cancelled" &&
      a.status !== "completed"
  );

  const quota = getEffectiveReminderQuota(garage);

  const kpis = [
    {
      label: tOv("kpiActiveOrders"),
      value: String(openOrders.length),
      icon: Wrench,
      accent: "bg-primary/15 text-primary",
      href: "/garage/work-orders",
    },
    {
      label: tOv("kpiReadyPickup"),
      value: String(readyOrders.length),
      icon: CheckCircle2,
      accent: "bg-emerald-500/15 text-emerald-400",
      href: "/garage/work-orders",
    },
    {
      label: tOv("kpiTodayAppts"),
      value: String(todayAppointments.length),
      icon: CalendarDays,
      accent: "bg-violet-500/15 text-violet-400",
      href: "/garage/appointments",
    },
    {
      label: tOv("kpiReminderQuota", { plan: garage.plan.toUpperCase() }),
      value: `${quota.used}/${quota.quota}`,
      icon: BellRing,
      accent: "bg-orange-500/15 text-orange-400",
      href: isManager ? "/garage/settings" : "/garage/work-orders",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {tDash("welcome", { name: garage.name })}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {garage.city} • {garage.address}
        </p>
      </div>

      {/* Sub-30s Intake + Instant Plate Search Bar */}
      <OverviewQuickActions
        garageSlug={garage.slug}
        customers={bundle.customers}
        recentWorkOrders={bundle.workOrders}
      />

      {/* 4-Card Operational Bento KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href}>
              <Card hoverLift className="h-full p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.accent}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
                <p className="mt-3 font-mono text-2xl font-bold text-foreground sm:text-3xl">
                  {item.value}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Live Shop Bay + Upcoming Schedule */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {tOv("activeBayTitle")}
            </h2>
            <Link
              href="/garage/work-orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {tOv("viewAll")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {openOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tOv("emptyBay")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {openOrders.slice(0, 6).map((wo) => (
                <Link
                  key={wo.id}
                  href={`/garage/work-orders/${wo.id}`}
                  className="flex items-center justify-between gap-3 py-3.5 transition-colors hover:text-primary"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                        {wo.plateNumber}
                      </span>
                      <Badge variant={STATUS_BADGE_VARIANT[wo.status]}>
                        {tStatuses(wo.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {wo.vehicleLabel} — {wo.customerName ?? ""}
                    </p>
                  </div>

                  <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                    {formatCurrency(wo.totalAmount, locale, wo.currency)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {tOv("upcomingApptsTitle")}
            </h2>
            <Link
              href="/garage/appointments"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {tOv("viewAll")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {upcomingAppointments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tOv("emptyAppts")}
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 5).map((appt) => {
                const timeStr = new Date(appt.scheduledStart).toLocaleTimeString(
                  locale === "bg" ? "bg-BG" : "en-GB",
                  { hour: "2-digit", minute: "2-digit" }
                );
                return (
                  <Link
                    key={appt.id}
                    href="/garage/appointments"
                    className="block rounded-xl border border-border bg-secondary/35 p-3.5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-primary">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(appt.scheduledStart, locale)} • {timeStr}
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {appt.plateNumber}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">
                      {appt.customerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appt.serviceRequested}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
