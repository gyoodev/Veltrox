"use client";

import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Flame,
  Gauge,
  Landmark,
  Loader2,
  Pencil,
  RotateCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
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
import type { BgTollCheckResponse } from "@/lib/compliance/bgtoll";
import type { RtaInspectionResult } from "@/lib/compliance/rta";
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

const POPULAR_INSURERS = [
  "ДЗИ",
  "Лев Инс",
  "Булстрад",
  "Армеец",
  "Евроинс",
  "Алианц",
  "Дженерали",
  "Бул Инс",
  "ДаллБогг",
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
  const [dueDateInput, setDueDateInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Automatic Check Modal States:
  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [checkingSlot, setCheckingSlot] = useState<ComplianceReminderType | null>(
    null
  );
  const [checkingLoading, setCheckingLoading] = useState(false);
  const [bgtollResult, setBgtollResult] = useState<BgTollCheckResponse | null>(
    null
  );
  // RTA Inspection States:
  const [rtaCaptchaImage, setRtaCaptchaImage] = useState<string | null>(null);
  const [rtaSessionToken, setRtaSessionToken] = useState<string | null>(null);
  const [rtaCaptchaInput, setRtaCaptchaInput] = useState<string>("");
  const [rtaLoadingCaptcha, setRtaLoadingCaptcha] = useState(false);
  const [rtaChecking, setRtaChecking] = useState(false);
  const [rtaResult, setRtaResult] = useState<RtaInspectionResult | null>(null);
  const [rtaError, setRtaError] = useState<string | null>(null);
  const [checkDueDateInput, setCheckDueDateInput] = useState<string>("");
  const [checkNotesInput, setCheckNotesInput] = useState<string>("");
  // Globi Insurance States:
  const [globiViewTab, setGlobiViewTab] = useState<"embedded" | "sync">("embedded");
  const [globiIframeKey, setGlobiIframeKey] = useState<number>(0);
  const [globiSmartPaste, setGlobiSmartPaste] = useState<string>("");

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
    setDueDateInput(card.expiryDate ?? addMonthsIso(null, 12));
    setNotesInput(card.activeReminder?.notes ?? card.fallbackDoc?.notes ?? "");
    setModalOpen(true);
  };

  const saveReminderForSlot = async (
    slotType: ComplianceReminderType,
    dueDate: string,
    notes: string | null
  ): Promise<boolean> => {
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      toast.error(t("dateRequiredToast"));
      return false;
    }

    setSaving(true);
    try {
      const title = t(`items.${slotType}`);
      const trimmedNotes = notes?.trim() ? notes.trim() : null;

      // Check if there is an existing reminder for this slot on activeVehicle
      const existingReminder = reminders.find(
        (r) =>
          r.vehicleId === activeVehicle.id &&
          r.type === slotType &&
          r.status !== "completed" &&
          r.status !== "cancelled"
      );

      let res: Response;
      if (existingReminder) {
        res = await fetch(`/api/reminders/${existingReminder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: slotType,
            title,
            dueDate,
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
            type: slotType,
            title,
            dueDate,
            dueMileageKm: null,
            notes: trimmedNotes,
            channels: ["email"],
          }),
        });
      }

      if (!res.ok) {
        toast.error(t("saveErrorToast"));
        return false;
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

      router.refresh();
      return true;
    } catch {
      toast.error(t("saveErrorToast"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlot = async () => {
    if (!editingSlot) return;
    const ok = await saveReminderForSlot(editingSlot, dueDateInput, notesInput);
    if (ok) {
      setModalOpen(false);
    }
  };

  const copyToClipboard = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.success(msg);
    }
  };

  const handleSmartPasteExtract = (text: string) => {
    setGlobiSmartPaste(text);
    if (!text.trim()) return;

    let foundDate: string | null = null;
    const endMatch = text.match(
      /(?:крайна\s*дата|валидна\s*до|valid\s*until|expiry)[\s\S]{0,30}?(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i
    );
    if (endMatch && endMatch[1] && endMatch[2] && endMatch[3]) {
      const d = endMatch[1].padStart(2, "0");
      const m = endMatch[2].padStart(2, "0");
      const y = endMatch[3];
      foundDate = `${y}-${m}-${d}`;
    } else {
      const allDates = [...text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)];
      const last = allDates[allDates.length - 1];
      if (last && last[1] && last[2] && last[3]) {
        const d = last[1].padStart(2, "0");
        const m = last[2].padStart(2, "0");
        const y = last[3];
        foundDate = `${y}-${m}-${d}`;
      }
    }

    let foundInsurer: string | null = null;
    for (const ins of POPULAR_INSURERS) {
      if (new RegExp(ins, "i").test(text)) {
        foundInsurer = ins;
        break;
      }
    }

    if (foundDate) {
      setCheckDueDateInput(foundDate);
    }
    if (foundInsurer) {
      setCheckNotesInput((prev) => {
        const trimmed = prev.trim();
        if (!trimmed) return `${foundInsurer} полица ГО`;
        if (trimmed.includes(foundInsurer)) return trimmed;
        return `${foundInsurer} - ${trimmed}`;
      });
    }

    if (foundDate || foundInsurer) {
      toast.success(t("globiParsedToast"));
    }
  };

  const handleOpenCheckModal = async (slotType: ComplianceReminderType) => {
    setCheckingSlot(slotType);
    setCheckModalOpen(true);
    setBgtollResult(null);
    setRtaResult(null);
    setRtaError(null);

    const card = slotCards.find((c) => c.type === slotType);
    setCheckDueDateInput(card?.expiryDate ?? addMonthsIso(null, 12));
    setCheckNotesInput(card?.activeReminder?.notes ?? "");

    if (slotType === "vignette") {
      setCheckingLoading(true);
      try {
        const res = await fetch(
          `/api/compliance/check-bgtoll?plate=${encodeURIComponent(
            activeVehicle.plateNumber
          )}`
        );
        if (res.ok) {
          const data = (await res.json()) as BgTollCheckResponse;
          setBgtollResult(data);
          if (data.found && data.vignette?.validDateTo) {
            setCheckDueDateInput(data.vignette.validDateTo);
            setCheckNotesInput(
              `Е-винетка № ${data.vignette.vignetteNumber} (${
                data.vignette.vehicleType || data.vignette.vehicleClass || "BGTOLL"
              })`
            );
          }
        } else {
          toast.error(t("checkingError"));
        }
      } catch {
        toast.error(t("checkingError"));
      } finally {
        setCheckingLoading(false);
      }
    } else if (slotType === "liability_insurance") {
      setGlobiViewTab("embedded");
      setGlobiSmartPaste("");
      void copyToClipboard(activeVehicle.plateNumber, t("globiCopiedToast"));
    } else if (slotType === "technical_inspection") {
      void loadRtaCaptcha();
    }
  };

  const loadRtaCaptcha = async () => {
    setRtaLoadingCaptcha(true);
    setRtaCaptchaInput("");
    setRtaError(null);
    try {
      const res = await fetch("/api/compliance/rta-captcha");
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          captchaImage: string;
          sessionToken: string;
          error?: string;
        };
        if (data.ok && data.captchaImage) {
          setRtaCaptchaImage(data.captchaImage);
          setRtaSessionToken(data.sessionToken);
        } else {
          setRtaError(data.error || "Неуспешно зареждане на код за сигурност");
        }
      } else {
        setRtaError("Неуспешна връзка с РТА портала");
      }
    } catch {
      setRtaError("Грешка при връзка с РТА");
    } finally {
      setRtaLoadingCaptcha(false);
    }
  };

  const handleCheckRta = async () => {
    if (!activeVehicle || !rtaCaptchaInput.trim() || !rtaSessionToken) return;

    setRtaChecking(true);
    setRtaError(null);
    try {
      const res = await fetch("/api/compliance/check-inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: activeVehicle.plateNumber,
          captcha: rtaCaptchaInput.trim(),
          sessionToken: rtaSessionToken,
        }),
      });

      const data = (await res.json()) as RtaInspectionResult;
      setRtaResult(data);

      if (data.captchaMismatch) {
        setRtaError(t("rtaCaptchaMismatch"));
        void loadRtaCaptcha();
        return;
      }

      if (data.found && data.nextInspectionDate) {
        setCheckDueDateInput(data.nextInspectionDate);
        const ecoNote = data.ecoCategory
          ? ` | ${t("rtaEcoGroup")}: ${data.ecoCategory}`
          : "";
        const vinNote = data.vin ? ` | ${t("rtaVin")}: ${data.vin}` : "";
        setCheckNotesInput(
          `ГТП валиден до ${data.rawNextInspectionDate || data.nextInspectionDate}${ecoNote}${vinNote}`
        );
        toast.success(t("rtaCheckFoundTitle"));
      } else if (!data.found) {
        void loadRtaCaptcha();
      }
    } catch {
      setRtaError("Грешка при проверка в РТА");
      void loadRtaCaptcha();
    } finally {
      setRtaChecking(false);
    }
  };

  const handleApplyCheckResult = async () => {
    if (!checkingSlot || !checkDueDateInput) return;
    const ok = await saveReminderForSlot(
      checkingSlot,
      checkDueDateInput,
      checkNotesInput
    );
    if (ok) {
      setCheckModalOpen(false);
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

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpenCheckModal("vignette")}
                className="h-9 gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-medium"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t("checkAllBtn")}</span>
              </Button>

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
          </div>
        </CardHeader>

        <CardContent className="p-3.5 sm:p-6 pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slotCards.map((card) => {
              const Icon = card.icon;
              const isExpired = card.state === "expired";
              const isSoon = card.state === "expiring_soon";
              const isValid = card.state === "valid";

              return (
                <div
                  key={card.type}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 transition-all min-w-0 overflow-hidden",
                    isExpired
                      ? "border-destructive/50 bg-destructive/[0.06]"
                      : isSoon
                        ? "border-amber-500/45 bg-amber-500/[0.07]"
                        : isValid
                          ? "border-border bg-secondary/25 hover:border-primary/35"
                          : "border-dashed border-border bg-secondary/15 hover:border-primary/35"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-1">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5",
                            card.iconAccentClass
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {t(`items.${card.type}`)}
                          </h3>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 leading-tight">
                            {t(`hints.${card.type}`)}
                          </p>
                        </div>
                      </div>

                      {isExpired ? (
                        <Badge variant="destructive" className="shrink-0 text-[10px] sm:text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {t("statusExpired")}
                        </Badge>
                      ) : isSoon ? (
                        <Badge variant="warning" className="shrink-0 text-[10px] sm:text-xs">
                          <BellRing className="h-3 w-3" />
                          {t("statusSoon")}
                        </Badge>
                      ) : isValid ? (
                        <Badge variant="success" className="shrink-0 text-[10px] sm:text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("statusValid")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs">
                          {t("statusNotSet")}
                        </Badge>
                      )}
                    </div>

                    {card.expiryDate && card.daysRemaining !== null ? (
                      <div className="mt-3.5 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
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

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-border/60 pt-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <BellRing className="h-3 w-3 text-primary shrink-0" />
                      <span>{t("alertLeadLabel")}</span>
                    </span>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-8 px-2 text-xs gap-1 w-full sm:w-auto justify-center font-medium",
                          card.type === "vignette" &&
                            "border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300",
                          card.type === "technical_inspection" &&
                            "border-indigo-500/35 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300",
                          card.type === "liability_insurance" &&
                            "border-sky-500/35 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
                        )}
                        onClick={() => void handleOpenCheckModal(card.type)}
                      >
                        <Search className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {card.type === "vignette"
                            ? t("checkVignetteBtn")
                            : card.type === "technical_inspection"
                              ? t("rtaCheckBtn")
                              : card.type === "liability_insurance"
                                ? t("checkLiabilityBtn")
                                : t("checkBtn")}
                        </span>
                      </Button>

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
                        className="h-8 px-2 text-xs gap-1 w-full sm:w-auto justify-center font-medium"
                        onClick={() => openSlotEditor(card)}
                      >
                        {card.expiryDate ? (
                          <>
                            <Pencil className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {isExpired || isSoon ? t("renewBtn") : t("editBtn")}
                            </span>
                          </>
                        ) : (
                          <>
                            <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{t("setExpiryBtn")}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Set / Renew Compliance Expiry Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain p-4 sm:p-6">
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

          <div className="space-y-4 pt-1 flex-1">
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

            {editingSlot === "liability_insurance" ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t("popularInsurers")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      void handleOpenCheckModal("liability_insurance");
                    }}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1"
                  >
                    <Search className="h-3 w-3" />
                    <span>{t("checkLiabilityBtn")}</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_INSURERS.map((ins) => (
                    <button
                      key={ins}
                      type="button"
                      onClick={() => {
                        const current = notesInput.trim();
                        if (!current) {
                          setNotesInput(`${ins} полица`);
                        } else if (!current.includes(ins)) {
                          setNotesInput(`${ins} - ${current}`);
                        }
                      }}
                      className="rounded-lg border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300"
                    >
                      {ins}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

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

          <DialogFooter className="pt-3 sticky bottom-0 bg-popover/95 backdrop-blur-md border-t border-border/40 pb-1 mt-2 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="w-full sm:w-auto min-h-10"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="gradient"
              disabled={saving}
              onClick={() => void handleSaveSlot()}
              className="w-full sm:w-auto min-h-10 font-semibold"
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

      {/* Automatic Registry Check & Add Modal */}
      <Dialog open={checkModalOpen} onOpenChange={setCheckModalOpen}>
        <DialogContent
          className={cn(
            "max-h-[92dvh] overflow-y-auto overscroll-contain p-4 sm:p-6 transition-all",
            checkingSlot === "liability_insurance" ? "sm:max-w-3xl" : "sm:max-w-lg"
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {checkingSlot === "vignette" ? (
                <Ticket className="h-5 w-5 text-emerald-400" />
              ) : checkingSlot === "liability_insurance" ? (
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              ) : checkingSlot === "technical_inspection" ? (
                <ClipboardCheck className="h-5 w-5 text-indigo-400" />
              ) : checkingSlot === "casco" ? (
                <Shield className="h-5 w-5 text-violet-400" />
              ) : checkingSlot === "fire_extinguisher" ? (
                <Flame className="h-5 w-5 text-orange-400" />
              ) : (
                <Landmark className="h-5 w-5 text-cyan-400" />
              )}
              {checkingSlot
                ? checkingSlot === "vignette"
                  ? bgtollResult?.found
                    ? t("vignetteFoundTitle")
                    : t("items.vignette")
                  : checkingSlot === "technical_inspection"
                    ? rtaResult?.found
                      ? t("rtaCheckFoundTitle")
                      : t("rtaCheckTitle")
                    : checkingSlot === "liability_insurance"
                      ? t("globiCheckTitle")
                      : t(
                          `${
                            checkingSlot === "casco"
                              ? "casco"
                              : checkingSlot === "fire_extinguisher"
                                ? "extinguisher"
                                : "tax"
                          }CheckTitle`
                        )
                : t("checkDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("checkDialogDesc", { plate: activeVehicle.plateNumber })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Vignette BGTOLL Live Result */}
            {checkingSlot === "vignette" ? (
              checkingLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-secondary/30 p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {t("checkingVignette")}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      check.bgtoll.bg/check/vignette/plate/BG/
                      {activeVehicle.plateNumber}
                    </p>
                  </div>
                </div>
              ) : bgtollResult?.found && bgtollResult.vignette ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <span className="font-semibold text-emerald-400">
                          {t("statusValid")} (BGTOLL)
                        </span>
                      </div>
                      <Badge variant="success" className="font-mono uppercase">
                        {bgtollResult.normalizedPlate}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-background/60 p-2.5">
                        <span className="text-muted-foreground block text-[11px]">
                          {t("vignetteValidTo")}
                        </span>
                        <span className="font-mono font-bold text-foreground text-sm">
                          {formatDate(bgtollResult.vignette.validDateTo, locale)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-background/60 p-2.5">
                        <span className="text-muted-foreground block text-[11px]">
                          {t("vignetteTypeLabel")}
                        </span>
                        <span className="font-semibold text-foreground truncate block">
                          {bgtollResult.vignette.vehicleType ||
                            bgtollResult.vignette.vehicleClass ||
                            "Е-винетка"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-1 px-0.5">
                      <span>
                        {t("vignetteNumberLabel")}:{" "}
                        <strong className="font-mono text-foreground font-semibold">
                          {bgtollResult.vignette.vignetteNumber}
                        </strong>
                      </span>
                      {bgtollResult.vignette.price ? (
                        <span className="font-mono font-medium text-emerald-400">
                          {bgtollResult.vignette.price}{" "}
                          {bgtollResult.vignette.currency || "EUR"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("vignetteFoundDesc", {
                      plate: activeVehicle.plateNumber,
                    })}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <AlertTriangle className="h-5 w-5" />
                      <span>{t("vignetteNotFoundTitle")}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("vignetteNotFoundDesc", {
                        plate: activeVehicle.plateNumber,
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 text-xs gap-1.5"
                      >
                        <a
                          href="https://web.bgtoll.bg"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>{t("openBgtollBuy")}</span>
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="check-date-vignette-fallback">
                      {t("enterDateManually")}
                    </Label>
                    <Input
                      id="check-date-vignette-fallback"
                      type="date"
                      value={checkDueDateInput}
                      onChange={(e) => setCheckDueDateInput(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              )
            ) : null}

            {/* Liability Insurance (Integrated Globi.bg Check & Syncer) */}
            {checkingSlot === "liability_insurance" ? (
              <div className="space-y-4">
                {/* Segmented View Switcher */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border">
                  <button
                    type="button"
                    onClick={() => setGlobiViewTab("embedded")}
                    className={cn(
                      "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                      globiViewTab === "embedded"
                        ? "bg-background text-foreground shadow-sm border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Search className="h-3.5 w-3.5 text-sky-400" />
                    <span>{t("globiTabEmbedded")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobiViewTab("sync")}
                    className={cn(
                      "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                      globiViewTab === "sync"
                        ? "bg-background text-foreground shadow-sm border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    <span>{t("globiTabSync")}</span>
                    {checkDueDateInput ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-400 ml-1" />
                    ) : null}
                  </button>
                </div>

                {/* Tab 1: Embedded In-App Globi Tool */}
                {globiViewTab === "embedded" ? (
                  <div className="space-y-3">
                    {/* Live Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.07] px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-medium hidden sm:inline">
                          Автомобил:
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs font-mono font-bold border-sky-500/40 bg-background/80 hover:bg-sky-500/20"
                          onClick={() =>
                            copyToClipboard(
                              activeVehicle.plateNumber,
                              t("globiCopiedToast")
                            )
                          }
                          title={t("copyPlate")}
                        >
                          <Copy className="h-3 w-3 mr-1 text-sky-400" />
                          <span>{activeVehicle.plateNumber}</span>
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          {t("globiPlateCopiedPrompt", {
                            plate: activeVehicle.plateNumber,
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setGlobiIframeKey((k) => k + 1)}
                          title={t("globiReloadFrame")}
                        >
                          <RotateCw className="h-3 w-3" />
                          <span className="hidden sm:inline">
                            {t("globiReloadFrame")}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <a
                            href="https://globi.bg/tools/motor-insurance"
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t("globiOpenNewTab")}
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="hidden sm:inline">
                              {t("globiOpenNewTab")}
                            </span>
                          </a>
                        </Button>
                      </div>
                    </div>

                    {/* Interactive In-App Iframe */}
                    <div className="relative rounded-2xl border border-border bg-background overflow-hidden shadow-inner">
                      <iframe
                        key={globiIframeKey}
                        src="https://globi.bg/tools/motor-insurance"
                        className="w-full h-[460px] sm:h-[500px] border-0"
                        title="Globi Motor Insurance Tool"
                        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      />
                    </div>

                    {/* Quick Result Dock beneath the tool */}
                    <div className="rounded-2xl border border-border bg-secondary/30 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                          <span>{t("globiSmartPasteLabel")}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGlobiViewTab("sync")}
                          className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                        >
                          Пълен преглед →
                        </button>
                      </div>

                      <Input
                        value={globiSmartPaste}
                        onChange={(e) => handleSmartPasteExtract(e.target.value)}
                        placeholder={t("globiSmartPastePlaceholder")}
                        className="h-8 text-xs font-mono"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                        {/* Quick Insurers */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-muted-foreground mr-1">
                            Застраховател:
                          </span>
                          {POPULAR_INSURERS.slice(0, 6).map((ins) => (
                            <button
                              key={ins}
                              type="button"
                              onClick={() => {
                                const current = checkNotesInput.trim();
                                if (!current) {
                                  setCheckNotesInput(`${ins} полица ГО`);
                                } else if (!current.includes(ins)) {
                                  setCheckNotesInput(`${ins} - ${current}`);
                                }
                              }}
                              className={cn(
                                "rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition",
                                checkNotesInput.includes(ins)
                                  ? "border-sky-500 bg-sky-500/20 text-sky-300 font-bold"
                                  : "border-border bg-background/60 text-muted-foreground hover:border-sky-500/40 hover:text-sky-300"
                              )}
                            >
                              {ins}
                            </button>
                          ))}
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1 ml-auto">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-1.5 font-mono text-[10px]"
                            onClick={() =>
                              setCheckDueDateInput(
                                addMonthsIso(checkDueDateInput, 3)
                              )
                            }
                          >
                            +3м
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-1.5 font-mono text-[10px]"
                            onClick={() =>
                              setCheckDueDateInput(
                                addMonthsIso(checkDueDateInput, 6)
                              )
                            }
                          >
                            +6м
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-1.5 font-mono text-[10px]"
                            onClick={() =>
                              setCheckDueDateInput(
                                addMonthsIso(checkDueDateInput, 12)
                              )
                            }
                          >
                            +1г
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Tab 2: Result & Save Detailed View */
                  <div className="space-y-4">
                    {/* Live Policy Preview Card */}
                    <div className="rounded-2xl border border-sky-500/35 bg-sky-500/[0.08] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-sky-400" />
                          <div>
                            <h4 className="text-sm font-bold text-foreground">
                              {checkDueDateInput
                                ? computeDaysUntil(checkDueDateInput) !== null &&
                                  (computeDaysUntil(checkDueDateInput) as number) < 0
                                  ? t("globiStatusExpired")
                                  : computeDaysUntil(checkDueDateInput) !== null &&
                                      (computeDaysUntil(checkDueDateInput) as number) <= 30
                                    ? t("globiStatusExpiring")
                                    : t("globiStatusActive")
                                : t("items.liability_insurance")}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {checkNotesInput || "Гражданска отговорност"}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant={
                            checkDueDateInput &&
                            computeDaysUntil(checkDueDateInput) !== null &&
                            (computeDaysUntil(checkDueDateInput) as number) < 0
                              ? "destructive"
                              : checkDueDateInput &&
                                  computeDaysUntil(checkDueDateInput) !== null &&
                                  (computeDaysUntil(checkDueDateInput) as number) <= 30
                                ? "warning"
                                : "success"
                          }
                          className="font-mono"
                        >
                          {activeVehicle.plateNumber}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="rounded-xl bg-background/60 p-2.5">
                          <span className="text-muted-foreground block text-[11px]">
                            {t("expiryDateLabel")}
                          </span>
                          <span className="font-mono font-bold text-foreground text-sm">
                            {checkDueDateInput
                              ? formatDate(checkDueDateInput, locale)
                              : "-"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-background/60 p-2.5">
                          <span className="text-muted-foreground block text-[11px]">
                            Оставащо време
                          </span>
                          <span className="font-semibold text-foreground truncate block">
                            {checkDueDateInput &&
                            computeDaysUntil(checkDueDateInput) !== null
                              ? (computeDaysUntil(checkDueDateInput) as number) < 0
                                ? `${Math.abs(
                                    computeDaysUntil(checkDueDateInput) as number
                                  )} дни просрочие`
                                : `${computeDaysUntil(
                                    checkDueDateInput
                                  )} дни до падеж`
                              : "Въведете крайна дата"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-sky-500/20">
                        <BellRing className="h-3 w-3 text-sky-400" />
                        <span>{t("autoAlertDesc")}</span>
                      </div>
                    </div>

                    {/* Smart Paste / Extractor Input */}
                    <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 space-y-1.5">
                      <Label
                        htmlFor="globi-smart-paste-input"
                        className="text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                        <span>{t("globiSmartPasteLabel")}</span>
                      </Label>
                      <Input
                        id="globi-smart-paste-input"
                        value={globiSmartPaste}
                        onChange={(e) =>
                          handleSmartPasteExtract(e.target.value)
                        }
                        placeholder={t("globiSmartPastePlaceholder")}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    {/* Expiry Date with Presets */}
                    <div className="space-y-2">
                      <Label htmlFor="check-date-gf">
                        {t("expiryDateLabel")}
                      </Label>
                      <Input
                        id="check-date-gf"
                        type="date"
                        value={checkDueDateInput}
                        onChange={(e) => setCheckDueDateInput(e.target.value)}
                        className="font-mono"
                      />
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {t("quickAddLabel")}:
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 font-mono text-[11px]"
                          onClick={() =>
                            setCheckDueDateInput(
                              addMonthsIso(checkDueDateInput, 3)
                            )
                          }
                        >
                          {t("preset3m")} (вноска)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 font-mono text-[11px]"
                          onClick={() =>
                            setCheckDueDateInput(
                              addMonthsIso(checkDueDateInput, 6)
                            )
                          }
                        >
                          +6 мес.
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 font-mono text-[11px]"
                          onClick={() =>
                            setCheckDueDateInput(
                              addMonthsIso(checkDueDateInput, 12)
                            )
                          }
                        >
                          {t("preset1y")}
                        </Button>
                      </div>
                    </div>

                    {/* Popular Insurers Quick Chips */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {t("popularInsurers")}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_INSURERS.map((ins) => (
                          <button
                            key={ins}
                            type="button"
                            onClick={() => {
                              const current = checkNotesInput.trim();
                              if (!current) {
                                setCheckNotesInput(`${ins} полица ГО`);
                              } else if (!current.includes(ins)) {
                                setCheckNotesInput(`${ins} - ${current}`);
                              }
                            }}
                            className={cn(
                              "rounded-lg border px-2 py-0.5 text-[11px] font-medium transition",
                              checkNotesInput.includes(ins)
                                ? "border-sky-500 bg-sky-500/20 text-sky-300 font-bold"
                                : "border-border bg-secondary/50 text-muted-foreground hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300"
                            )}
                          >
                            {ins}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes Input */}
                    <div className="space-y-1.5">
                      <Label htmlFor="check-notes-gf">{t("notesLabel")}</Label>
                      <Input
                        id="check-notes-gf"
                        value={checkNotesInput}
                        onChange={(e) => setCheckNotesInput(e.target.value)}
                        placeholder="напр. ДЗИ полица № 123456789, вноска 2/4"
                        maxLength={240}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Technical Inspection (RTA) */}
            {checkingSlot === "technical_inspection" ? (
              <div className="space-y-3.5">
                {/* Official RTA Link Banner */}
                <div className="rounded-2xl border border-border bg-secondary/30 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t("rtaCheckDesc")}
                    </p>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-mono border-indigo-500/30 text-indigo-400">
                      RTA / ИААА
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 font-mono"
                      onClick={() =>
                        copyToClipboard(
                          activeVehicle.plateNumber,
                          t("copiedToast")
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                      <span>{activeVehicle.plateNumber}</span>
                    </Button>
                    {activeVehicle.vin ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 font-mono"
                        onClick={() =>
                          copyToClipboard(
                            activeVehicle.vin || "",
                            t("copiedToast")
                          )
                        }
                      >
                        <Copy className="h-3 w-3" />
                        <span>VIN: {activeVehicle.vin}</span>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs gap-1.5 border-blue-500/35 text-blue-400 hover:bg-blue-500/10 font-medium"
                    >
                      <a
                        href="https://public-eis.rta.government.bg/public-vehicle-check/vin-check"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Gauge className="h-3.5 w-3.5" />
                        <span>Провери километри по VIN</span>
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      asChild
                      className="h-8 text-xs gap-1.5 ml-auto font-medium"
                    >
                      <a
                        href="https://rta.government.bg/services/check-inspection/index.html"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>{t("openRtaPortal")}</span>
                      </a>
                    </Button>
                  </div>
                </div>

                {/* RTA Live Check Box */}
                {rtaResult?.found ? (
                  <div
                    className={cn(
                      "rounded-2xl border p-4 space-y-3",
                      rtaResult.isValid
                        ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                        : "border-destructive/40 bg-destructive/[0.08]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {rtaResult.isValid ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                        )}
                        <div>
                          <h4 className="text-sm font-bold text-foreground">
                            {rtaResult.isValid
                              ? t("rtaCheckFoundTitle")
                              : t("rtaCheckExpiredTitle")}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {rtaResult.isValid
                              ? `Превозното средство с рег. № ${rtaResult.normalizedPlate} има валиден преглед.`
                              : t("rtaCheckExpiredDesc", {
                                  plate: rtaResult.normalizedPlate,
                                  date: rtaResult.rawNextInspectionDate || "-",
                                })}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={rtaResult.isValid ? "success" : "destructive"}
                        className="shrink-0"
                      >
                        {rtaResult.isValid
                          ? t("rtaStatusValid")
                          : t("rtaStatusExpired")}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-background/60 p-3 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-sans">
                          {t("rtaNextInspection")}
                        </span>
                        <p className="font-bold text-foreground text-sm">
                          {rtaResult.rawNextInspectionDate || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-sans">
                          {t("rtaEcoGroup")}
                        </span>
                        <p className="font-bold text-foreground text-sm">
                          {rtaResult.ecoCategory
                            ? `ЕКО ${rtaResult.ecoCategory}`
                            : "Няма данни"}
                        </p>
                      </div>
                      {rtaResult.vin ? (
                        <div className="col-span-2 pt-1 border-t border-border/40">
                          <span className="text-[10px] text-muted-foreground uppercase font-sans">
                            {t("rtaVin")}
                          </span>
                          <p className="font-bold text-foreground truncate">
                            {rtaResult.vin}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          setRtaResult(null);
                          void loadRtaCaptcha();
                        }}
                      >
                        <RotateCw className="h-3 w-3" />
                        <span>Нова проверка</span>
                      </Button>
                    </div>
                  </div>
                ) : rtaResult && !rtaResult.found ? (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {t("rtaCheckNotFoundTitle")}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t("rtaCheckNotFoundDesc", {
                            plate: activeVehicle.plateNumber,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          setRtaResult(null);
                          void loadRtaCaptcha();
                        }}
                      >
                        <RotateCw className="h-3 w-3" />
                        <span>Опитай отново</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Директна проверка в РТА
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Въведете кода от изображението по-долу:
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono">
                        {activeVehicle.plateNumber}
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex items-center justify-center h-10 min-w-28 rounded-lg border border-border bg-white p-1 overflow-hidden shadow-sm">
                          {rtaLoadingCaptcha ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : rtaCaptchaImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rtaCaptchaImage}
                              alt="RTA Captcha"
                              className="h-8 object-contain"
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Няма код
                            </span>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={rtaLoadingCaptcha}
                          onClick={() => void loadRtaCaptcha()}
                          className="h-10 w-10 p-0 shrink-0"
                          title={t("rtaCaptchaReload")}
                          aria-label={t("rtaCaptchaReload")}
                        >
                          <RotateCw
                            className={cn(
                              "h-4 w-4",
                              rtaLoadingCaptcha && "animate-spin"
                            )}
                          />
                        </Button>
                      </div>

                      <Input
                        value={rtaCaptchaInput}
                        onChange={(e) =>
                          setRtaCaptchaInput(
                            e.target.value.toUpperCase().slice(0, 4)
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && rtaCaptchaInput.length === 4) {
                            e.preventDefault();
                            void handleCheckRta();
                          }
                        }}
                        placeholder={t("rtaCaptchaPlaceholder")}
                        maxLength={4}
                        className="h-10 font-mono tracking-widest text-center uppercase text-base font-bold bg-background/70 border-border/80 flex-1 min-w-24"
                      />

                      <Button
                        type="button"
                        variant="gradient"
                        disabled={
                          rtaChecking ||
                          rtaCaptchaInput.trim().length !== 4 ||
                          !rtaSessionToken ||
                          rtaLoadingCaptcha
                        }
                        onClick={() => void handleCheckRta()}
                        className="h-10 px-4 text-xs font-semibold shrink-0"
                      >
                        {rtaChecking ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            {t("rtaChecking")}
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-1.5" />
                            {t("rtaCheckBtn")}
                          </>
                        )}
                      </Button>
                    </div>

                    {rtaError ? (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>{rtaError}</span>
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <Label htmlFor="check-date-rta">{t("expiryDateLabel")}</Label>
                  <Input
                    id="check-date-rta"
                    type="date"
                    value={checkDueDateInput}
                    onChange={(e) => setCheckDueDateInput(e.target.value)}
                    className="font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 font-mono text-[11px]"
                      onClick={() =>
                        setCheckDueDateInput(addMonthsIso(null, 12))
                      }
                    >
                      +1 година от днес
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="check-notes-rta">{t("notesLabel")}</Label>
                  <Input
                    id="check-notes-rta"
                    value={checkNotesInput}
                    onChange={(e) => setCheckNotesInput(e.target.value)}
                    placeholder="напр. ГТП стикер №..., Екогрупа 4"
                    maxLength={240}
                  />
                </div>
              </div>
            ) : null}

            {/* Casco, Fire Extinguisher, Vehicle Tax */}
            {checkingSlot === "casco" ||
            checkingSlot === "fire_extinguisher" ||
            checkingSlot === "vehicle_tax" ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {checkingSlot === "casco"
                      ? t("cascoCheckDesc")
                      : checkingSlot === "fire_extinguisher"
                        ? t("extinguisherCheckDesc")
                        : t("taxCheckDesc")}
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <Label htmlFor="check-date-misc">{t("expiryDateLabel")}</Label>
                  <Input
                    id="check-date-misc"
                    type="date"
                    value={checkDueDateInput}
                    onChange={(e) => setCheckDueDateInput(e.target.value)}
                    className="font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {t("quickAddLabel")}:
                    </span>
                    {checkingSlot === "vehicle_tax" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 font-mono text-[11px]"
                          onClick={() => {
                            const y = new Date().getFullYear();
                            setCheckDueDateInput(`${y}-06-30`);
                          }}
                        >
                          30 юни (-5%)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 font-mono text-[11px]"
                          onClick={() => {
                            const y = new Date().getFullYear();
                            setCheckDueDateInput(`${y}-10-31`);
                          }}
                        >
                          31 октомври (краен)
                        </Button>
                      </>
                    ) : (
                      <>
                        {checkingSlot === "casco" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 font-mono text-[11px]"
                            onClick={() =>
                              setCheckDueDateInput(
                                addMonthsIso(checkDueDateInput, 3)
                              )
                            }
                          >
                            +3 мес.
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 font-mono text-[11px]"
                          onClick={() =>
                            setCheckDueDateInput(
                              addMonthsIso(checkDueDateInput, 12)
                            )
                          }
                        >
                          +1 година
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="check-notes-misc">{t("notesLabel")}</Label>
                  <Input
                    id="check-notes-misc"
                    value={checkNotesInput}
                    onChange={(e) => setCheckNotesInput(e.target.value)}
                    placeholder={t("notesPlaceholder")}
                    maxLength={240}
                  />
                </div>
              </div>
            ) : null}

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

          <DialogFooter className="pt-3 sticky bottom-0 bg-popover/95 backdrop-blur-md border-t border-border/40 pb-1 mt-2 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCheckModalOpen(false)}
              className="w-full sm:w-auto min-h-10"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="gradient"
              disabled={saving || checkingLoading || !checkDueDateInput}
              onClick={() => void handleApplyCheckResult()}
              className="w-full sm:w-auto min-h-10 font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (checkingSlot === "vignette" && bgtollResult?.found) ||
                (checkingSlot === "technical_inspection" && rtaResult?.found) ? (
                <>
                  <Check className="h-4 w-4" />
                  {t("addVignetteBtn")}
                </>
              ) : (
                t("applyDateBtn")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

