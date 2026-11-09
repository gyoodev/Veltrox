"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  MoreVertical,
  Phone,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Garage, UserProfile } from "@/types/domain";

interface GaragesManagementClientProps {
  initialGarages: Garage[];
  users: UserProfile[];
}

export function GaragesManagementClient({
  initialGarages,
  users,
}: GaragesManagementClientProps) {
  const t = useTranslations("adminPanel.garages");
  const [garages, setGarages] = useState<Garage[]>(initialGarages);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const ownerMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const u of users) {
      map.set(u.uid, u);
    }
    return map;
  }, [users]);

  const stats = useMemo(() => {
    return {
      total: garages.length,
      approved: garages.filter((g) => g.status === "approved").length,
      pending: garages.filter((g) => g.status === "pending").length,
      suspended: garages.filter((g) => g.status === "suspended").length,
    };
  }, [garages]);

  const filteredGarages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return garages.filter((g) => {
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (planFilter !== "all" && g.plan !== planFilter) return false;

      if (!query) return true;

      const owner = ownerMap.get(g.ownerUid);
      const matchName = g.name.toLowerCase().includes(query);
      const matchCity = g.city.toLowerCase().includes(query);
      const matchEmail = g.email.toLowerCase().includes(query);
      const matchPhone = g.phone.toLowerCase().includes(query);
      const matchOwner = owner?.displayName.toLowerCase().includes(query) || false;

      return matchName || matchCity || matchEmail || matchPhone || matchOwner;
    });
  }, [garages, search, statusFilter, planFilter, ownerMap]);

  const updateGarage = async (
    garageId: string,
    payload: { status?: Garage["status"]; plan?: Garage["plan"] }
  ) => {
    setUpdatingId(garageId);
    try {
      const res = await fetch(`/api/admin/garages/${garageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error(t("updateErrorToast"));
        return;
      }

      const json = (await res.json()) as { ok: boolean; garage: Garage };
      setGarages((prev) =>
        prev.map((g) => (g.id === garageId ? { ...g, ...json.garage } : g))
      );

      if (payload.status) {
        toast.success(t("statusUpdatedToast"));
      } else if (payload.plan) {
        toast.success(t("planUpdatedToast"));
      }
    } catch {
      toast.error(t("updateErrorToast"));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Badge variant="outline" className="font-mono self-start sm:self-auto">
          {stats.total} {stats.total === 1 ? "сервиз" : "сервиза"}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("totalGarages")}
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.total}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("activeGarages")}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {stats.approved}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("pendingGarages")}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {stats.pending}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("suspendedGarages")}
            </CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.suspended}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] text-xs">
              <SelectValue placeholder={t("allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="approved">{t("statusApproved")}</SelectItem>
              <SelectItem value="pending">{t("statusPending")}</SelectItem>
              <SelectItem value="suspended">{t("statusSuspended")}</SelectItem>
              <SelectItem value="rejected">{t("statusRejected")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[130px] text-xs">
              <SelectValue placeholder="Всички планове" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички планове</SelectItem>
              <SelectItem value="free">{t("planFree")}</SelectItem>
              <SelectItem value="pro">{t("planPro")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Garages Grid / List */}
      {filteredGarages.length === 0 ? (
        <Card className="p-8 text-center glass-panel">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            {t("emptyTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyDesc")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredGarages.map((garage) => {
            const owner = ownerMap.get(garage.ownerUid);
            const isApproved = garage.status === "approved";
            const isPending = garage.status === "pending";
            const isSuspended = garage.status === "suspended";
            const isPro = garage.plan === "pro";
            const isUpdating = updatingId === garage.id;

            return (
              <Card
                key={garage.id}
                className={cn(
                  "glass-panel flex flex-col justify-between transition-all",
                  isPending && "border-amber-500/40 bg-amber-500/[0.04]",
                  isSuspended && "border-destructive/40 bg-destructive/[0.04]"
                )}
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-foreground truncate text-base">
                          {garage.name}
                        </h3>
                        {isPro ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/50 text-amber-400 bg-amber-500/10 font-bold"
                          >
                            <Sparkles className="h-2.5 w-2.5 mr-0.5 inline" />
                            PRO
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            FREE
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {garage.city} • {garage.address}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isApproved ? (
                        <Badge
                          variant="success"
                          className="text-[10px] font-semibold"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Одобрен
                        </Badge>
                      ) : isPending ? (
                        <Badge
                          variant="warning"
                          className="text-[10px] font-semibold"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Чакащ
                        </Badge>
                      ) : isSuspended ? (
                        <Badge
                          variant="destructive"
                          className="text-[10px] font-semibold"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Блокиран
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Отхвърлен
                        </Badge>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isUpdating}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Управление</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {garage.status !== "approved" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                updateGarage(garage.id, { status: "approved" })
                              }
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" />
                              Одобри / Активирай
                            </DropdownMenuItem>
                          ) : null}
                          {garage.status !== "suspended" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                updateGarage(garage.id, {
                                  status: "suspended",
                                })
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Блокирай (Suspend)
                            </DropdownMenuItem>
                          ) : null}
                          {garage.status !== "pending" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                updateGarage(garage.id, { status: "pending" })
                              }
                            >
                              <AlertTriangle className="h-4 w-4 mr-2 text-amber-400" />
                              Маркирай като чакащ
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              updateGarage(garage.id, {
                                plan: isPro ? "free" : "pro",
                              })
                            }
                          >
                            <Sparkles className="h-4 w-4 mr-2 text-amber-400" />
                            Превключи към {isPro ? "Free" : "Pro"}
                          </DropdownMenuItem>
                          {garage.slug ? (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/garages/${garage.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Отвори страница
                              </Link>
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Собственик:</span>
                      <span className="font-medium text-foreground">
                        {owner?.displayName ?? "Неизвестен"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Имейл:</span>
                      <span className="font-mono text-foreground text-[11px] truncate max-w-[180px]">
                        {garage.email}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Телефон:</span>
                      <a
                        href={`tel:${garage.phone}`}
                        className="font-mono text-primary flex items-center gap-1 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {garage.phone}
                      </a>
                    </div>
                  </div>

                  {garage.servicesOffered && garage.servicesOffered.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {garage.servicesOffered.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                      {garage.servicesOffered.length > 4 ? (
                        <span className="rounded-md border border-border bg-secondary/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          +{garage.servicesOffered.length - 4}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <span>
                      Квота напомняния: {garage.monthlyRemindersUsed ?? 0} /{" "}
                      {garage.monthlyReminderQuota ?? 50}
                    </span>
                    <span className="font-mono">
                      {new Date(garage.createdAt).toLocaleDateString("bg-BG")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
