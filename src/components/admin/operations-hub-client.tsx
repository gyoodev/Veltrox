"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Phone,
  Search,
  Wrench,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import type { Appointment, AppLocale, Garage, WorkOrder } from "@/types/domain";

interface OperationsHubClientProps {
  initialWorkOrders: WorkOrder[];
  initialAppointments: Appointment[];
  garages: Garage[];
}

export function OperationsHubClient({
  initialWorkOrders,
  initialAppointments,
  garages,
}: OperationsHubClientProps) {
  const locale = useLocale() as AppLocale;

  const [activeTab, setActiveTab] = useState<"orders" | "appointments">("orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [garageFilter, setGarageFilter] = useState<string>("all");

  const garageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of garages) {
      map.set(g.id, g.name);
    }
    return map;
  }, [garages]);

  // Filtered work orders
  const filteredOrders = useMemo(() => {
    return initialWorkOrders.filter((wo: WorkOrder) => {
      if (statusFilter !== "all" && wo.status !== statusFilter) return false;
      if (garageFilter !== "all" && wo.garageId !== garageFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const num = (wo.id || "").toLowerCase();
      const cust = (wo.customerName || "").toLowerCase();
      const plate = (wo.plateNumber || "").toLowerCase();
      const phone = (wo.customerPhone || "").toLowerCase();
      const gName = (garageMap.get(wo.garageId) || "").toLowerCase();

      return (
        num.includes(term) ||
        cust.includes(term) ||
        plate.includes(term) ||
        phone.includes(term) ||
        gName.includes(term)
      );
    });
  }, [initialWorkOrders, statusFilter, garageFilter, searchTerm, garageMap]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return initialAppointments.filter((app: Appointment) => {
      if (statusFilter !== "all" && app.status !== statusFilter) return false;
      if (garageFilter !== "all" && app.garageId !== garageFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const cust = (app.customerName || "").toLowerCase();
      const plate = (app.plateNumber || "").toLowerCase();
      const phone = (app.customerPhone || "").toLowerCase();
      const service = (app.serviceRequested || "").toLowerCase();
      const gName = (garageMap.get(app.garageId) || "").toLowerCase();

      return (
        cust.includes(term) ||
        plate.includes(term) ||
        phone.includes(term) ||
        service.includes(term) ||
        gName.includes(term)
      );
    });
  }, [initialAppointments, statusFilter, garageFilter, searchTerm, garageMap]);

  // Summary statistics
  const totalVolumeEur = useMemo(() => {
    return initialWorkOrders.reduce(
      (acc: number, wo: WorkOrder) =>
        acc + (typeof wo.totalAmount === "number" ? wo.totalAmount : 0),
      0
    );
  }, [initialWorkOrders]);

  const activeOrdersCount = useMemo(() => {
    return initialWorkOrders.filter(
      (wo: WorkOrder) =>
        wo.status === "in_progress" ||
        wo.status === "received" ||
        wo.status === "diagnosing" ||
        wo.status === "waiting_parts"
    ).length;
  }, [initialWorkOrders]);

  const completedOrdersCount = useMemo(() => {
    return initialWorkOrders.filter(
      (wo: WorkOrder) => wo.status === "completed"
    ).length;
  }, [initialWorkOrders]);

  const exportCsv = () => {
    const rows: string[] = [];
    if (activeTab === "orders") {
      rows.push("OrderId,Garage,Customer,Phone,Plate,Status,Total,CreatedAt");
      for (const o of filteredOrders) {
        rows.push(
          `"${o.id.slice(0, 8).toUpperCase()}","${
            garageMap.get(o.garageId) || o.garageId
          }","${o.customerName || ""}","${o.customerPhone || ""}","${
            o.plateNumber
          }","${o.status}","${o.totalAmount}","${o.createdAt}"`
        );
      }
    } else {
      rows.push("Garage,Customer,Phone,Plate,Service,ScheduledStart,Status,CreatedAt");
      for (const a of filteredAppointments) {
        rows.push(
          `"${garageMap.get(a.garageId) || a.garageId}","${a.customerName}","${
            a.customerPhone || ""
          }","${a.plateNumber}","${a.serviceRequested}","${
            a.scheduledStart
          }","${a.status}","${a.createdAt}"`
        );
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veltrox-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <Wrench className="h-7 w-7 text-primary" />
            Поръчки и график
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Глобален контрол на всички сервизни поръчки и часове за посещение в мрежата.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            <span>Експорт на таблица (CSV)</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Общ брой поръчки
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {initialWorkOrders.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            {completedOrdersCount} приключени поръчки
          </p>
        </Card>

        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Активни ремонти в момента
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-400">
            {activeOrdersCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            В процес, диагностика или очакващи части
          </p>
        </Card>

        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Записани часове
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-indigo-400">
            {initialAppointments.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Общо заявки в платформата
          </p>
        </Card>

        <Card className="p-4 border-primary/20 bg-card/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Генериран оборот
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">
            {formatCurrency(totalVolumeEur, locale, "EUR")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            През сервизите на Veltrox
          </p>
        </Card>
      </div>

      {/* Main Filter & Tabs Area */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "orders" | "appointments");
          setStatusFilter("all");
        }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-secondary/60 p-1">
            <TabsTrigger value="orders" className="gap-2 text-xs sm:text-sm">
              <Wrench className="h-4 w-4" />
              <span>Работни поръчки ({filteredOrders.length})</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2 text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4" />
              <span>Записани часове ({filteredAppointments.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Търсене по клиент, номер, рег..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всички статуси</SelectItem>
                {activeTab === "orders" ? (
                  <>
                    <SelectItem value="received">Приета</SelectItem>
                    <SelectItem value="diagnosing">Диагностика</SelectItem>
                    <SelectItem value="waiting_parts">Чака части</SelectItem>
                    <SelectItem value="in_progress">В ремонт</SelectItem>
                    <SelectItem value="ready">Готова</SelectItem>
                    <SelectItem value="completed">Приключена</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="requested">Заявена</SelectItem>
                    <SelectItem value="confirmed">Потвърдена</SelectItem>
                    <SelectItem value="completed">Завършена</SelectItem>
                    <SelectItem value="cancelled">Отменена</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            {/* Garage Filter */}
            {garages.length > 0 ? (
              <Select value={garageFilter} onValueChange={setGarageFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Сервиз" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всички сервизи</SelectItem>
                  {garages.map((g: Garage) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        {/* Work Orders Table */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="overflow-hidden border-border/70">
            <CardHeader className="py-3 px-4 bg-secondary/30 border-b border-border/60">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Списък с работни поръчки
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Няма намерени поръчки по избраните критерии.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground font-semibold border-b border-border/60">
                      <tr>
                        <th className="py-2.5 px-4">№ Поръчка</th>
                        <th className="py-2.5 px-4">Сервиз</th>
                        <th className="py-2.5 px-4">Клиент</th>
                        <th className="py-2.5 px-4">Автомобил</th>
                        <th className="py-2.5 px-4">Сума</th>
                        <th className="py-2.5 px-4">Статус</th>
                        <th className="py-2.5 px-4">Дата</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {filteredOrders.map((wo: WorkOrder) => {
                        const isCompleted = wo.status === "completed";
                        const isInProgress =
                          wo.status === "in_progress" ||
                          wo.status === "diagnosing" ||
                          wo.status === "waiting_parts";
                        const isReady = wo.status === "ready";

                        return (
                          <tr key={wo.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="py-3 px-4 font-bold text-foreground">
                              #{wo.id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="py-3 px-4 font-sans text-foreground">
                              {garageMap.get(wo.garageId) || "Сервиз"}
                            </td>
                            <td className="py-3 px-4 font-sans">
                              <p className="font-semibold text-foreground">
                                {wo.customerName || "Клиент"}
                              </p>
                              {wo.customerPhone ? (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                                  <Phone className="h-3 w-3" />
                                  {wo.customerPhone}
                                </p>
                              ) : null}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-secondary font-bold text-foreground">
                                {wo.plateNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-foreground">
                              {formatCurrency(wo.totalAmount, locale, wo.currency || "EUR")}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={
                                  isCompleted
                                    ? "success"
                                    : isReady
                                      ? "success"
                                      : isInProgress
                                        ? "warning"
                                        : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {wo.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-[11px]">
                              {formatDateShort(wo.createdAt, locale)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Table */}
        <TabsContent value="appointments" className="space-y-4">
          <Card className="overflow-hidden border-border/70">
            <CardHeader className="py-3 px-4 bg-secondary/30 border-b border-border/60">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Списък с часове за преглед и обслужване
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAppointments.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Няма намерени записани часове.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground font-semibold border-b border-border/60">
                      <tr>
                        <th className="py-2.5 px-4">Дата и час</th>
                        <th className="py-2.5 px-4">Сервиз</th>
                        <th className="py-2.5 px-4">Клиент</th>
                        <th className="py-2.5 px-4">Автомобил</th>
                        <th className="py-2.5 px-4">Заявена услуга</th>
                        <th className="py-2.5 px-4">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {filteredAppointments.map((app: Appointment) => (
                        <tr key={app.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="py-3 px-4 text-foreground font-bold">
                            <span className="block">
                              {app.scheduledStart
                                ? formatDateShort(app.scheduledStart, locale)
                                : "Не е зададен"}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-normal">
                              {app.scheduledStart ? app.scheduledStart.slice(11, 16) : ""}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans text-foreground">
                            {garageMap.get(app.garageId) || "Сервиз"}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <p className="font-semibold text-foreground">
                              {app.customerName}
                            </p>
                            {app.customerPhone ? (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                                <Phone className="h-3 w-3" />
                                {app.customerPhone}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-secondary font-bold text-foreground">
                              {app.plateNumber}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans text-foreground max-w-xs truncate">
                            {app.serviceRequested}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                app.status === "confirmed"
                                  ? "success"
                                  : app.status === "requested"
                                    ? "warning"
                                    : app.status === "cancelled"
                                      ? "destructive"
                                      : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {app.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
