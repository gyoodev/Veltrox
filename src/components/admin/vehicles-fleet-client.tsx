"use client";

import {
  Car,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gauge,
  Search,
  Shield,
  User,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Reminder, UserProfile, Vehicle } from "@/types/domain";

interface VehiclesFleetClientProps {
  initialVehicles: Vehicle[];
  users: UserProfile[];
  reminders: Reminder[];
}

export function VehiclesFleetClient({
  initialVehicles,
  users,
  reminders,
}: VehiclesFleetClientProps) {
  const t = useTranslations("adminPanel.vehicles");
  const [vehicles] = useState<Vehicle[]>(initialVehicles);
  const [search, setSearch] = useState("");
  const [fuelFilter, setFuelFilter] = useState<string>("all");

  const ownerMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const u of users) {
      map.set(u.uid, u);
    }
    return map;
  }, [users]);

  const vehicleRemindersMap = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const r of reminders) {
      if (!r.vehicleId) continue;
      const list = map.get(r.vehicleId) ?? [];
      list.push(r);
      map.set(r.vehicleId, list);
    }
    return map;
  }, [reminders]);

  const stats = useMemo(() => {
    const totalMileage = vehicles.reduce(
      (acc, v) => acc + (v.currentMileageKm || 0),
      0
    );
    const avgMileage =
      vehicles.length > 0 ? Math.round(totalMileage / vehicles.length) : 0;
    const uniqueOwners = new Set(vehicles.map((v) => v.ownerId)).size;

    return {
      total: vehicles.length,
      activeReminders: reminders.filter((r) => r.status !== "completed").length,
      avgMileage,
      uniqueOwners,
    };
  }, [vehicles, reminders]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (fuelFilter !== "all" && v.fuelType !== fuelFilter) return false;

      if (!query) return true;

      const owner = ownerMap.get(v.ownerId);
      const matchPlate = v.plateNumber.toLowerCase().includes(query);
      const matchNormalized = v.plateNormalized.toLowerCase().includes(query);
      const matchMake = v.make.toLowerCase().includes(query);
      const matchModel = v.model.toLowerCase().includes(query);
      const matchVin = v.vin ? v.vin.toLowerCase().includes(query) : false;
      const matchOwner = owner
        ? owner.displayName.toLowerCase().includes(query) ||
          owner.email.toLowerCase().includes(query)
        : false;

      return (
        matchPlate ||
        matchNormalized ||
        matchMake ||
        matchModel ||
        matchVin ||
        matchOwner
      );
    });
  }, [vehicles, search, fuelFilter, ownerMap]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} е копиран в клипборда!`);
    } catch {
      toast.info(text);
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
          {stats.total} {stats.total === 1 ? "автомобил" : "автомобила"}
        </Badge>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("totalVehicles")}
            </CardTitle>
            <Car className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.total}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              от {stats.uniqueOwners} потребители
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("activeReminders")}
            </CardTitle>
            <Shield className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {stats.activeReminders}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              срокове в системата
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("averageMileage")}
            </CardTitle>
            <Gauge className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-400">
              {stats.avgMileage.toLocaleString("bg-BG")} км
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">средно на МПС</p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Собственици
            </CardTitle>
            <User className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {stats.uniqueOwners}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              шофьори в платформата
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
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

        <Select value={fuelFilter} onValueChange={setFuelFilter}>
          <SelectTrigger className="w-[160px] text-xs">
            <SelectValue placeholder={t("allFuels")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allFuels")}</SelectItem>
            <SelectItem value="petrol">Бензин</SelectItem>
            <SelectItem value="diesel">Дизел</SelectItem>
            <SelectItem value="hybrid">Хибрид</SelectItem>
            <SelectItem value="electric">Електрически</SelectItem>
            <SelectItem value="lpg">Пропан-бутан (LPG)</SelectItem>
            <SelectItem value="cng">Метан (CNG)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fleet Cards */}
      {filteredVehicles.length === 0 ? (
        <Card className="p-8 text-center glass-panel">
          <Car className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            {t("emptyTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyDesc")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const owner = ownerMap.get(vehicle.ownerId);
            const vehicleReminders =
              vehicleRemindersMap.get(vehicle.id) ?? [];

            return (
              <Card
                key={vehicle.id}
                className="glass-panel flex flex-col justify-between transition-all hover:border-primary/40"
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {vehicle.photoUrl ? (
                        <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-border shrink-0 bg-secondary/50">
                          <Image
                            src={vehicle.photoUrl}
                            alt={`${vehicle.make} ${vehicle.model}`}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-xl border border-border bg-secondary/40 flex items-center justify-center shrink-0 text-muted-foreground">
                          <Car className="h-6 w-6" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-base truncate">
                          {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {vehicle.year} г. • {vehicle.fuelType}
                        </p>
                      </div>
                    </div>

                    {/* Bulgarian Registration Plate Badge */}
                    <div className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs font-mono font-bold text-neutral-100 shadow-sm shrink-0">
                      <span className="mr-1 text-[10px] text-blue-400 font-sans font-bold">
                        BG
                      </span>
                      <span>{vehicle.plateNumber}</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Пробег:</span>
                      <span className="font-mono font-bold text-foreground">
                        {vehicle.currentMileageKm?.toLocaleString("bg-BG") ?? 0}{" "}
                        км
                      </span>
                    </div>

                    {vehicle.vin ? (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>VIN:</span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(vehicle.vin || "", "VIN номер")
                          }
                          className="font-mono text-[11px] text-primary flex items-center gap-1 hover:underline"
                          title="Кликни за копиране"
                        >
                          <Copy className="h-3 w-3" />
                          <span>{vehicle.vin}</span>
                        </button>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Собственик:</span>
                      <span className="font-medium text-foreground truncate max-w-[170px]">
                        {owner?.displayName ?? owner?.email ?? vehicle.ownerId}
                      </span>
                    </div>
                  </div>

                  {/* Compliance & Deadlines Summary */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">
                      Срокове и напомняния:
                    </span>
                    <Badge
                      variant={
                        vehicleReminders.length > 0 ? "secondary" : "outline"
                      }
                      className="text-[10px] font-mono"
                    >
                      {vehicleReminders.length} активни
                    </Badge>
                  </div>

                  {/* Fast External Register Checks */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 font-medium"
                    >
                      <a
                        href="https://public-eis.rta.government.bg/public-vehicle-check/vin-check"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Gauge className="h-3 w-3 text-sky-400" />
                        <span>{t("checkVinBtn")}</span>
                        <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                      </a>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 font-medium"
                    >
                      <a
                        href="https://www.bgtoll.bg/check-vignette"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        <span>BGTOLL</span>
                        <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                      </a>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 font-medium"
                    >
                      <a
                        href="https://www.guaranteefund.org/bg"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Shield className="h-3 w-3 text-blue-400" />
                        <span>ГО (ГФ)</span>
                        <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                      </a>
                    </Button>
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
