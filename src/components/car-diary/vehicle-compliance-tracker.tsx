"use client";

import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Landmark,
  Loader2,
  Pencil,
  Shield,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import type {
  AppLocale,
  ComplianceReminderType,
  Reminder,
  Vehicle,
  VehicleDocument,
  VehicleDocumentType,
} from "@/types/domain";

interface ComplianceSlotMeta {
  type: ComplianceReminderType;
  docType: VehicleDocumentType;
  icon: ComponentType<{ className?: string }>;
  iconAccentClass: string;
}

const COMPLIANCE_SLOTS: ReadonlyArray<ComplianceSlotMeta> = [
  {
    type: "liability_insurance",
    docType: "insurance",
    icon: ShieldCheck,
    iconAccentClass: "bg-blue-500/15 text-blue-400",
  },
  {
    type: "vignette",
    docType: "vignette",
    icon: Ticket,
    iconAccentClass: "bg-emerald-500/15 text-emerald-400",
  },
  {
    type: "technical_inspection",
    docType: "inspection",
    icon: ClipboardCheck,
    iconAccentClass: "bg-indigo-500/15 text-indigo-400",
  },
  {
    type: "casco",
    docType: "casco",
    icon: Shield,
    iconAccentClass: "bg-violet-500/15 text-violet-400",
  },
  {
    type: "fire_extinguisher",
    docType: "fire_extinguisher",
    icon: Flame,
    iconAccentClass: "bg-orange-500/15 text-orange-400",
  },
  {
    type: "vehicle_tax",
    docType: "vehicle_tax",
    icon: Landmark,
    iconAccentClass: "bg-cyan-500/15 text-cyan-400",
  },
];

type ComplianceState = "expired" | "expiring_soon" | "valid" | "missing";

function computeDaysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const slice = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slice)) return null;
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const targetUtc = Date.parse(`${slice}T00:00:00.000Z`);
  if (Number.isNaN(targetUtc)) return null;
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

function addMonthsIso(baseIso: string | null, months: number): string {
  const now = new Date();
  let anchor = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  if (baseIso && /^\d{4}-\d{2}-\d{2}$/.test(baseIso)) {
    const parsed = Date.parse(`${baseIso}T00:00:00.000Z`);
    // If current expiry is still in the future, extend from that date; otherwise extend from today
    if (!Number.isNaN(parsed) && parsed > anchor.getTime()) {
      anchor = new Date(parsed);
    }
  }
  const next = new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth() + months,
      anchor.getUTCDate()
    )
  );
  return next.toISOString().slice(0, 10);
}

export interface VehicleComplianceTrackerProps {
  vehicles: Vehicle[];
  initialReminders: Reminder[];
  documents?: VehicleDocument[];
  scopedVehicleId?: string;
  onReminderUpserted?: (reminder: Reminder) => void;
}

