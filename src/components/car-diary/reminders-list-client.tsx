"use client";

import {
  BellRing,
  Calendar,
  CheckCircle2,
  Gauge,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReminderDialog } from "@/components/car-diary/reminder-dialog";
import { VehicleComplianceTracker } from "@/components/car-diary/vehicle-compliance-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { evaluateReminderUrgency } from "@/lib/diary-metrics";
import { formatDate } from "@/lib/utils";
import type {
  AppLocale,
  Reminder,
  Vehicle,
  VehicleDocument,
} from "@/types/domain";

interface RemindersListClientProps {
  initialReminders: Reminder[];
  vehicles: Vehicle[];
  documents?: VehicleDocument[];
  scopedVehicleId?: string;
  showPageHeader?: boolean;
}

export function RemindersListClient({
  initialReminders,
  vehicles,
  documents = [],
  scopedVehicleId,
  showPageHeader = false,
}: RemindersListClientProps) {
  const t = useTranslations("carDiary.reminders");
  const tTypes = useTranslations("carDiary.reminderTypes");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setReminders(initialReminders);
  }, [initialReminders]);

  const vehicleMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const sortedReminders = useMemo(() => {
    const rank = { overdue: 0, due_soon: 1, scheduled: 2, completed: 3 };
    return [...reminders].sort((a, b) => {
      const vehA = a.vehicleId ? vehicleMap.get(a.vehicleId) : undefined;
      const vehB = b.vehicleId ? vehicleMap.get(b.vehicleId) : undefined;
      const urgA = evaluateReminderUrgency(a, vehA?.currentMileageKm).urgency;
      const urgB = evaluateReminderUrgency(b, vehB?.currentMileageKm).urgency;
      if (rank[urgA] !== rank[urgB]) return rank[urgA] - rank[urgB];
      return (a.dueDate ?? "9999-12-31").localeCompare(
        b.dueDate ?? "9999-12-31"
      );
    });
  }, [reminders, vehicleMap]);

  const handleToggleComplete = async (reminder: Reminder) => {
    const nextStatus =
      reminder.status === "completed" ? "scheduled" : "completed";

    const prev = reminders;
    setReminders((list) =>
      list.map((r) => (r.id === reminder.id ? { ...r, status: nextStatus } : r))
    );

    const res = await fetch(`/api/reminders/${reminder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      setReminders(prev);
      toast.error("Update failed.");
      return;
    }

    if (nextStatus === "completed") {
      toast.success(t("completedToast"));
    }
    router.refresh();
  };

  const handleDelete = async (reminderId: string) => {
    const prev = reminders;
    setReminders((list) => list.filter((r) => r.id !== reminderId));

    const res = await fetch(`/api/reminders/${reminderId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setReminders(prev);
      toast.error("Delete failed.");
      return;
    }

    toast.success(t("deletedToast"));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {showPageHeader ? (
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("pageSubtitle")}
            </p>
          </div>
        ) : (
          <div />
        )}

        <Button
          variant="gradient"
          disabled={vehicles.length === 0}
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("addReminder")}
        </Button>
      </div>

      {showPageHeader && vehicles.length > 0 ? (
        <VehicleComplianceTracker
          vehicles={vehicles}
          initialReminders={reminders}
          documents={documents}
          onReminderUpserted={(saved) => {
            setReminders((prev) => {
              const exists = prev.some((r) => r.id === saved.id);
              return exists
                ? prev.map((r) => (r.id === saved.id ? saved : r))
                : [saved, ...prev];
            });
          }}
        />
      ) : null}

      {sortedReminders.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            vehicles.length > 0 ? (
              <Button variant="gradient" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("addReminder")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {sortedReminders.map((rem) => {
            const veh = rem.vehicleId ? vehicleMap.get(rem.vehicleId) : undefined;
            const { urgency, daysRemaining, kmRemaining } =
              evaluateReminderUrgency(rem, veh?.currentMileageKm);

            const badgeVariant =
              urgency === "overdue"
                ? "warning"
                : urgency === "due_soon"
                  ? "warning"
                  : urgency === "completed"
                    ? "success"
                    : "default";

            const badgeLabel =
              urgency === "overdue"
                ? t("urgencyOverdue")
                : urgency === "due_soon"
                  ? t("urgencySoon")
                  : urgency === "completed"
                    ? t("urgencyCompleted")
                    : t("urgencyScheduled");

            return (
              <Card
                key={rem.id}
                className={`p-5 transition-opacity ${
                  urgency === "completed" ? "opacity-65" : ""
                }`}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                      <Badge variant="outline">{tTypes(rem.type)}</Badge>
                      {!scopedVehicleId && veh ? (
                        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                          {veh.plateNumber}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-base font-semibold text-foreground">
                      {rem.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {rem.dueDate ? (
                        <span className="inline-flex items-center gap-1.5 font-mono">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {formatDate(rem.dueDate, locale)}
                          {daysRemaining !== null && urgency !== "completed" ? (
                            <span className="text-foreground">
                              (
                              {daysRemaining < 0
                                ? t("daysOverdue", {
                                    days: Math.abs(daysRemaining),
                                  })
                                : t("daysLeft", { days: daysRemaining })}
                              )
                            </span>
                          ) : null}
                        </span>
                      ) : null}

                      {rem.dueMileageKm ? (
                        <span className="inline-flex items-center gap-1.5 font-mono">
                          <Gauge className="h-3.5 w-3.5 text-violet-400" />
                          {rem.dueMileageKm.toLocaleString()} km
                          {kmRemaining !== null && urgency !== "completed" ? (
                            <span className="text-foreground">
                              (
                              {kmRemaining <= 0
                                ? t("kmOverdue", {
                                    km: Math.abs(kmRemaining).toLocaleString(),
                                  })
                                : t("kmLeft", {
                                    km: kmRemaining.toLocaleString(),
                                  })}
                              )
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant={
                        rem.status === "completed" ? "outline" : "secondary"
                      }
                      size="sm"
                      onClick={() => void handleToggleComplete(rem)}
                    >
                      {rem.status === "completed" ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t("reopen")}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          {t("markComplete")}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      aria-label="Delete reminder"
                      onClick={() => void handleDelete(rem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ReminderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicles={vehicles}
        defaultVehicleId={scopedVehicleId}
        onSaved={(saved) => {
          setReminders((prev) => [saved, ...prev]);
          router.refresh();
        }}
      />
    </div>
  );
}

