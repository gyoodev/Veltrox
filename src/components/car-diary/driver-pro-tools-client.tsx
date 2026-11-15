"use client";

import {
  Activity,
  AlertTriangle,
  BellPlus,
  Calculator,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Crown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Fuel,
  Gauge,
  Globe2,
  Printer,
  QrCode,
  Scale,
  ScanText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DriverFleetKeepReplaceTab,
  DriverPrePurchaseTab,
} from "@/components/car-diary/pro-tools/driver-fleet-prepurch-tabs";
import {
  DriverObdTriageTab,
  DriverOcrReceiptTab,
} from "@/components/car-diary/pro-tools/driver-obd-ocr-tabs";
import {
  DriverCrossBorderTab,
  DriverServicePassTab,
} from "@/components/car-diary/pro-tools/driver-pass-border-tabs";
import { ProFeatureGate } from "@/components/shared/pro-feature-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BulgariaFuelItem } from "@/lib/fuel-prices";
import {
  computeDriverBudgetForecast,
  computeDriverPortfolioSummaries,
  type MissingComplianceGap,
} from "@/lib/subscriptions/pro-metrics";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type {
  AppLocale,
  DiaryEntry,
  Garage,
  PlatformSettingsConfig,
  Reminder,
  ReminderType,
  Vehicle,
  VehicleDocument,
} from "@/types/domain";

const BGN_PER_EUR = 1.95583;

interface DriverProToolsClientProps {
  isPro: boolean;
  vehicles: Vehicle[];
  initialEntries: DiaryEntry[];
  documents: VehicleDocument[];
  initialReminders: Reminder[];
  fuelPrices: BulgariaFuelItem[];
  approvedGarages: Garage[];
  userName: string;
  userPhone: string;
  settings: PlatformSettingsConfig;
  initialTab?: string;
}

const VALID_DRIVER_PRO_TABS = [
  "tco",
  "fuel",
  "fleet",
  "forecaster",
  "budget",
  "prepurch",
  "pass",
  "crossborder",
  "obd",
  "ocr",
  "resale",
  "export",
] as const;
type DriverProTab = (typeof VALID_DRIVER_PRO_TABS)[number];

interface ForecastIntervalTemplate {
  key: string;
  intervalKm: number;
  intervalMonths: number;
  reminderType: ReminderType;
  matchedCategories: string[];
  keywords: string[];
}

const FORECAST_INTERVALS: ForecastIntervalTemplate[] = [
  {
    key: "oilService",
    intervalKm: 10_000,
    intervalMonths: 12,
    reminderType: "oil_change",
    matchedCategories: ["service"],
    keywords: ["oil", "масл", "филт", "filter"],
  },
  {
    key: "brakeFluid",
    intervalKm: 30_000,
    intervalMonths: 24,
    reminderType: "custom_service",
    matchedCategories: ["service", "repair"],
    keywords: ["brake", "спирач", "течност", "наклад"],
  },
  {
    key: "tyreAlignment",
    intervalKm: 12_000,
    intervalMonths: 6,
    reminderType: "seasonal_tyres",
    matchedCategories: ["tyres"],
    keywords: ["tyre", "tire", "гуми", "баланс", "реглаж"],
  },
  {
    key: "majorTiming",
    intervalKm: 60_000,
    intervalMonths: 48,
    reminderType: "custom_service",
    matchedCategories: ["service", "repair"],
    keywords: ["timing", "ремък", "вериг", "ангренаж", "обслужване"],
  },
];

function getDefaultFuelPriceEur(
  fuelType: Vehicle["fuelType"],
  fuelPrices: BulgariaFuelItem[]
): number {
  const byCode = new Map(fuelPrices.map((f) => [f.code, f.priceEur]));
  if (fuelType === "diesel") return byCode.get("diesel") ?? 1.29;
  if (fuelType === "lpg") return byCode.get("lpg") ?? 0.64;
  if (fuelType === "electric") return 0.16;
  return byCode.get("gasoline") ?? 1.28;
}

