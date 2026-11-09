"use client";

import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Cloud,
  Database,
  Mail,
  Play,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SystemHealthClientProps {
  stats: {
    totalVehicles: number;
    totalUsers: number;
    totalGarages: number;
    totalReminders: number;
    totalWorkOrders: number;
  };
  serverTime: string;
}

interface CronResult {
  ok: boolean;
  timestamp: string;
  summary?: {
    scannedRemindersCount: number;
    notificationsCreatedCount: number;
    emailsDispatchedCount: number;
  };
  error?: string;
}

export function SystemHealthClient({
  stats,
  serverTime,
}: SystemHealthClientProps) {
  const t = useTranslations("adminPanel.system");
  const [isRunningCron, setIsRunningCron] = useState(false);
  const [cronResult, setCronResult] = useState<CronResult | null>(null);

  const runCronSweep = async () => {
    setIsRunningCron(true);
    try {
      const res = await fetch("/api/cron/reminders", {
        method: "POST",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(t("cronErrorToast"));
        setCronResult({
          ok: false,
          timestamp: new Date().toLocaleTimeString("bg-BG"),
          error: json?.error || "Сървърна грешка при изпълнение",
        });
        return;
      }

      setCronResult({
        ok: true,
        timestamp: new Date().toLocaleTimeString("bg-BG"),
        summary: json?.summary,
      });

      toast.success(
        t("cronSuccessToast", {
          count: json?.summary?.scannedRemindersCount ?? 0,
        })
      );
    } catch (err) {
      console.error("runCronSweep error:", err);
      toast.error(t("cronErrorToast"));
      setCronResult({
        ok: false,
        timestamp: new Date().toLocaleTimeString("bg-BG"),
        error: "Неуспешна заявка към /api/cron/reminders",
      });
    } finally {
      setIsRunningCron(false);
    }
  };

  const integrations = [
    {
      name: t("firestoreStatus"),
      desc: "Cloud Firestore NoSQL база данни с Realtime синхронизация",
      status: "operational",
      icon: Database,
      badge: t("statusConnected"),
      accent: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    },
    {
      name: t("imgbbStatus"),
      desc: "ImgBB Cloud API v1 за съхранение и хостване на снимки на коли",
      status: "operational",
      icon: Cloud,
      badge: t("statusConfigured"),
      accent: "text-sky-400 border-sky-500/40 bg-sky-500/10",
    },
    {
      name: t("bgtollStatus"),
      desc: "Проверка на електронни винетки по регистрационен номер",
      status: "operational",
      icon: CheckCircle2,
      badge: t("statusOperational"),
      accent: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    },
    {
      name: t("rtaStatus"),
      desc: "Проверка на валидност на ГТП и километри по VIN в регистъра на ИААА",
      status: "operational",
      icon: Shield,
      badge: t("statusOperational"),
      accent: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
    },
    {
      name: t("gfStatus"),
      desc: "Проверка на полици за Гражданска отговорност в Гаранционния фонд",
      status: "operational",
      icon: Shield,
      badge: t("statusOperational"),
      accent: "text-blue-400 border-blue-500/40 bg-blue-500/10",
    },
    {
      name: t("resendStatus"),
      desc: "Изпращане на имейл известия за наближаващи срокове и верификация",
      status: "operational",
      icon: Mail,
      badge: t("statusConfigured"),
      accent: "text-purple-400 border-purple-500/40 bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Badge
          variant="outline"
          className="font-mono text-emerald-400 border-emerald-500/40 bg-emerald-500/10 self-start sm:self-auto gap-1.5"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          ВСИЧКИ СИСТЕМИ РАБОТЯТ
        </Badge>
      </div>

      {/* Cron Reminders Engine Section */}
      <Card className="glass-panel border-primary/30 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  {t("cronTitle")}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("cronDesc")}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="gradient"
              size="sm"
              onClick={runCronSweep}
              disabled={isRunningCron}
              className="gap-2 shrink-0 font-semibold"
            >
              {isRunningCron ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>{t("runningCron")}</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>{t("runCronBtn")}</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {cronResult ? (
          <CardContent className="pt-2">
            <div
              className={cn(
                "rounded-xl border p-4 space-y-2 text-xs",
                cronResult.ok
                  ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                  : "border-destructive/40 bg-destructive/[0.08]"
              )}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-2">
                  {cronResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>
                    {cronResult.ok
                      ? "Последното изпълнение приключи успешно"
                      : "Грешка при последното изпълнение"}
                  </span>
                </span>
                <span className="font-mono text-muted-foreground">
                  {cronResult.timestamp}
                </span>
              </div>

              {cronResult.summary ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-muted-foreground">
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2 text-center">
                    <span className="block text-[11px]">
                      {t("processedReminders")}
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {cronResult.summary.scannedRemindersCount}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2 text-center">
                    <span className="block text-[11px]">
                      {t("alertsTriggered")}
                    </span>
                    <span className="text-base font-bold text-amber-400">
                      {cronResult.summary.notificationsCreatedCount}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2 text-center">
                    <span className="block text-[11px]">
                      {t("emailsSent")}
                    </span>
                    <span className="text-base font-bold text-primary">
                      {cronResult.summary.emailsDispatchedCount}
                    </span>
                  </div>
                </div>
              ) : null}

              {cronResult.error ? (
                <p className="text-destructive font-mono text-xs">
                  {cronResult.error}
                </p>
              ) : null}
            </div>
          </CardContent>
        ) : null}
      </Card>

      {/* Integrations Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">
          {t("integrationsTitle")}
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.name} className="glass-panel">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/60 text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-foreground text-sm leading-snug">
                        {item.name}
                      </h3>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-mono shrink-0", item.accent)}
                    >
                      {item.badge}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Runtime & Environment Specs */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">
          {t("systemSpecsTitle")}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-panel p-4">
            <span className="text-xs text-muted-foreground block">
              {t("environment")}
            </span>
            <span className="text-base font-bold text-foreground font-mono mt-0.5 block">
              {process.env.NODE_ENV === "production" ? "Production" : "Development"}
            </span>
          </Card>

          <Card className="glass-panel p-4">
            <span className="text-xs text-muted-foreground block">
              {t("serverTime")}
            </span>
            <span className="text-base font-bold text-foreground font-mono mt-0.5 block">
              {serverTime}
            </span>
          </Card>

          <Card className="glass-panel p-4">
            <span className="text-xs text-muted-foreground block">
              Общо данни в БД
            </span>
            <span className="text-base font-bold text-foreground font-mono mt-0.5 block">
              {stats.totalVehicles} МПС • {stats.totalReminders} срока
            </span>
          </Card>

          <Card className="glass-panel p-4">
            <span className="text-xs text-muted-foreground block">
              Автосервизи и поръчки
            </span>
            <span className="text-base font-bold text-foreground font-mono mt-0.5 block">
              {stats.totalGarages} сервиза • {stats.totalWorkOrders} поръчки
            </span>
          </Card>
        </div>
      </div>
    </div>
  );
}