export function VehicleComplianceTracker({
  vehicles,
  initialReminders,
  documents = [],
  scopedVehicleId,
  onReminderUpserted,
}: VehicleComplianceTrackerProps) {
  const t = useTranslations("carDiary.compliance");
  const tTypes = useTranslations("carDiary.reminderTypes");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    scopedVehicleId ?? vehicles[0]?.id ?? ""
  );

  useEffect(() => {
    setReminders(initialReminders);
  }, [initialReminders]);

  useEffect(() => {
    if (scopedVehicleId) {
      setSelectedVehicleId(scopedVehicleId);
    } else if (
      vehicles.length > 0 &&
      !vehicles.some((v) => v.id === selectedVehicleId)
    ) {
      setSelectedVehicleId(vehicles[0]?.id ?? "");
    }
  }, [scopedVehicleId, selectedVehicleId, vehicles]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ComplianceReminderType | null>(
    null
  );
  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null
  );
  const [dueDateInput, setDueDateInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const activeVehicle = useMemo(
    () =>
      vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );

  const slotCards = useMemo(() => {
    if (!activeVehicle) return [];

    return COMPLIANCE_SLOTS.map((slot) => {
      // 1. Prefer active Reminder for (vehicleId, slot.type)
      const matchingReminders = reminders
        .filter(
          (r) =>
            r.vehicleId === activeVehicle.id &&
            r.type === slot.type &&
            r.status !== "completed" &&
            r.status !== "cancelled" &&
            Boolean(r.dueDate)
        )
        .sort((a, b) =>
          (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
        );
      const activeReminder = matchingReminders[0] ?? null;

      // 2. Fallback to Vault Document with expiryDate if no reminder set yet
      const matchingDocs = documents
        .filter(
          (d) =>
            d.vehicleId === activeVehicle.id &&
            d.docType === slot.docType &&
            Boolean(d.expiryDate)
        )
        .sort((a, b) =>
          (b.expiryDate ?? "").localeCompare(a.expiryDate ?? "")
        );
      const fallbackDoc = matchingDocs[0] ?? null;

      const expiryDate =
        activeReminder?.dueDate ?? fallbackDoc?.expiryDate ?? null;
      const daysRemaining = computeDaysUntil(expiryDate);

      let state: ComplianceState = "missing";
      if (daysRemaining !== null) {
        if (daysRemaining < 0) state = "expired";
        else if (daysRemaining <= 30) state = "expiring_soon";
        else state = "valid";
      }

      return {
        ...slot,
        activeReminder,
        fallbackDoc,
        expiryDate,
        daysRemaining,
        state,
      };
    });
  }, [activeVehicle, reminders, documents]);

  const attentionCount = useMemo(
    () =>
      slotCards.filter(
        (c) => c.state === "expired" || c.state === "expiring_soon"
      ).length,
    [slotCards]
  );

  const configuredCount = useMemo(
    () => slotCards.filter((c) => c.state !== "missing").length,
    [slotCards]
  );

  if (!activeVehicle) {
    return null;
  }

  const openSlotEditor = (card: (typeof slotCards)[number]) => {
    setEditingSlot(card.type);
    setEditingReminderId(card.activeReminder?.id ?? null);
    setDueDateInput(card.expiryDate ?? addMonthsIso(null, 12));
    setNotesInput(card.activeReminder?.notes ?? card.fallbackDoc?.notes ?? "");
    setModalOpen(true);
  };

  const handleSaveSlot = async () => {
    if (!editingSlot || !dueDateInput || !/^\d{4}-\d{2}-\d{2}$/.test(dueDateInput)) {
      toast.error(t("dateRequiredToast"));
      return;
    }

    setSaving(true);
    try {
      const title = t(`items.${editingSlot}`);
      const trimmedNotes = notesInput.trim() ? notesInput.trim() : null;

      let res: Response;
      if (editingReminderId) {
        res = await fetch(`/api/reminders/${editingReminderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: editingSlot,
            title,
            dueDate: dueDateInput,
            notes: trimmedNotes,
            status: "scheduled",
          }),
        });
      } else {
        res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleId: activeVehicle.id,
            type: editingSlot,
            title,
            dueDate: dueDateInput,
            dueMileageKm: null,
            notes: trimmedNotes,
            channels: ["email"],
          }),
        });
      }

      if (!res.ok) {
        toast.error(t("saveErrorToast"));
        return;
      }

      const json = (await res.json()) as { reminder: Reminder };
      const saved = json.reminder;

      setReminders((prev) => {
        const exists = prev.some((r) => r.id === saved.id);
        return exists
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [saved, ...prev];
      });

      onReminderUpserted?.(saved);

      const days = computeDaysUntil(saved.dueDate);
      if (days !== null && days <= 14) {
        toast.success(t("savedWithInstantAlertToast"));
      } else {
        toast.success(t("savedToast"));
      }

      setModalOpen(false);
      router.refresh();
    } catch {
      toast.error(t("saveErrorToast"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-primary/25">
        <CardHeader className="pb-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ShieldCheck
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                  {t("sectionTitle")}
                </CardTitle>
                <Badge
                  variant={attentionCount > 0 ? "warning" : "success"}
                  className="text-[11px]"
                >
                  {attentionCount > 0
                    ? t("attentionBadge", { count: attentionCount })
                    : t("configuredBadge", { count: configuredCount })}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                {t("sectionSubtitle")}
              </CardDescription>
            </div>

            {!scopedVehicleId && vehicles.length > 1 ? (
              <div className="w-full sm:w-64">
                <Select
                  value={activeVehicle.id}
                  onValueChange={setSelectedVehicleId}
                >
                  <SelectTrigger aria-label={t("selectVehicleAria")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((veh) => (
                      <SelectItem key={veh.id} value={veh.id}>
                        {veh.make} {veh.model} ({veh.plateNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : !scopedVehicleId ? (
              <span className="inline-flex items-center self-start rounded-lg border border-border bg-secondary px-2.5 py-1 font-mono text-xs font-bold text-foreground sm:self-auto">
                {activeVehicle.plateNumber}
              </span>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {slotCards.map((card) => {
              const Icon = card.icon;
              const isExpired = card.state === "expired";
              const isSoon = card.state === "expiring_soon";
              const isValid = card.state === "valid";

              return (
                <div
                  key={card.type}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border p-4 transition-all",
                    isExpired
                      ? "border-destructive/50 bg-destructive/[0.06]"
                      : isSoon
                        ? "border-amber-500/45 bg-amber-500/[0.07]"
                        : isValid
                          ? "border-border bg-secondary/25 hover:border-primary/35"
                          : "border-dashed border-border bg-secondary/15 hover:border-primary/35"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            card.iconAccentClass
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            {t(`items.${card.type}`)}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {t(`hints.${card.type}`)}
                          </p>
                        </div>
                      </div>

                      {isExpired ? (
                        <Badge variant="destructive" className="shrink-0">
                          <AlertTriangle className="h-3 w-3" />
                          {t("statusExpired")}
                        </Badge>
                      ) : isSoon ? (
                        <Badge variant="warning" className="shrink-0">
                          <BellRing className="h-3 w-3" />
                          {t("statusSoon")}
                        </Badge>
                      ) : isValid ? (
                        <Badge variant="success" className="shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("statusValid")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          {t("statusNotSet")}
                        </Badge>
                      )}
                    </div>

                    {card.expiryDate && card.daysRemaining !== null ? (
                      <div className="mt-3.5 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            {formatDate(card.expiryDate, locale)}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-xs font-semibold",
                              isExpired
                                ? "text-destructive"
                                : isSoon
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                            )}
                          >
                            {card.daysRemaining < 0
                              ? t("daysOverdue", {
                                  days: Math.abs(card.daysRemaining),
                                })
                              : card.daysRemaining === 0
                                ? t("expiresToday")
                                : t("daysRemaining", {
                                    days: card.daysRemaining,
                                  })}
                          </span>
                        </div>

                        {card.activeReminder?.notes ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {card.activeReminder.notes}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3.5 text-xs text-muted-foreground">
                        {t("notConfiguredPrompt")}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <BellRing className="h-3 w-3 text-primary" />
                      {t("alertLeadLabel")}
                    </span>

                    <Button
                      type="button"
                      size="sm"
                      variant={
                        isExpired || isSoon
                          ? "gradient"
                          : card.expiryDate
                            ? "outline"
                            : "secondary"
                      }
                      className="h-8 text-xs"
                      onClick={() => openSlotEditor(card)}
                    >
                      {card.expiryDate ? (
                        <>
                          <Pencil className="h-3 w-3" />
                          {isExpired || isSoon ? t("renewBtn") : t("editBtn")}
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="h-3.5 w-3.5" />
                          {t("setExpiryBtn")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Set / Renew Compliance Expiry Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {editingSlot ? t(`items.${editingSlot}`) : tTypes("liability_insurance")}
            </DialogTitle>
            <DialogDescription>
              {activeVehicle.make} {activeVehicle.model} (
              {activeVehicle.plateNumber})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="compliance-expiry-date">{t("expiryDateLabel")}</Label>
              <Input
                id="compliance-expiry-date"
                type="date"
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                className="font-mono"
              />

              {/* 1-Click Renewal Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {t("quickAddLabel")}:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 font-mono text-[11px]"
                  onClick={() =>
                    setDueDateInput(addMonthsIso(dueDateInput, 1))
                  }
                >
                  {t("preset1m")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 font-mono text-[11px]"
                  onClick={() =>
                    setDueDateInput(addMonthsIso(dueDateInput, 3))
                  }
                >
                  {t("preset3m")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 font-mono text-[11px]"
                  onClick={() =>
                    setDueDateInput(addMonthsIso(dueDateInput, 12))
                  }
                >
                  {t("preset1y")}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compliance-notes">{t("notesLabel")}</Label>
              <Input
                id="compliance-notes"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder={t("notesPlaceholder")}
                maxLength={240}
              />
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/[0.08] p-3 text-xs text-foreground">
              <div className="flex items-center gap-2 font-semibold">
                <BellRing className="h-3.5 w-3.5 text-primary" />
                <span>{t("autoAlertTitle")}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {t("autoAlertDesc")}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="gradient"
              disabled={saving}
              onClick={() => void handleSaveSlot()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tCommon("save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