function addDaysIso(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function DriverProToolsClient({
  isPro,
  vehicles,
  initialEntries,
  documents,
  initialReminders,
  fuelPrices,
  approvedGarages,
  userName,
  userPhone,
  settings,
  initialTab,
}: DriverProToolsClientProps) {
  const t = useTranslations("driverProTools");
  const tCat = useTranslations("carDiary.categories");
  const locale = useLocale() as AppLocale;

  const resolvedInitialTab: DriverProTab = VALID_DRIVER_PRO_TABS.includes(
    initialTab as DriverProTab
  )
    ? (initialTab as DriverProTab)
    : "tco";

  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);

  const firstVehicle = vehicles[0] ?? null;

  // Trip & Fuel Simulator state
  const [simVehicleId, setSimVehicleId] = useState<string>(
    firstVehicle?.id ?? ""
  );
  const [distanceKm, setDistanceKm] = useState<number>(320);
  const [consumptionPer100, setConsumptionPer100] = useState<number>(7.2);
  const [unitPriceEur, setUnitPriceEur] = useState<number>(() =>
    firstVehicle
      ? getDefaultFuelPriceEur(firstVehicle.fuelType, fuelPrices)
      : 1.28
  );
  const [tollsEur, setTollsEur] = useState<number>(0);
  const [savingTrip, setSavingTrip] = useState(false);

  // Maintenance Forecaster state
  const [forecastVehicleId, setForecastVehicleId] = useState<string>(
    firstVehicle?.id ?? ""
  );
  const [monthlyKm, setMonthlyKm] = useState<number>(1200);
  const [creatingForecastKey, setCreatingForecastKey] = useState<string | null>(
    null
  );
  const [createdForecastKeys, setCreatedForecastKeys] = useState<
    Record<string, boolean>
  >({});

  // Resale Dossier & Export state
  const [resaleVehicleId, setResaleVehicleId] = useState<string>(
    firstVehicle?.id ?? ""
  );
  const [copiedVehicleId, setCopiedVehicleId] = useState<string | null>(null);
  const [exportVehicleId, setExportVehicleId] = useState<string>("all");

  // Fuel Economy & LPG/Hybrid Payback state
  const [fuelAnnualKm, setFuelAnnualKm] = useState<number>(15000);
  const [fuelCurrentConsumption, setFuelCurrentConsumption] =
    useState<number>(7.8);
  const [fuelTargetType, setFuelTargetType] = useState<
    "lpg" | "diesel" | "electric" | "hybrid"
  >("lpg");
  const [fuelTargetConsumption, setFuelTargetConsumption] =
    useState<number>(9.2);
  const [fuelUpgradeCostEur, setFuelUpgradeCostEur] = useState<number>(850);
  const [quickFuelVehicleId, setQuickFuelVehicleId] = useState<string>(
    firstVehicle?.id ?? ""
  );
  const [quickFuelCostEur, setQuickFuelCostEur] = useState<number>(50);
  const [savingQuickFuel, setSavingQuickFuel] = useState(false);

  // 12-Month Budget & Compliance state
  const [creatingComplianceKey, setCreatingComplianceKey] = useState<
    string | null
  >(null);
  const [createdComplianceKeys, setCreatedComplianceKeys] = useState<
    Record<string, boolean>
  >({});

  const portfolioSummaries = useMemo(
    () =>
      computeDriverPortfolioSummaries(
        vehicles,
        entries,
        documents,
        reminders
      ),
    [vehicles, entries, documents, reminders]
  );

  const portfolioTotals = useMemo(() => {
    const totalSpend = portfolioSummaries.reduce(
      (acc, s) => acc + s.totalSpendEur,
      0
    );
    const withCostPerKm = portfolioSummaries.filter(
      (s) => s.costPerKmEur !== null
    );
    const avgCostPerKm =
      withCostPerKm.length > 0
        ? withCostPerKm.reduce((acc, s) => acc + (s.costPerKmEur ?? 0), 0) /
          withCostPerKm.length
        : null;
    const avgReadiness =
      portfolioSummaries.length > 0
        ? Math.round(
            portfolioSummaries.reduce((acc, s) => acc + s.readinessScore, 0) /
              portfolioSummaries.length
          )
        : 0;
    const activeRemindersTotal = portfolioSummaries.reduce(
      (acc, s) => acc + s.activeRemindersCount,
      0
    );

    return {
      totalSpend,
      avgCostPerKm,
      avgReadiness,
      activeRemindersTotal,
    };
  }, [portfolioSummaries]);

  const forecastSummary =
    portfolioSummaries.find((s) => s.vehicle.id === forecastVehicleId) ??
    portfolioSummaries[0] ??
    null;

  const forecastRows = useMemo(() => {
    if (!forecastSummary) return [];
    const veh = forecastSummary.vehicle;
    const carEntries = entries.filter((e) => e.vehicleId === veh.id);
    const safeMonthlyKm = Math.max(100, monthlyKm);

    return FORECAST_INTERVALS.map((tpl) => {
      const matchingEntry = carEntries.find((e) => {
        if (!tpl.matchedCategories.includes(e.category)) return false;
        const lower = `${e.title} ${e.notes ?? ""}`.toLowerCase();
        return (
          tpl.keywords.some((kw) => lower.includes(kw)) ||
          (tpl.key === "oilService" && e.category === "service") ||
          (tpl.key === "tyreAlignment" && e.category === "tyres")
        );
      });

      const lastServiceKm = matchingEntry?.mileageKm ?? veh.currentMileageKm;
      const targetDueKm = lastServiceKm + tpl.intervalKm;
      const kmRemaining = targetDueKm - veh.currentMileageKm;
      const daysUntilKmDue = Math.max(
        7,
        Math.round((kmRemaining / safeMonthlyKm) * 30.4375)
      );
      const predictedDate = addDaysIso(daysUntilKmDue);

      const alreadyScheduled = reminders.some(
        (r) =>
          r.vehicleId === veh.id &&
          r.status !== "completed" &&
          r.status !== "cancelled" &&
          (r.type === tpl.reminderType ||
            r.title.toLowerCase().includes(t(`forecast_${tpl.key}`).toLowerCase().slice(0, 8)))
      );

      return {
        ...tpl,
        label: t(`forecast_${tpl.key}`),
        lastServiceKm,
        lastServiceDate: matchingEntry?.date ?? null,
        targetDueKm,
        kmRemaining,
        predictedDate,
        alreadyScheduled:
          alreadyScheduled || Boolean(createdForecastKeys[`${veh.id}:${tpl.key}`]),
      };
    });
  }, [createdForecastKeys, entries, forecastSummary, monthlyKm, reminders, t]);

  const budgetForecast = useMemo(
    () => computeDriverBudgetForecast(vehicles, documents, reminders),
    [vehicles, documents, reminders]
  );

  const fuelAnalytics = useMemo(
    () =>
      portfolioSummaries.map((summary) => {
        const fuelEntries = entries.filter(
          (e) => e.vehicleId === summary.vehicle.id && e.category === "fuel"
        );
        const totalFuelSpendEur = fuelEntries.reduce(
          (acc, e) =>
            acc + (e.currency === "BGN" ? e.costAmount / BGN_PER_EUR : e.costAmount),
          0
        );
        const avgPerRefuelEur =
          fuelEntries.length > 0 ? totalFuelSpendEur / fuelEntries.length : 0;
        const costPer100KmEur =
          summary.trackedKm > 200
            ? (totalFuelSpendEur / summary.trackedKm) * 100
            : null;
        return {
          vehicle: summary.vehicle,
          refuelsCount: fuelEntries.length,
          totalFuelSpendEur,
          avgPerRefuelEur,
          costPer100KmEur,
          fuelSharePct:
            summary.totalSpendEur > 0
              ? Math.round((totalFuelSpendEur / summary.totalSpendEur) * 100)
              : 0,
        };
      }),
    [entries, portfolioSummaries]
  );

  if (!isPro) {
    return (
      <ProFeatureGate
        target="user"
        title={t("gateTitle")}
        subtitle={t("gateSubtitle")}
        features={[
          t("gateFeature1"),
          t("gateFeature2"),
          t("gateFeature3"),
          t("gateFeature4"),
          t("gateFeature5"),
          t("gateFeature6"),
          t("gateFeature7"),
          t("gateFeature8"),
          t("gateFeature9"),
          t("gateFeature10"),
          t("gateFeature11"),
          t("gateFeature12"),
        ]}
        upgradeHref="/app/subscription"
        monthlyPriceEur={settings.userProPlanPriceEur}
        subscriptionsEnabled={settings.userSubscriptionsEnabled}
        previewStats={[
          { label: t("kpiVehiclesReady"), value: String(vehicles.length) },
          { label: t("kpiEntriesTracked"), value: String(entries.length) },
          { label: t("kpiPortfolioSpend"), value: formatCurrency(portfolioTotals.totalSpend, locale, "EUR") },
        ]}
      />
    );
  }

  const byFuelCode = new Map(fuelPrices.map((f) => [f.code, f.priceEur]));
  const baselinePetrolEur = byFuelCode.get("gasoline") ?? 1.28;
  const targetFuelUnitPriceEur =
    fuelTargetType === "lpg"
      ? (byFuelCode.get("lpg") ?? 0.64)
      : fuelTargetType === "diesel"
        ? (byFuelCode.get("diesel") ?? 1.29)
        : fuelTargetType === "electric"
          ? 0.16
          : baselinePetrolEur;

  const safeFuelAnnualKm = Math.max(0, fuelAnnualKm);
  const annualBaselineFuelEur =
    (safeFuelAnnualKm / 100) * Math.max(0, fuelCurrentConsumption) * baselinePetrolEur;
  const annualTargetFuelEur =
    (safeFuelAnnualKm / 100) * Math.max(0, fuelTargetConsumption) * targetFuelUnitPriceEur;
  const annualFuelSavingsEur = annualBaselineFuelEur - annualTargetFuelEur;
  const monthlyFuelSavingsEur = annualFuelSavingsEur / 12;
  const fuelPaybackMonths =
    annualFuelSavingsEur > 0 && fuelUpgradeCostEur > 0
      ? Math.ceil((fuelUpgradeCostEur / annualFuelSavingsEur) * 12)
      : annualFuelSavingsEur > 0
        ? 0
        : null;
  const threeYearNetFuelSavingsEur =
    annualFuelSavingsEur * 3 - Math.max(0, fuelUpgradeCostEur);

  const handleSaveQuickFuel = async () => {
    const targetVehicle =
      vehicles.find((v) => v.id === quickFuelVehicleId) ?? firstVehicle;
    if (!targetVehicle || quickFuelCostEur <= 0) {
      toast.error(t("tripValidationError"));
      return;
    }

    setSavingQuickFuel(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: targetVehicle.id,
          category: "fuel" as const,
          title: t("quickFuelEntryTitle", { plate: targetVehicle.plateNumber }),
          date: todayIso,
          mileageKm: targetVehicle.currentMileageKm,
          costAmount: Number(quickFuelCostEur.toFixed(2)),
          currency: "EUR" as const,
          notes: t("quickFuelNotes"),
        }),
      });
      if (!res.ok) {
        toast.error(t("tripSaveError"));
        return;
      }
      const data = (await res.json()) as { entry?: DiaryEntry };
      if (data.entry) {
        setEntries((prev) => [data.entry as DiaryEntry, ...prev]);
      }
      toast.success(t("quickFuelSavedToast"));
    } finally {
      setSavingQuickFuel(false);
    }
  };

  const handleScheduleMissingCompliance = async (gap: MissingComplianceGap) => {
    const stateKey = `${gap.vehicleId}:${gap.kind}`;
    setCreatingComplianceKey(stateKey);
    try {
      const title =
        gap.kind === "technical_inspection"
          ? t("complianceKindInspection")
          : gap.kind === "vignette"
            ? t("complianceKindVignette")
            : t("complianceKindLiability");
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: gap.vehicleId,
          type: gap.kind,
          title: `${title} — ${gap.plateNumber}`,
          dueDate: addDaysIso(30),
          dueMileageKm: null,
          notes: t("complianceReminderNote"),
          channels: ["email"],
        }),
      });
      if (!res.ok) {
        toast.error(t("forecastCreateError"));
        return;
      }
      const data = (await res.json()) as { reminder?: Reminder };
      if (data.reminder) {
        setReminders((prev) => [data.reminder as Reminder, ...prev]);
      }
      setCreatedComplianceKeys((prev) => ({ ...prev, [stateKey]: true }));
      toast.success(t("complianceReminderToast"));
    } finally {
      setCreatingComplianceKey(null);
    }
  };

  const simVehicle = vehicles.find((v) => v.id === simVehicleId) ?? firstVehicle;
  const fuelNeeded = Math.max(0, (distanceKm / 100) * consumptionPer100);
  const fuelCostEur = fuelNeeded * Math.max(0, unitPriceEur);
  const tripTotalEur = fuelCostEur + Math.max(0, tollsEur);
  const tripCostPerKm = distanceKm > 0 ? tripTotalEur / distanceKm : 0;

  const handleSelectSimVehicle = (nextId: string) => {
    setSimVehicleId(nextId);
    const found = vehicles.find((v) => v.id === nextId);
    if (found) {
      setUnitPriceEur(getDefaultFuelPriceEur(found.fuelType, fuelPrices));
    }
  };

  const handleSaveTripToDiary = async () => {
    if (!simVehicle || distanceKm <= 0) {
      toast.error(t("tripValidationError"));
      return;
    }

    setSavingTrip(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const nextMileage = Math.max(
        0,
        Math.round(simVehicle.currentMileageKm + distanceKm)
      );
      const roundedCost = Number(tripTotalEur.toFixed(2));
      const payload = {
        vehicleId: simVehicle.id,
        category: "fuel" as const,
        title: t("tripEntryTitle", { km: Math.round(distanceKm) }),
        date: todayIso,
        mileageKm: nextMileage,
        costAmount: roundedCost,
        currency: "EUR" as const,
        notes: `${fuelNeeded.toFixed(1)} ${simVehicle.fuelType === "electric" ? "kWh" : "L"} @ €${unitPriceEur.toFixed(2)} (${consumptionPer100.toFixed(1)}/100km)${tollsEur > 0 ? ` + €${tollsEur.toFixed(2)} tolls` : ""}`,
      };

      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error(t("tripSaveError"));
        return;
      }

      const data = (await res.json()) as { entry?: DiaryEntry };
      if (data.entry) {
        setEntries((prev) => [data.entry as DiaryEntry, ...prev]);
      }
      toast.success(t("tripSavedToast"));
    } finally {
      setSavingTrip(false);
    }
  };

  const handleScheduleForecastReminder = async (
    row: (typeof forecastRows)[number]
  ) => {
    if (!forecastSummary) return;
    const stateKey = `${forecastSummary.vehicle.id}:${row.key}`;
    setCreatingForecastKey(row.key);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: forecastSummary.vehicle.id,
          type: row.reminderType,
          title: row.label,
          dueDate: row.predictedDate,
          dueMileageKm: Math.max(1, row.targetDueKm),
          notes: t("forecastAutoNote", { monthlyKm }),
          channels: ["email"],
        }),
      });
      if (!res.ok) {
        toast.error(t("forecastReminderError"));
        return;
      }
      const data = (await res.json()) as { reminder?: Reminder };
      if (data.reminder) {
        setReminders((prev) => [data.reminder as Reminder, ...prev]);
      }
      setCreatedForecastKeys((prev) => ({ ...prev, [stateKey]: true }));
      toast.success(t("forecastReminderCreated"));
    } finally {
      setCreatingForecastKey(null);
    }
  };

  const resaleSummary =
    portfolioSummaries.find((s) => s.vehicle.id === resaleVehicleId) ??
    portfolioSummaries[0] ??
    null;

  const buildBuyerDossierText = (
    s: (typeof portfolioSummaries)[number]
  ): string => {
    const recentLogs = entries
      .filter((e) => e.vehicleId === s.vehicle.id && e.category !== "fuel")
      .slice(0, 4)
      .map((e) => `• ${e.date} (${formatNumber(e.mileageKm)} km): ${e.title}`);

    return [
      `=== ${s.vehicle.make} ${s.vehicle.model} (${s.vehicle.year}) ===`,
      `${t("dossierMileage")}: ${formatNumber(s.vehicle.currentMileageKm)} km | ${s.vehicle.fuelType.toUpperCase()}`,
      s.vehicle.vin ? `VIN: ${s.vehicle.vin}` : null,
      `${t("dossierScore")}: ${s.readinessScore}%`,
      `${t("dossierEntries")}: ${s.entriesCount} (${t("dossierVerified", { count: s.verifiedGarageEntries })})`,
      `${t("dossierDocs")}: ${s.documentsCount}`,
      recentLogs.length > 0 ? `\n${t("dossierRecentServices")}:\n${recentLogs.join("\n")}` : null,
      `\n${t("dossierFooter")}`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleCopyDossier = async () => {
    if (!resaleSummary) return;
    try {
      await navigator.clipboard.writeText(buildBuyerDossierText(resaleSummary));
      setCopiedVehicleId(resaleSummary.vehicle.id);
      toast.success(t("dossierCopiedToast"));
      setTimeout(() => setCopiedVehicleId(null), 2200);
    } catch {
      toast.error(t("dossierCopyError"));
    }
  };

  const handleCsvDownload = (type: "expenses" | "vehicles") => {
    const params = new URLSearchParams({ type });
    if (type === "expenses" && exportVehicleId !== "all") {
      params.set("vehicleId", exportVehicleId);
    }
    window.location.href = `/api/diary/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
              <Sparkles className="h-7 w-7 text-amber-400" aria-hidden="true" />
              {t("pageTitle")}
            </h1>
            <Badge
              variant="warning"
              className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-300"
            >
              <Crown className="h-3 w-3" aria-hidden="true" />
              DRIVER PRO
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/app/subscription">{t("managePlanBtn")}</Link>
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiPortfolioSpend")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(portfolioTotals.totalSpend, locale, "EUR")}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiAvgCostPerKm")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-primary">
            {portfolioTotals.avgCostPerKm !== null
              ? `€${portfolioTotals.avgCostPerKm.toFixed(3)}/km`
              : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiAvgReadiness")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
            {portfolioTotals.avgReadiness}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiActiveReminders")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {portfolioTotals.activeRemindersTotal}
          </p>
        </Card>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title={t("noVehiclesTitle")}
          description={t("noVehiclesDesc")}
          action={
            <Button asChild>
              <Link href="/app/cars">{t("addVehicleCta")}</Link>
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue={resolvedInitialTab} className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="tco" className="gap-1.5">
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabTco")}
            </TabsTrigger>
            <TabsTrigger value="fuel" className="gap-1.5">
              <Fuel className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabFuel")}
            </TabsTrigger>
            <TabsTrigger value="fleet" className="gap-1.5">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabFleet")}
            </TabsTrigger>
            <TabsTrigger value="forecaster" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabForecaster")}
            </TabsTrigger>
            <TabsTrigger value="budget" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabBudget")}
            </TabsTrigger>
            <TabsTrigger value="prepurch" className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabPrePurch")}
            </TabsTrigger>
            <TabsTrigger value="pass" className="gap-1.5">
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabPass")}
            </TabsTrigger>
            <TabsTrigger value="crossborder" className="gap-1.5">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabCrossBorder")}
            </TabsTrigger>
            <TabsTrigger value="obd" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabObd")}
            </TabsTrigger>
            <TabsTrigger value="ocr" className="gap-1.5">
              <ScanText className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabOcr")}
            </TabsTrigger>
            <TabsTrigger value="resale" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabResale")}
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              {t("tabExport")}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TCO & Trip Fuel Calculator */}
          <TabsContent value="tco" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {portfolioSummaries.map((s) => (
                <Card key={s.vehicle.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {s.vehicle.make} {s.vehicle.model} ({s.vehicle.year})
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {s.vehicle.plateNumber} •{" "}
                        {formatNumber(s.vehicle.currentMileageKm)} km
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {s.costPerKmEur !== null
                        ? `€${s.costPerKmEur.toFixed(3)}/km`
                        : t("insufficientKm")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t("tcoTotal")}</p>
                      <p className="mt-0.5 font-mono font-semibold text-foreground">
                        {formatCurrency(s.totalSpendEur, locale, "EUR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("tcoMaintenance")}</p>
                      <p className="mt-0.5 font-mono font-semibold text-foreground">
                        {formatCurrency(s.maintenanceSpendEur, locale, "EUR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("tcoFuel")}</p>
                      <p className="mt-0.5 font-mono font-semibold text-foreground">
                        {formatCurrency(s.fuelSpendEur, locale, "EUR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t("tcoMonthlyBurn")}:{" "}
                      <strong className="font-mono text-foreground">
                        {formatCurrency(s.monthlyBurnEur, locale, "EUR")}/mo
                      </strong>
                    </span>
                    <span>
                      {t("tcoProjectedYear")}:{" "}
                      <strong className="font-mono text-primary">
                        {formatCurrency(s.monthlyBurnEur * 12, locale, "EUR")}
                      </strong>
                    </span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Live Trip & Refuel Cost Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-primary" aria-hidden="true" />
                  {t("tripCalcTitle")}
                </CardTitle>
                <CardDescription>{t("tripCalcSubtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label>{t("selectVehicleLabel")}</Label>
                    <Select
                      value={simVehicle?.id ?? ""}
                      onValueChange={handleSelectSimVehicle}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.make} {v.model} ({v.plateNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="trip-distance">{t("tripDistanceLabel")}</Label>
                    <Input
                      id="trip-distance"
                      type="number"
                      min={1}
                      max={20000}
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(Math.max(0, Number(e.target.value)))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="trip-consumption">{t("tripConsumptionLabel")}</Label>
                    <Input
                      id="trip-consumption"
                      type="number"
                      step={0.1}
                      min={0.5}
                      max={60}
                      value={consumptionPer100}
                      onChange={(e) =>
                        setConsumptionPer100(Math.max(0, Number(e.target.value)))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="trip-price">{t("tripPriceLabel")}</Label>
                    <Input
                      id="trip-price"
                      type="number"
                      step={0.01}
                      min={0.01}
                      max={20}
                      value={unitPriceEur}
                      onChange={(e) =>
                        setUnitPriceEur(Math.max(0, Number(e.target.value)))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="trip-tolls">{t("tripTollsLabel")}</Label>
                    <Input
                      id="trip-tolls"
                      type="number"
                      step={0.5}
                      min={0}
                      max={2000}
                      value={tollsEur}
                      onChange={(e) =>
                        setTollsEur(Math.max(0, Number(e.target.value)))
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tripFuelVolume")}</p>
                      <p className="font-mono text-lg font-bold text-foreground">
                        {fuelNeeded.toFixed(1)}{" "}
                        {simVehicle?.fuelType === "electric" ? "kWh" : "L"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tripFuelCost")}</p>
                      <p className="font-mono text-lg font-bold text-foreground">
                        €{fuelCostEur.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tripTotalCost")}</p>
                      <p className="font-mono text-lg font-bold text-primary">
                        €{tripTotalEur.toFixed(2)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({(tripTotalEur * BGN_PER_EUR).toFixed(2)} лв.)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tripCostPerKm")}</p>
                      <p className="font-mono text-lg font-bold text-emerald-400">
                        €{tripCostPerKm.toFixed(3)}/km
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={savingTrip || !simVehicle || distanceKm <= 0}
                    onClick={() => void handleSaveTripToDiary()}
                    className="gap-2"
                  >
                    <TrendingUp className="h-4 w-4" aria-hidden="true" />
                    {savingTrip ? t("savingTrip") : t("saveTripToDiaryBtn")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Smart Maintenance Interval Forecaster */}
          <TabsContent value="forecaster" className="space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[220px] flex-1 space-y-1.5">
                  <Label>{t("selectVehicleLabel")}</Label>
                  <Select
                    value={forecastSummary?.vehicle.id ?? ""}
                    onValueChange={setForecastVehicleId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.make} {v.model} ({v.plateNumber}) —{" "}
                          {formatNumber(v.currentMileageKm)} km
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-56 space-y-1.5">
                  <Label htmlFor="monthly-km-input">{t("monthlyKmLabel")}</Label>
                  <Input
                    id="monthly-km-input"
                    type="number"
                    min={100}
                    max={15000}
                    step={100}
                    value={monthlyKm}
                    onChange={(e) =>
                      setMonthlyKm(Math.max(100, Number(e.target.value)))
                    }
                  />
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {forecastRows.map((row) => (
                <Card key={row.key} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.lastServiceDate
                          ? t("lastLoggedDate", {
                              date: row.lastServiceDate,
                              km: formatNumber(row.lastServiceKm),
                            })
                          : t("noPriorLogFallback", {
                              km: formatNumber(row.lastServiceKm),
                            })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        row.kmRemaining <= 1500 ? "warning" : "secondary"
                      }
                      className="font-mono"
                    >
                      +{formatNumber(row.kmRemaining)} km
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t("predictedTargetKm")}</p>
                      <p className="mt-0.5 font-mono font-semibold text-foreground">
                        {formatNumber(row.targetDueKm)} km
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("predictedDueDate")}</p>
                      <p className="mt-0.5 font-mono font-semibold text-primary">
                        {row.predictedDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    {row.alreadyScheduled ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        {t("reminderScheduledTag")}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={creatingForecastKey === row.key}
                        onClick={() => void handleScheduleForecastReminder(row)}
                        className="gap-1.5"
                      >
                        <BellPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("scheduleReminderBtn")}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: Resale Readiness & Shareable Buyer Dossier */}
          <TabsContent value="resale" className="space-y-4">
            {resaleSummary ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t("selectVehicleLabel")}</Label>
                    <Select
                      value={resaleSummary.vehicle.id}
                      onValueChange={setResaleVehicleId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.make} {v.model} ({v.plateNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
                        {t("dossierScore")}
                      </span>
                      <span className="font-mono text-2xl font-bold text-emerald-400">
                        {resaleSummary.readinessScore}%
                      </span>
                    </div>
                    <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${resaleSummary.readinessScore}%` }}
                      />
                    </div>
                  </div>

                  <ul className="space-y-2 text-sm">
                    {[
                      {
                        ok: resaleSummary.checks.hasVin,
                        label: t("checkVin"),
                      },
                      {
                        ok: resaleSummary.checks.hasServiceHistory,
                        label: t("checkHistory"),
                      },
                      {
                        ok: resaleSummary.checks.hasDocuments,
                        label: t("checkDocs"),
                      },
                      {
                        ok: resaleSummary.checks.complianceClean,
                        label: t("checkCompliance"),
                      },
                    ].map((item) => (
                      <li
                        key={item.label}
                        className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2"
                      >
                        <span>{item.label}</span>
                        <Badge variant={item.ok ? "success" : "warning"}>
                          {item.ok ? "OK" : t("needsAttention")}
                        </Badge>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link
                        href={`/app/cars/${resaleSummary.vehicle.id}/service-book`}
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("openServiceBookBtn")}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/cars/${resaleSummary.vehicle.id}`}>
                        {t("openVehicleDetailBtn")}
                      </Link>
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                        {t("buyerDossierTitle")}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {t("buyerDossierSubtitle")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleCopyDossier()}
                      className="gap-1.5"
                    >
                      {copiedVehicleId === resaleSummary.vehicle.id ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("copiedBtn")}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("copyDossierBtn")}
                        </>
                      )}
                    </Button>
                  </div>

                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-secondary/50 p-4 font-mono text-xs leading-relaxed text-foreground">
                    {buildBuyerDossierText(resaleSummary)}
                  </pre>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* TAB 4: Accounting & Portfolio CSV Export */}
          <TabsContent value="export" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t("exportExpensesTitle")}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("exportExpensesDesc")}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("filterVehicleExport")}</Label>
                  <Select
                    value={exportVehicleId}
                    onValueChange={setExportVehicleId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allVehiclesOption")}</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.make} {v.model} ({v.plateNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  onClick={() => handleCsvDownload("expenses")}
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t("downloadExpensesCsvBtn")}
                </Button>
              </Card>

              <Card className="p-5 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Car className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    {t("exportPortfolioTitle")}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("exportPortfolioDesc")}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("portfolioRowsHint", {
                      vehicles: vehicles.length,
                      entries: entries.length,
                    })}{" "}
                    ({tCat("service")}, {tCat("fuel")}, {tCat("repair")})
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCsvDownload("vehicles")}
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t("downloadPortfolioCsvBtn")}
                </Button>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: Fuel Economy & LPG/Hybrid Payback */}
          <TabsContent value="fuel" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Fuel className="h-4 w-4 text-primary" aria-hidden="true" />
                      {t("fuelLiveTitle")}
                    </CardTitle>
                    <CardDescription>{t("fuelLiveDesc")}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fuelPrices.slice(0, 4).map((fp) => (
                      <Badge
                        key={fp.code}
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {fp.code.toUpperCase()}: €{fp.priceEur.toFixed(2)}/L
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {fuelAnalytics.map((row) => (
                    <div
                      key={row.vehicle.id}
                      className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {row.vehicle.make} {row.vehicle.model}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {row.vehicle.plateNumber}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {row.refuelsCount} {t("fuelRefuelsLabel")}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                        <div>
                          <p className="text-muted-foreground">{t("fuelTotalSpend")}</p>
                          <p className="font-mono font-semibold text-foreground">
                            {formatCurrency(row.totalFuelSpendEur, locale, "EUR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("fuelAvgRefuel")}</p>
                          <p className="font-mono font-semibold text-foreground">
                            {formatCurrency(row.avgPerRefuelEur, locale, "EUR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("fuelPer100Km")}</p>
                          <p className="font-mono font-semibold text-primary">
                            {row.costPer100KmEur !== null
                              ? `${formatCurrency(row.costPer100KmEur, locale, "EUR")}`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Fuel Log */}
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-background/50 p-3.5">
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label className="text-xs">{t("quickFuelVehicleLabel")}</Label>
                    <Select
                      value={quickFuelVehicleId}
                      onValueChange={setQuickFuelVehicleId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.make} {v.model} ({v.plateNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36 space-y-1">
                    <Label className="text-xs">{t("quickFuelCostLabel")}</Label>
                    <Input
                      type="number"
                      min={1}
                      step="1"
                      value={quickFuelCostEur}
                      onChange={(e) =>
                        setQuickFuelCostEur(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingQuickFuel}
                    onClick={handleSaveQuickFuel}
                  >
                    <Fuel className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {t("quickFuelSaveBtn")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* LPG / Hybrid Payback Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  {t("fuelPaybackTitle")}
                </CardTitle>
                <CardDescription>{t("fuelPaybackDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label>{t("fuelAnnualKmLabel")}</Label>
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      value={fuelAnnualKm}
                      onChange={(e) =>
                        setFuelAnnualKm(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fuelCurrentConsLabel")}</Label>
                    <Input
                      type="number"
                      min={1}
                      step="0.2"
                      value={fuelCurrentConsumption}
                      onChange={(e) =>
                        setFuelCurrentConsumption(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fuelTargetTypeLabel")}</Label>
                    <Select
                      value={fuelTargetType}
                      onValueChange={(val) =>
                        setFuelTargetType(
                          val as "lpg" | "diesel" | "electric" | "hybrid"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lpg">{t("fuelTargetLpg")}</SelectItem>
                        <SelectItem value="hybrid">{t("fuelTargetHybrid")}</SelectItem>
                        <SelectItem value="diesel">{t("fuelTargetDiesel")}</SelectItem>
                        <SelectItem value="electric">{t("fuelTargetElectric")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fuelTargetConsLabel")}</Label>
                    <Input
                      type="number"
                      min={1}
                      step="0.2"
                      value={fuelTargetConsumption}
                      onChange={(e) =>
                        setFuelTargetConsumption(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fuelUpgradeCostLabel")}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={50}
                      value={fuelUpgradeCostEur}
                      onChange={(e) =>
                        setFuelUpgradeCostEur(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-border/60 bg-background/50 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("fuelAnnualSavingsLabel")}</p>
                    <p
                      className={`font-mono text-xl font-bold ${
                        annualFuelSavingsEur >= 0
                          ? "text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {formatCurrency(annualFuelSavingsEur, locale, "EUR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("fuelMonthlySavingsLabel")}</p>
                    <p className="font-mono text-xl font-bold text-foreground">
                      {formatCurrency(monthlyFuelSavingsEur, locale, "EUR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("fuelPaybackMonthsLabel")}</p>
                    <p className="font-mono text-xl font-bold text-primary">
                      {fuelPaybackMonths !== null
                        ? `${fuelPaybackMonths} ${t("monthsShort")}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("fuelThreeYearNetLabel")}</p>
                    <p className="font-mono text-xl font-bold text-emerald-400">
                      {formatCurrency(threeYearNetFuelSavingsEur, locale, "EUR")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: 12-Month Ownership Budget & Renewal Calendar */}
          <TabsContent value="budget" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("budgetTotalYearLabel")}</p>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {formatCurrency(
                    budgetForecast.totalAnnualRenewalsEur,
                    locale,
                    "EUR"
                  )}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("budgetMonthlyReserveLabel")}</p>
                <p className="mt-1 font-mono text-2xl font-bold text-primary">
                  {formatCurrency(
                    budgetForecast.recommendedMonthlyReserveEur,
                    locale,
                    "EUR"
                  )}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("budgetMissingGapsLabel")}</p>
                <p
                  className={`mt-1 font-mono text-2xl font-bold ${
                    budgetForecast.missingCompliance.length > 0
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {budgetForecast.missingCompliance.length}
                </p>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* Compliance Gaps */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    {t("budgetComplianceTitle")}
                  </CardTitle>
                  <CardDescription>{t("budgetComplianceDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {budgetForecast.missingCompliance.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{t("budgetComplianceAllGood")}</span>
                    </div>
                  ) : (
                    budgetForecast.missingCompliance.map((gap) => {
                      const stateKey = `${gap.vehicleId}:${gap.kind}`;
                      const created = Boolean(createdComplianceKeys[stateKey]);
                      const busy = creatingComplianceKey === stateKey;
                      const kindLabel =
                        gap.kind === "technical_inspection"
                          ? t("complianceKindInspection")
                          : gap.kind === "vignette"
                            ? t("complianceKindVignette")
                            : t("complianceKindLiability");
                      return (
                        <div
                          key={stateKey}
                          className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {gap.vehicleLabel}
                              </p>
                              <p className="text-xs font-mono text-muted-foreground">
                                {gap.plateNumber}
                              </p>
                            </div>
                            <Badge variant="warning" className="text-xs">
                              {kindLabel}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={created ? "outline" : "secondary"}
                            className="w-full"
                            disabled={busy || created}
                            onClick={() => handleScheduleMissingCompliance(gap)}
                          >
                            {created ? (
                              <>
                                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                                {t("forecastCreatedBadge")}
                              </>
                            ) : (
                              <>
                                <BellPlus className="mr-1.5 h-3.5 w-3.5" />
                                {t("budgetScheduleGapBtn")}
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* 12-Month Calendar */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t("budgetCalendarTitle")}
                  </CardTitle>
                  <CardDescription>{t("budgetCalendarDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {budgetForecast.months.map((m) => (
                      <div
                        key={m.monthKey}
                        className={`rounded-lg border p-3 ${
                          m.eventsCount > 0
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/50 bg-background/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {m.monthKey}
                          </span>
                          <span className="font-mono text-sm font-bold text-primary">
                            {formatCurrency(m.estimatedEur, locale, "EUR")}
                          </span>
                        </div>
                        {m.eventsCount > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.labels.map((lbl, idx) => (
                              <Badge
                                key={`${m.monthKey}-${idx}`}
                                variant="secondary"
                                className="max-w-full truncate text-[11px]"
                              >
                                {lbl}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("budgetNoEventsMonth")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: Multi-Vehicle Fleet & Keep vs. Replace */}
          <TabsContent value="fleet">
            <DriverFleetKeepReplaceTab
              vehicles={vehicles}
              entries={entries}
              locale={locale}
            />
          </TabsContent>

          {/* TAB: Pre-Purchase Used Car Scorer */}
          <TabsContent value="prepurch">
            <DriverPrePurchaseTab locale={locale} />
          </TabsContent>

          {/* TAB: Verified QR Service Pass */}
          <TabsContent value="pass">
            <DriverServicePassTab vehicles={vehicles} />
          </TabsContent>

          {/* TAB: Cross-Border Trip Readiness */}
          <TabsContent value="crossborder">
            <DriverCrossBorderTab
              vehicles={vehicles}
              documents={documents}
              reminders={reminders}
            />
          </TabsContent>

          {/* TAB: Warning-Light & OBD Fault Triage */}
          <TabsContent value="obd">
            <DriverObdTriageTab
              vehicles={vehicles}
              approvedGarages={approvedGarages}
              userName={userName}
              userPhone={userPhone}
              locale={locale}
            />
          </TabsContent>

          {/* TAB: Receipt & Invoice Smart Importer */}
          <TabsContent value="ocr">
            <DriverOcrReceiptTab
              vehicles={vehicles}
              locale={locale}
              onEntryCreated={(entry) => setEntries((prev) => [entry, ...prev])}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

