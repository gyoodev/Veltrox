"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  Download,
  FileClock,
  Layers,
  Megaphone,
  Radio,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import type { AdminDashboardBundle } from "@/lib/data/admin";
import type {
  AppLocale,
  AuditLog,
  Garage,
  UserProfile,
  WorkOrder,
} from "@/types/domain";

interface AdminOverviewClientProps {
  bundle: AdminDashboardBundle;
}

export function AdminOverviewClient({ bundle }: AdminOverviewClientProps) {
  const locale = useLocale() as AppLocale;

  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>(() =>
    bundle.users.filter(
      (u: UserProfile) =>
        u.role === "GARAGE_OWNER" && !u.isStaff && u.garageStatus === "pending"
    )
  );

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(bundle.auditLogs);
  const [runningSweep, setRunningSweep] = useState(false);
  const [decidingUid, setDecidingUid] = useState<string | null>(null);

  // Computations
  const totalVolumeEur = useMemo(() => {
    return bundle.workOrders.reduce(
      (acc: number, wo: WorkOrder) =>
        acc + (typeof wo.totalAmount === "number" ? wo.totalAmount : 0),
      0
    );
  }, [bundle.workOrders]);

  const approvedGaragesCount = useMemo(
    () => bundle.garages.filter((g: Garage) => g.status === "approved").length,
    [bundle.garages]
  );

  const proGaragesCount = useMemo(
    () => bundle.garages.filter((g: Garage) => g.plan === "pro").length,
    [bundle.garages]
  );

  const mrrEur = proGaragesCount * (bundle.settings?.proPlanPriceEur ?? 49);

  // Quick 1-click decision directly from dashboard
  const handleDecision = async (userId: string, decision: "approved" | "rejected") => {
    setDecidingUid(userId);
    try {
      const res = await fetch(`/api/admin/garages/${userId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        toast.error("Неуспешно записване на решението");
        return;
      }

      toast.success(
        decision === "approved"
          ? "Сервизът е одобрен успешно!"
          : "Заявката е отхвърлена."
      );

      setPendingUsers((prev) => prev.filter((u) => u.uid !== userId));

      // Prepend an audit entry locally
      const newLog: AuditLog = {
        id: "local-" + Date.now(),
        action: decision === "approved" ? "GARAGE_APPROVED" : "GARAGE_REJECTED",
        actorUid: "ADMIN",
        actorRole: "ADMIN",
        targetUid: userId,
        targetGarageId: null,
        metadata: { decision },
        createdAt: new Date().toISOString(),
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    } catch {
      toast.error("Грешка при връзка със сървъра");
    } finally {
      setDecidingUid(null);
    }
  };

  // Trigger reminders cron
  const handleTriggerSweep = async () => {
    setRunningSweep(true);
    try {
      const res = await fetch("/api/cron/reminders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Неуспешна проверка");
        return;
      }
      toast.success(
        `Проверката завърши: обработени са ${data.processedReminders ?? 0} напомняния.`
      );
    } catch {
      toast.error("Грешка при стартиране на проверката");
    } finally {
      setRunningSweep(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Command Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-card/90 via-secondary/40 to-primary/10 p-5 sm:p-6 backdrop-blur shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono text-[11px] font-bold"
              >
                LIVE PRODUCTION
              </Badge>
              {bundle.settings?.maintenanceMode ? (
                <Badge variant="destructive" className="font-mono text-[11px] gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  ПРОФИЛАКТИКА АКТИВНА
                </Badge>
              ) : null}
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
              <Shield className="h-7 w-7 text-primary" />
              Команден център Veltrox
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Пълен надзор, управление на автосервизи, одобрения, работни поръчки, комуникация и системни инструменти.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button asChild variant="gradient" size="sm" className="gap-1.5 shadow-sm text-xs h-9">
              <Link href="/admin/broadcast">
                <Send className="h-3.5 w-3.5" />
                <span>Глобално известие</span>
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs h-9">
              <Link href="/admin/settings">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>Глобален контрол</span>
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={runningSweep}
              onClick={handleTriggerSweep}
              className="gap-1.5 text-xs h-9"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-emerald-400 ${
                  runningSweep ? "animate-spin" : ""
                }`}
              />
              <span>{runningSweep ? "Проверка..." : "Cron проверка"}</span>
            </Button>

            <Button
              asChild
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs h-9 border border-border"
            >
              <a href="/api/admin/database-export" download>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Бекъп JSON</span>
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* 6 Key Performance Metric Tiles */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Garages */}
        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Автосервизи
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {bundle.garages.length}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{approvedGaragesCount} активни</span>
            {pendingUsers.length > 0 ? (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                {pendingUsers.length} чакат
              </Badge>
            ) : null}
          </div>
        </Card>

        {/* Users */}
        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Потребители
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-sky-400">
            {bundle.users.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {bundle.users.filter((u: UserProfile) => u.role === "USER").length} шофьори
          </p>
        </Card>

        {/* Vehicles */}
        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Автопарк МПС
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Car className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">
            {bundle.vehicles.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            В дигитален гараж
          </p>
        </Card>

        {/* Work Orders */}
        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Поръчки & Ремонти
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-violet-400">
            {bundle.workOrders.length}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground truncate">
            {formatCurrency(totalVolumeEur, locale, "EUR")}
          </p>
        </Card>

        {/* Appointments */}
        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              График и Часове
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-400">
            {bundle.appointments.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            Записани посещения
          </p>
        </Card>

        {/* MRR */}
        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Месечен приход (MRR)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-rose-400">
            {formatCurrency(mrrEur, locale, "EUR")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {proGaragesCount} Pro сервиза
          </p>
        </Card>
      </div>

      {/* Main Grid: Pending Approvals with 1-Click Action & Quick Navigations */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Pending Garage Verification Queue with Direct Action */}
        <Card className="lg:col-span-7 border-border/70">
          <CardHeader className="flex flex-row items-center justify-between py-3.5 px-4 bg-secondary/30 border-b border-border/60">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm font-bold text-foreground">
                Чакащи заявки за автосервизи ({pendingUsers.length})
              </CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Link href="/admin/approvals">
                <span>Пълен списък</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-3.5 space-y-2.5">
            {pendingUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400/60 mb-2" />
                <p>Няма чакащи заявки за верификация на сервизи. Всички са обслужени!</p>
              </div>
            ) : (
              pendingUsers.slice(0, 4).map((u) => {
                const isDeciding = decidingUid === u.uid;
                return (
                  <div
                    key={u.uid}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3 hover:border-primary/30 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-xs text-foreground truncate">
                          {u.displayName || "Нов кандидат"}
                        </p>
                        <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                          PENDING
                        </Badge>
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
                        {u.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="gradient"
                        disabled={isDeciding}
                        onClick={() => handleDecision(u.uid, "approved")}
                        className="h-7 px-2.5 text-[11px] gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Одобри</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isDeciding}
                        onClick={() => handleDecision(u.uid, "rejected")}
                        className="h-7 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="h-3 w-3" />
                        <span>Отказ</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Quick Tools & Shortcuts Grid */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/70">
            <CardHeader className="py-3.5 px-4 bg-secondary/30 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Бързи инструменти за управление
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 grid grid-cols-2 gap-2">
              <Link
                href="/admin/operations"
                className="flex flex-col justify-between p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <Wrench className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-foreground">Поръчки & График</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    Всички ремонти в страната
                  </p>
                </div>
              </Link>

              <Link
                href="/admin/broadcast"
                className="flex flex-col justify-between p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <Radio className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-foreground">Известия</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    Съобщения в реално време
                  </p>
                </div>
              </Link>

              <Link
                href="/admin/settings"
                className="flex flex-col justify-between p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <Sliders className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-foreground">Глобален контрол</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    Feature flags & Профилактика
                  </p>
                </div>
              </Link>

              <Link
                href="/admin/system"
                className="flex flex-col justify-between p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <Activity className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-foreground">Системно здраве</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    Cron телеметрия & Firestore
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Grid: Recent Audit Logs & System Telemetry */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Audit Trail */}
        <Card className="lg:col-span-8 border-border/70">
          <CardHeader className="flex flex-row items-center justify-between py-3.5 px-4 bg-secondary/30 border-b border-border/60">
            <div className="flex items-center gap-2">
              <FileClock className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold text-foreground">
                Одитен дневник на платформата ({auditLogs.length})
              </CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Link href="/admin/audit-logs">
                <span>Виж всички</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-3.5">
            {auditLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Няма записани одитни събития.
              </p>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/25 px-3 py-2 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold shrink-0"
                      >
                        {log.action}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {log.actorUid || "SYSTEM"}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDateShort(log.createdAt, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Registries Status */}
        <Card className="lg:col-span-4 border-border/70">
          <CardHeader className="py-3.5 px-4 bg-secondary/30 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Външни държавни регистри
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-2.5">
              <span className="font-sans font-semibold text-foreground">
                BGTOLL (Винетки)
              </span>
              <Badge variant="success" className="text-[10px]">
                ОНЛАЙН
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-2.5">
              <span className="font-sans font-semibold text-foreground">
                Гаранционен фонд (ГО)
              </span>
              <Badge variant="success" className="text-[10px]">
                ОНЛАЙН
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-2.5">
              <span className="font-sans font-semibold text-foreground">
                ИА Автомобилна адм. (ГТП)
              </span>
              <Badge variant="success" className="text-[10px]">
                ОНЛАЙН
              </Badge>
            </div>

            <p className="text-[11px] font-sans text-muted-foreground pt-1">
              Всички автомобилни регистри функционират нормално с автоматичен ретрай.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
