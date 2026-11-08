"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Phone,
  Plus,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import {
  type GarageAppointmentFormValues,
  garageAppointmentFormSchema,
} from "@/lib/validators/garage";
import type { AppLocale, Appointment, WorkOrder } from "@/types/domain";

interface AppointmentsCalendarClientProps {
  initialAppointments: Appointment[];
}

function addDays(baseIso: string, deltaDays: number): string {
  const d = new Date(`${baseIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function getMondayOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sun
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function AppointmentsCalendarClient({
  initialAppointments,
}: AppointmentsCalendarClientProps) {
  const t = useTranslations("garageWorkspace.calendar");
  const tApptStatuses = useTranslations("garageWorkspace.appointmentStatuses");
  const tDir = useTranslations("carDiary.garagesDir");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const todayIso = new Date().toISOString().slice(0, 10);
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [anchorDate, setAnchorDate] = useState<string>(todayIso);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const form = useForm<GarageAppointmentFormValues>({
    resolver: zodResolver(garageAppointmentFormSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      plateNumber: "",
      serviceRequested: "",
      date: todayIso,
      time: "10:00",
      durationMinutes: 60,
      notes: "",
    },
  });

  const rangeDates = useMemo(() => {
    if (viewMode === "day") return [anchorDate];
    const monday = getMondayOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [viewMode, anchorDate]);

  const visibleAppointments = useMemo(() => {
    const allowed = new Set(rangeDates);
    return appointments
      .filter((a) => allowed.has(a.scheduledStart.slice(0, 10)))
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  }, [appointments, rangeDates]);

  const stepCalendar = (dir: -1 | 1) => {
    setAnchorDate((cur) => addDays(cur, viewMode === "day" ? dir : dir * 7));
  };

  const handleStatusUpdate = async (
    apptId: string,
    status: Appointment["status"]
  ) => {
    setBusyId(apptId);
    try {
      const res = await fetch(`/api/garage/appointments/${apptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("Could not update appointment.");
        return;
      }
      const json = (await res.json()) as { appointment: Appointment };
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? json.appointment : a))
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleConvertToOrder = async (apptId: string) => {
    setBusyId(apptId);
    try {
      const res = await fetch(`/api/garage/appointments/${apptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convertToWorkOrder: true }),
      });
      if (!res.ok) {
        toast.error("Conversion failed.");
        return;
      }
      const json = (await res.json()) as {
        appointment: Appointment;
        workOrder: WorkOrder | null;
      };
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? json.appointment : a))
      );
      toast.success(t("convertedToast"));
      if (json.workOrder) {
        router.push(`/garage/work-orders/${json.workOrder.id}`);
      }
    } finally {
      setBusyId(null);
    }
  };

  const onSubmitNew = form.handleSubmit(async (values) => {
    const res = await fetch("/api/garage/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      toast.error("Failed to create appointment.");
      return;
    }
    const json = (await res.json()) as { appointment: Appointment };
    setAppointments((prev) => [...prev, json.appointment]);
    toast.success(t("savedToast"));
    setDialogOpen(false);
    form.reset();
    router.refresh();
  });

  const statusBadgeVariant = (s: Appointment["status"]) => {
    if (s === "requested") return "warning";
    if (s === "confirmed") return "default";
    if (s === "completed") return "success";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("addAppointment")}
        </Button>
      </div>

      {/* Calendar Controls Bar */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Previous"
            onClick={() => stepCalendar(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAnchorDate(todayIso)}
          >
            {t("today")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Next"
            onClick={() => stepCalendar(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="ml-2 text-sm font-semibold text-foreground">
            {viewMode === "day"
              ? formatDate(anchorDate, locale)
              : `${formatDate(rangeDates[0] ?? anchorDate, locale)} – ${formatDate(
                  rangeDates[rangeDates.length - 1] ?? anchorDate,
                  locale
                )}`}
          </span>
        </div>

        <div className="inline-flex rounded-xl border border-border bg-secondary/60 p-1">
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              viewMode === "day"
                ? "bg-veltrox-gradient text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("dayView")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              viewMode === "week"
                ? "bg-veltrox-gradient text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("weekView")}
          </button>
        </div>
      </Card>

      {/* Appointments Grouped by Date */}
      {visibleAppointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("emptyDay")}
          description={t("pageSubtitle")}
          action={
            <Button
              type="button"
              variant="gradient"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("addAppointment")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {rangeDates.map((dayIso) => {
            const dayItems = visibleAppointments.filter(
              (a) => a.scheduledStart.slice(0, 10) === dayIso
            );
            if (dayItems.length === 0) return null;

            return (
              <div key={dayIso} className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {formatDate(dayIso, locale)}
                </h2>

                <div className="grid gap-3 md:grid-cols-2">
                  {dayItems.map((appt) => {
                    const timeLabel = new Date(
                      appt.scheduledStart
                    ).toLocaleTimeString(locale === "bg" ? "bg-BG" : "en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const busy = busyId === appt.id;

                    return (
                      <Card
                        key={appt.id}
                        className="flex flex-col justify-between p-5"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-primary">
                              <Clock className="h-4 w-4" />
                              {timeLabel}
                            </span>
                            <Badge variant={statusBadgeVariant(appt.status)}>
                              {tApptStatuses(appt.status)}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                              {appt.plateNumber}
                            </span>
                            <span className="text-base font-bold text-foreground">
                              {appt.customerName}
                            </span>
                          </div>

                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            {appt.customerPhone}
                          </p>

                          <p className="text-sm text-foreground">
                            {appt.serviceRequested}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3.5">
                          {appt.status === "requested" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                void handleStatusUpdate(appt.id, "confirmed")
                              }
                            >
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              {t("confirmBtn")}
                            </Button>
                          ) : null}

                          {appt.status !== "cancelled" &&
                          appt.status !== "completed" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void handleStatusUpdate(appt.id, "cancelled")
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                              {t("cancelBtn")}
                            </Button>
                          ) : null}

                          {appt.workOrderId ? (
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={`/garage/work-orders/${appt.workOrderId}`}
                              >
                                {t("openOrderBtn")}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          ) : appt.status !== "cancelled" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="gradient"
                              disabled={busy}
                              onClick={() => void handleConvertToOrder(appt.id)}
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Wrench className="h-3.5 w-3.5" />
                              )}
                              {t("convertToOrderBtn")}
                            </Button>
                          ) : null}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Walk-in / Phone Appointment Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addAppointment")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmitNew} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ga-name">{tDir("customerName")}</Label>
                <Input id="ga-name" {...form.register("customerName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ga-phone">{tDir("customerPhone")}</Label>
                <Input
                  id="ga-phone"
                  placeholder="+359 88 123 4567"
                  {...form.register("customerPhone")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ga-plate">{tDir("plateNumber")}</Label>
              <Input
                id="ga-plate"
                placeholder="CB 1234 AB"
                className="font-mono uppercase"
                {...form.register("plateNumber")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ga-svc">{tDir("serviceRequested")}</Label>
              <Input id="ga-svc" {...form.register("serviceRequested")} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ga-date">{tDir("preferredDate")}</Label>
                <Input id="ga-date" type="date" {...form.register("date")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ga-time">{tDir("preferredTime")}</Label>
                <Input id="ga-time" type="time" {...form.register("time")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ga-dur">{t("durationMin")}</Label>
                <Input
                  id="ga-dur"
                  type="number"
                  min={15}
                  max={480}
                  {...form.register("durationMinutes", { valueAsNumber: true })}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                variant="gradient"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

