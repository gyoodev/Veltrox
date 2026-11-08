import {
  ArrowRight,
  BellRing,
  Building2,
  Calendar,
  Car,
  Coins,
  FolderLock,
  Gauge,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";
import {
  evaluateDocumentExpiry,
  evaluateReminderUrgency,
} from "@/lib/diary-metrics";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AppLocale } from "@/types/domain";

export default async function UserDashboardPage() {
  const { profile } = await requireRole(["USER"]);
  const bundle = await getUserDiaryBundle(profile.uid);

  const locale = (await getLocale()) as AppLocale;
  const tOwner = await getTranslations("dashboards.owner");
  const tOv = await getTranslations("carDiary.overview");
  const tCars = await getTranslations("carDiary.cars");
  const tFuel = await getTranslations("carDiary.fuelTypes");
  const tCat = await getTranslations("carDiary.categories");
  const tRem = await getTranslations("carDiary.reminders");
  const tShell = await getTranslations("shell");

  const vehicleMap = new Map(bundle.vehicles.map((v) => [v.id, v]));

  const activeReminders = bundle.reminders.filter(
    (r) => r.status !== "completed" && r.status !== "cancelled"
  );
  const urgentRemindersCount = activeReminders.filter((r) => {
    const veh = r.vehicleId ? vehicleMap.get(r.vehicleId) : undefined;
    const urg = evaluateReminderUrgency(r, veh?.currentMileageKm).urgency;
    return urg === "overdue" || urg === "due_soon";
  }).length;

  const expiringDocsCount = bundle.documents.filter((doc) => {
    const state = evaluateDocumentExpiry(doc.expiryDate).state;
    return state === "expired" || state === "expiring_soon";
  }).length;

  const kpis = [
    {
      label: tOwner("cardVehicles"),
      value: String(bundle.vehicles.length),
      accent: "text-primary bg-primary/15",
      icon: Car,
      href: "/app/cars",
    },
    {
      label: tOv("totalSpend"),
      value: formatCurrency(bundle.expenses.totalAmountEur, locale, "EUR"),
      accent: "text-violet-400 bg-violet-500/15",
      icon: Coins,
      href: "/app/expenses",
    },
    {
      label: tOv("activeReminders"),
      value: String(activeReminders.length),
      badge: urgentRemindersCount > 0 ? `${urgentRemindersCount}!` : null,
      accent:
        urgentRemindersCount > 0
          ? "text-orange-400 bg-orange-500/15"
          : "text-emerald-400 bg-emerald-500/15",
      icon: BellRing,
      href: "/app/reminders",
    },
    {
      label: tOv("expiringDocs"),
      value: String(expiringDocsCount),
      accent:
        expiringDocsCount > 0
          ? "text-orange-400 bg-orange-500/15"
          : "text-blue-400 bg-blue-500/15",
      icon: FolderLock,
      href: "/app/documents",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {tOwner("welcome", { name: profile.displayName })}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {tOwner("subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline">
            <Link href="/app/garages">
              <Building2 className="h-4 w-4 text-primary" />
              {tShell("findGarageNav")}
            </Link>
          </Button>
          <Button asChild variant="gradient">
            <Link href="/app/cars">
              <Plus className="h-4 w-4" />
              {bundle.vehicles.length === 0
                ? tOv("addCarCta")
                : tOv("manageCarsCta")}
            </Link>
          </Button>
        </div>
      </div>

      {/* 4-Card Bento KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="block">
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
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="font-mono text-2xl font-bold text-foreground sm:text-3xl">
                    {item.value}
                  </p>
                  {item.badge ? (
                    <Badge variant="warning">{item.badge}</Badge>
                  ) : null}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Empty vs Populated Bento Workspace */}
      {bundle.vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title={tCars("emptyTitle")}
          description={tCars("emptyDesc")}
          action={
            <Button asChild variant="gradient">
              <Link href="/app/cars">
                <Plus className="h-4 w-4" />
                {tOv("addCarCta")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Vehicles Row */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {tOv("myVehiclesHeading")}
              </h2>
              <Link
                href="/app/cars"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {tOv("viewAll")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bundle.vehicles.slice(0, 3).map((veh) => (
                <Link key={veh.id} href={`/app/cars/${veh.id}`}>
                  <Card hoverLift className="flex items-center gap-4 p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-600/20 to-violet-600/20">
                      {veh.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={veh.photoUrl}
                          alt={`${veh.make} ${veh.model}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Car className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                          {veh.plateNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {veh.year}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-base font-bold text-foreground">
                        {veh.make} {veh.model}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5 text-primary" />
                        <span className="font-mono">
                          {veh.currentMileageKm.toLocaleString()} km
                        </span>
                        <span>• {tFuel(veh.fuelType)}</span>
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* Dual Bento Panels: Recent Timeline & Upcoming Reminders */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Recent Diary Entries */}
            <Card className="p-6 lg:col-span-7">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">
                  {tOv("recentTimeline")}
                </h2>
                <Link
                  href="/app/expenses"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {tOv("viewAll")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {bundle.diaryEntries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {tOv("emptyTimeline")}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {bundle.diaryEntries.slice(0, 5).map((entry) => {
                    const veh = vehicleMap.get(entry.vehicleId);
                    return (
                      <Link
                        key={entry.id}
                        href={`/app/cars/${entry.vehicleId}`}
                        className="flex items-center justify-between gap-3 py-3.5 transition-colors hover:text-primary"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {tCat(entry.category)}
                            </Badge>
                            {veh ? (
                              <span className="font-mono text-xs text-muted-foreground">
                                {veh.plateNumber}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(entry.date, locale)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-foreground">
                            {entry.title}
                          </p>
                        </div>

                        {entry.costAmount > 0 ? (
                          <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                            {formatCurrency(
                              entry.costAmount,
                              locale,
                              entry.currency
                            )}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Upcoming Reminders */}
            <Card className="p-6 lg:col-span-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">
                  {tOv("upcomingReminders")}
                </h2>
                <Link
                  href="/app/reminders"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {tOv("viewAll")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {activeReminders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {tOv("noUpcomingReminders")}
                </p>
              ) : (
                <div className="space-y-3">
                  {activeReminders.slice(0, 5).map((rem) => {
                    const veh = rem.vehicleId
                      ? vehicleMap.get(rem.vehicleId)
                      : undefined;
                    const { urgency } = evaluateReminderUrgency(
                      rem,
                      veh?.currentMileageKm
                    );
                    const variant =
                      urgency === "overdue"
                        ? "warning"
                        : urgency === "due_soon"
                          ? "violet"
                          : "default";
                    const label =
                      urgency === "overdue"
                        ? tRem("urgencyOverdue")
                        : urgency === "due_soon"
                          ? tRem("urgencySoon")
                          : tRem("urgencyScheduled");

                    return (
                      <Link
                        key={rem.id}
                        href="/app/reminders"
                        className="block rounded-xl border border-border bg-secondary/35 p-3.5 transition-colors hover:border-primary/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={variant}>{label}</Badge>
                          {veh ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {veh.plateNumber}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {rem.title}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {rem.dueDate ? (
                            <span>{formatDate(rem.dueDate, locale)}</span>
                          ) : null}
                          {typeof rem.dueMileageKm === "number" ? (
                            <span className="font-mono">
                              {rem.dueMileageKm.toLocaleString()} km
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
