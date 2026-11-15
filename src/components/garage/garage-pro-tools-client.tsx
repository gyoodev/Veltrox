"use client";

import {
  AlertTriangle,
  Building2,
  Calculator,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock,
  Coins,
  Crown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileWarning,
  Gauge,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  GarageB2BFleetTab,
  GarageSeasonalDemandTab,
} from "@/components/garage/pro-tools/garage-b2b-demand-tabs";
import {
  GarageComebackRadarTab,
  GarageDviMobileTab,
} from "@/components/garage/pro-tools/garage-comeback-dvi-tabs";
import {
  GarageStalledQuotesTab,
  GarageTechLeaderboardTab,
} from "@/components/garage/pro-tools/garage-quotes-techs-tabs";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  computeGarageBayCapacityAndTurnaround,
  computeGarageCustomerSegments,
  computeGarageProfitAnalysis,
  computeGarageReorderList,
  computeGarageTyreHotelOpportunities,
  type GarageTyreOpportunityRow,
} from "@/lib/subscriptions/pro-metrics";
import { formatCurrency } from "@/lib/utils";
import type {
  AppLocale,
  Appointment,
  Customer,
  Garage,
  GarageStaff,
  InventoryPart,
  PlatformSettingsConfig,
  TyreSet,
  WorkOrder,
  WorkOrderItem,
} from "@/types/domain";

interface GarageProToolsClientProps {
  garage: Garage;
  ownerName: string;
  isPro: boolean;
  initialWorkOrders: WorkOrder[];
  workOrderItems: WorkOrderItem[];
  initialParts: InventoryPart[];
  customers: Customer[];
  appointments: Appointment[];
  tyreSets: TyreSet[];
  staff: GarageStaff[];
  initialQuota: {
    used: number;
    quota: number;
    remaining: number;
  };
  settings: PlatformSettingsConfig;
  initialTab?: string;
}

const VALID_GARAGE_PRO_TABS = [
  "profit",
  "bays",
  "quotes",
  "techs",
  "reorder",
  "tyres",
  "b2b",
  "demand",
  "comebacks",
  "dvi",
  "winback",
  "exports",
] as const;
type GarageProTab = (typeof VALID_GARAGE_PRO_TABS)[number];

export function GarageProToolsClient({
  garage,
  ownerName,
  isPro,
  initialWorkOrders,
  workOrderItems,
  initialParts,
  customers,
  appointments,
  tyreSets,
  staff,
  initialQuota,
  settings,
  initialTab,
}: GarageProToolsClientProps) {
  const t = useTranslations("garageProTools");
  const locale = useLocale() as AppLocale;

  const resolvedInitialTab: GarageProTab = VALID_GARAGE_PRO_TABS.includes(
    initialTab as GarageProTab
  )
    ? (initialTab as GarageProTab)
    : "profit";

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [parts, setParts] = useState<InventoryPart[]>(initialParts);
  const [quota, setQuota] = useState(initialQuota);

  // Quote Margin Calculator state
  const [wholesaleCost, setWholesaleCost] = useState<number>(120);
  const [partsMarkupPct, setPartsMarkupPct] = useState<number>(35);
  const [laborHours, setLaborHours] = useState<number>(2.5);
  const [hourlyRate, setHourlyRate] = useState<number>(45);
  const [includeVat, setIncludeVat] = useState<boolean>(true);

  // Inventory Reorder state
  const [stockMultiplier, setStockMultiplier] = useState<number>(2);
  const [restockingPartId, setRestockingPartId] = useState<string | null>(null);

  // Win-back Campaign state
  const [segmentFilter, setSegmentFilter] = useState<"all" | "vip" | "at_risk">(
    "all"
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [campaignType, setCampaignType] = useState<
    "seasonal_check" | "annual_service" | "tyre_swap" | "custom"
  >("seasonal_check");
  const [customMessage, setCustomMessage] = useState("");
  const [sendingCustomerId, setSendingCustomerId] = useState<string | null>(
    null
  );
  const [sentCustomerIds, setSentCustomerIds] = useState<
    Record<string, boolean>
  >({});

  // Bay Capacity & Turnaround simulator state
  const [simHoursPerDay, setSimHoursPerDay] = useState<number>(8);
  const [simWorkingDays, setSimWorkingDays] = useState<number>(22);
  const [simTargetUtilPct, setSimTargetUtilPct] = useState<number>(75);
  const [simBayHourlyRate, setSimBayHourlyRate] = useState<number>(45);

  // Tyre Hotel Upsell & Changeover state
  const [swapFeeEur, setSwapFeeEur] = useState<number>(40);
  const [newSetUpsellProfitEur, setNewSetUpsellProfitEur] =
    useState<number>(95);
  const [sendingTyreId, setSendingTyreId] = useState<string | null>(null);
  const [sentTyreIds, setSentTyreIds] = useState<Record<string, boolean>>({});

  const profitAnalysis = useMemo(
    () => computeGarageProfitAnalysis(workOrders, workOrderItems, parts),
    [parts, workOrderItems, workOrders]
  );

  const reorderRows = useMemo(
    () => computeGarageReorderList(parts, stockMultiplier),
    [parts, stockMultiplier]
  );

  const totalReorderCostEur = useMemo(
    () =>
      reorderRows.reduce((acc, row) => acc + row.estimatedCostEur, 0),
    [reorderRows]
  );

  const customerSegments = useMemo(
    () => computeGarageCustomerSegments(customers, workOrders),
    [customers, workOrders]
  );

  const vipAndRiskCounts = useMemo(() => {
    let vip = 0;
    let atRisk = 0;
    for (const c of customerSegments) {
      if (c.segment === "vip") vip += 1;
      if (c.segment === "at_risk") atRisk += 1;
    }
    return { vip, atRisk };
  }, [customerSegments]);

  const filteredCustomerSegments = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return customerSegments.filter((row) => {
      if (segmentFilter !== "all" && row.segment !== segmentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.customer.fullName.toLowerCase().includes(q) ||
        row.customer.phone.toLowerCase().includes(q) ||
        row.latestPlate.toLowerCase().includes(q)
      );
    });
  }, [customerQuery, customerSegments, segmentFilter]);

  const bayCapacity = useMemo(
    () =>
      computeGarageBayCapacityAndTurnaround(
        garage,
        workOrders,
        appointments,
        staff
      ),
    [appointments, garage, staff, workOrders]
  );

  const tyreHotelSummary = useMemo(
    () => computeGarageTyreHotelOpportunities(tyreSets),
    [tyreSets]
  );

  if (!isPro) {
    return (
      <ProFeatureGate
        target="garage"
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
        upgradeHref="/garage/subscription"
        monthlyPriceEur={settings.proPlanPriceEur}
        subscriptionsEnabled={settings.garageSubscriptionsEnabled}
        previewStats={[
          { label: t("kpiGrossProfit"), value: formatCurrency(profitAnalysis.grossProfitEur, locale, "EUR") },
          { label: t("kpiReorderAlerts"), value: String(reorderRows.length) },
          { label: t("kpiVipAndRisk"), value: `${vipAndRiskCounts.vip} / ${vipAndRiskCounts.atRisk}` },
        ]}
      />
    );
  }

  // Bay Capacity Revenue Simulation
  const monthlyAvailableBayHours =
    bayCapacity.concurrentBays *
    Math.max(1, simHoursPerDay) *
    Math.max(1, simWorkingDays);
  const projectedBillableBayHours = Math.round(
    monthlyAvailableBayHours *
      (Math.min(100, Math.max(10, simTargetUtilPct)) / 100)
  );
  const projectedMonthlyBayRevenueEur =
    projectedBillableBayHours * Math.max(0, simBayHourlyRate);

  // Tyre Hotel Seasonal Pipeline Simulation
  const swapPipelineEur =
    tyreHotelSummary.storedSetsCount * Math.max(0, swapFeeEur);
  const replacementUpsellEur =
    tyreHotelSummary.lowTreadUpsellsCount * Math.max(0, newSetUpsellProfitEur);
  const totalTyrePipelineEur = swapPipelineEur + replacementUpsellEur;

  const handleSendTyreOutreach = async (
    row: GarageTyreOpportunityRow,
    outreachType: "tyre_swap" | "tyre_replacement"
  ) => {
    setSendingTyreId(row.tyreSet.id);
    try {
      const res = await fetch("/api/garage/pro-tools/winback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tyreSetId: row.tyreSet.id,
          campaignType: outreachType,
          plateNumber: row.tyreSet.plateNumber || undefined,
          vehicleLabel:
            row.tyreSet.brandModel || row.tyreSet.sizeSpec || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          err.error === "QUOTA_EXCEEDED"
            ? t("quotaExceededError")
            : t("winbackError")
        );
        return;
      }
      setSentTyreIds((prev) => ({ ...prev, [row.tyreSet.id]: true }));
      setQuota((q) => ({
        ...q,
        used: q.used + 1,
        remaining: Math.max(0, q.remaining - 1),
      }));
      toast.success(
        t("tyreOutreachSentToast", {
          plate: row.tyreSet.plateNumber,
        })
      );
    } finally {
      setSendingTyreId(null);
    }
  };

  // Quote calculator computed metrics
  const partsSellNet =
    Math.max(0, wholesaleCost) * (1 + Math.max(0, partsMarkupPct) / 100);
  const laborNet = Math.max(0, laborHours) * Math.max(0, hourlyRate);
  const quoteNet = partsSellNet + laborNet;
  const quoteVat = includeVat ? quoteNet * 0.2 : 0;
  const quoteGrossTotal = quoteNet + quoteVat;
  const quoteNetProfit = partsSellNet - Math.max(0, wholesaleCost) + laborNet;
  const quoteEffectiveMarginPct =
    quoteNet > 0 ? Math.round((quoteNetProfit / quoteNet) * 100) : 0;

  const handleQuickRestock = async (
    row: (typeof reorderRows)[number]
  ) => {
    setRestockingPartId(row.part.id);
    try {
      const res = await fetch(`/api/garage/inventory/${row.part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockDelta: row.reorderQty }),
      });
      if (!res.ok) {
        toast.error(t("restockError"));
        return;
      }
      const data = (await res.json()) as { part?: InventoryPart };
      setParts((prev) =>
        prev.map((p) =>
          p.id === row.part.id
            ? data.part ?? {
                ...p,
                stockQty: p.stockQty + row.reorderQty,
              }
            : p
        )
      );
      toast.success(
        t("restockSuccess", {
          qty: row.reorderQty,
          name: row.part.name,
        })
      );
    } finally {
      setRestockingPartId(null);
    }
  };

  const handleSendWinback = async (
    row: (typeof customerSegments)[number]
  ) => {
    if (campaignType === "custom" && !customMessage.trim()) {
      toast.error(t("customMsgRequired"));
      return;
    }

    setSendingCustomerId(row.customer.id);
    try {
      const res = await fetch("/api/garage/pro-tools/winback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: row.customer.id,
          campaignType,
          customMessage:
            campaignType === "custom" ? customMessage.trim() : undefined,
          plateNumber: row.latestPlate || undefined,
          vehicleLabel: row.latestVehicleLabel || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          err.error === "QUOTA_EXCEEDED"
            ? t("quotaExceededError")
            : t("winbackError")
        );
        return;
      }
      setSentCustomerIds((prev) => ({ ...prev, [row.customer.id]: true }));
      setQuota((q) => ({
        ...q,
        used: q.used + 1,
        remaining: Math.max(0, q.remaining - 1),
      }));
      toast.success(t("winbackSentToast", { name: row.customer.fullName }));
    } finally {
      setSendingCustomerId(null);
    }
  };

  const handleDownloadCsv = (type: string) => {
    const params = new URLSearchParams({ type });
    if (type === "reorder-po") {
      params.set("multiplier", String(stockMultiplier));
    }
    window.location.href = `/api/garage/export?${params.toString()}`;
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
              GARAGE PRO
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle", { garage: garage.name })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs py-1 px-2.5">
            {t("quotaBadge", { used: quota.used, quota: quota.quota })}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/garage/subscription">{t("managePlanBtn")}</Link>
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiGrossProfit")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
            {formatCurrency(profitAnalysis.grossProfitEur, locale, "EUR")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            {t("kpiAvgProfitPerOrder", {
              amount: formatCurrency(
                profitAnalysis.averageProfitPerOrderEur,
                locale,
                "EUR"
              ),
            })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiGrossMargin")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-primary">
            {profitAnalysis.grossMarginPct}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            COGS: {formatCurrency(profitAnalysis.totalPartsCostEur, locale, "EUR")}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiReorderAlerts")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-orange-400">
            {reorderRows.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            Est. PO: {formatCurrency(totalReorderCostEur, locale, "EUR")}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("kpiVipAndRisk")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {vipAndRiskCounts.vip} VIP / {vipAndRiskCounts.atRisk}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("kpiVipSublabel")}
          </p>
        </Card>
      </div>

      <Tabs defaultValue={resolvedInitialTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="profit" className="gap-1.5">
            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabProfit")}
          </TabsTrigger>
          <TabsTrigger value="bays" className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabBays")}
          </TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1.5">
            <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabQuotes")}
          </TabsTrigger>
          <TabsTrigger value="techs" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabTechs")}
          </TabsTrigger>
          <TabsTrigger value="reorder" className="gap-1.5">
            <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabReorder")}
          </TabsTrigger>
          <TabsTrigger value="tyres" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabTyres")}
          </TabsTrigger>
          <TabsTrigger value="b2b" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabB2b")}
          </TabsTrigger>
          <TabsTrigger value="demand" className="gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabDemand")}
          </TabsTrigger>
          <TabsTrigger value="comebacks" className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabComebacks")}
          </TabsTrigger>
          <TabsTrigger value="dvi" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabDvi")}
          </TabsTrigger>
          <TabsTrigger value="winback" className="gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabWinback")}
          </TabsTrigger>
          <TabsTrigger value="exports" className="gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            {t("tabExports")}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Gross Margin Engine & Quote Profitability Simulator */}
        <TabsContent value="profit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
                {t("quoteSimTitle")}
              </CardTitle>
              <CardDescription>{t("quoteSimSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label htmlFor="wo-parts-cost">{t("simWholesaleCost")}</Label>
                  <Input
                    id="wo-parts-cost"
                    type="number"
                    min={0}
                    step={5}
                    value={wholesaleCost}
                    onChange={(e) =>
                      setWholesaleCost(Math.max(0, Number(e.target.value)))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wo-parts-markup">{t("simMarkupPct")}</Label>
                  <Input
                    id="wo-parts-markup"
                    type="number"
                    min={0}
                    max={300}
                    step={5}
                    value={partsMarkupPct}
                    onChange={(e) =>
                      setPartsMarkupPct(Math.max(0, Number(e.target.value)))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wo-labor-hours">{t("simLaborHours")}</Label>
                  <Input
                    id="wo-labor-hours"
                    type="number"
                    min={0}
                    max={200}
                    step={0.5}
                    value={laborHours}
                    onChange={(e) =>
                      setLaborHours(Math.max(0, Number(e.target.value)))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wo-hourly-rate">{t("simHourlyRate")}</Label>
                  <Input
                    id="wo-hourly-rate"
                    type="number"
                    min={0}
                    max={500}
                    step={5}
                    value={hourlyRate}
                    onChange={(e) =>
                      setHourlyRate(Math.max(0, Number(e.target.value)))
                    }
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                    <Switch
                      checked={includeVat}
                      onCheckedChange={setIncludeVat}
                    />
                    {t("simVatToggle")}
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("simCustomerNet")}</p>
                  <p className="font-mono text-lg font-bold text-foreground">
                    €{quoteNet.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("simCustomerGross")}</p>
                  <p className="font-mono text-lg font-bold text-primary">
                    €{quoteGrossTotal.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("simShopProfit")}</p>
                  <p className="font-mono text-lg font-bold text-emerald-400">
                    €{quoteNetProfit.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("simEffectiveMargin")}</p>
                  <p className="font-mono text-lg font-bold text-emerald-400">
                    {quoteEffectiveMarginPct}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t("orderProfitLedgerTitle")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("orderProfitLedgerDesc")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDownloadCsv("profit-ledger")}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("exportLedgerBtn")}
              </Button>
            </div>

            {profitAnalysis.rows.length === 0 ? (
              <EmptyState
                icon={Coins}
                title={t("emptyProfitTitle")}
                description={t("emptyProfitDesc")}
              />
            ) : (
              <div className="space-y-2">
                {profitAnalysis.rows.slice(0, 20).map((row) => (
                  <div
                    key={row.order.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-border/70 bg-secondary/25 p-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {row.order.plateNumber}
                        </span>
                        <span className="truncate font-medium text-sm text-foreground">
                          {row.order.vehicleLabel}
                        </span>
                        {row.hasMissingPartCost ? (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                            {t("missingCostFlag")}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.order.customerName ?? "—"} •{" "}
                        {row.order.createdAt.slice(0, 10)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
                      <div className="text-right">
                        <p className="text-muted-foreground">{t("colRevenue")}</p>
                        <p className="font-mono font-semibold text-foreground">
                          €{row.revenueEur.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">{t("colCogs")}</p>
                        <p className="font-mono font-semibold text-muted-foreground">
                          €{row.partsCostEur.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">{t("colProfit")}</p>
                        <p className="font-mono font-bold text-emerald-400">
                          €{row.grossProfitEur.toFixed(2)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          row.grossMarginPct >= 45
                            ? "success"
                            : row.grossMarginPct >= 20
                              ? "warning"
                              : "destructive"
                        }
                        className="font-mono"
                      >
                        {row.grossMarginPct}%
                      </Badge>
                      <Button asChild size="icon" variant="ghost">
                        <Link
                          href={`/garage/work-orders/${row.order.id}`}
                          aria-label={t("openOrderAria")}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: Smart Inventory Reorder & Purchase Order Generator */}
        <TabsContent value="reorder" className="space-y-4">
          <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <Label>{t("bufferMultiplierLabel")}</Label>
                <Select
                  value={String(stockMultiplier)}
                  onValueChange={(v) => setStockMultiplier(Number(v))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.5">1.5x {t("minBufferUnit")}</SelectItem>
                    <SelectItem value="2">2x {t("minBufferUnit")}</SelectItem>
                    <SelectItem value="3">3x {t("minBufferUnit")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("totalPoEstimate")}</p>
                <p className="font-mono text-xl font-bold text-primary">
                  {formatCurrency(totalReorderCostEur, locale, "EUR")}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownloadCsv("reorder-po")}
              disabled={reorderRows.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("exportPoCsvBtn")}
            </Button>
          </Card>

          {reorderRows.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title={t("allStockHealthyTitle")}
              description={t("allStockHealthyDesc")}
            />
          ) : (
            <div className="space-y-3">
              {reorderRows.map((row) => (
                <Card
                  key={row.part.id}
                  className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-primary font-semibold">
                        {row.part.sku}
                      </span>
                      <span className="font-semibold text-foreground">
                        {row.part.name}
                      </span>
                      <Badge
                        variant={row.isCritical ? "destructive" : "warning"}
                        className="text-[10px]"
                      >
                        {row.isCritical ? t("criticalStock") : t("lowStock")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.part.supplierName ?? t("noSupplierSet")} •{" "}
                      {t("stockRatioLabel", {
                        current: row.part.stockQty,
                        min: row.part.minStockAlert,
                        unit: row.part.unit ?? "pcs",
                      })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">
                        {t("suggestedQtyLabel")}
                      </p>
                      <p className="font-mono font-bold text-foreground">
                        +{row.reorderQty} {row.part.unit ?? "pcs"} (
                        €{row.estimatedCostEur.toFixed(2)})
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={restockingPartId === row.part.id}
                      onClick={() => void handleQuickRestock(row)}
                      className="gap-1.5"
                    >
                      <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("receiveStockBtn", { qty: row.reorderQty })}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: VIP Customer LTV & Churn Win-Back Engine */}
        <TabsContent value="winback" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder={t("searchCustomerPlaceholder")}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "vip", "at_risk"] as const).map((seg) => (
                  <Button
                    key={seg}
                    type="button"
                    size="sm"
                    variant={segmentFilter === seg ? "default" : "outline"}
                    onClick={() => setSegmentFilter(seg)}
                  >
                    {t(`segment_${seg}`)}
                  </Button>
                ))}
              </div>

              <Select
                value={campaignType}
                onValueChange={(v) =>
                  setCampaignType(
                    v as
                      | "seasonal_check"
                      | "annual_service"
                      | "tyre_swap"
                      | "custom"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seasonal_check">
                    {t("campaignSeasonal")}
                  </SelectItem>
                  <SelectItem value="annual_service">
                    {t("campaignAnnual")}
                  </SelectItem>
                  <SelectItem value="tyre_swap">
                    {t("campaignTyreSwap")}
                  </SelectItem>
                  <SelectItem value="custom">
                    {t("campaignCustom")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {campaignType === "custom" ? (
              <Textarea
                rows={2}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t("customMsgPlaceholder")}
              />
            ) : null}
          </Card>

          {filteredCustomerSegments.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t("emptyCustomersTitle")}
              description={t("emptyCustomersDesc")}
            />
          ) : (
            <div className="space-y-3">
              {filteredCustomerSegments.map((row) => {
                const isSent = Boolean(sentCustomerIds[row.customer.id]);
                return (
                  <Card
                    key={row.customer.id}
                    className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {row.customer.fullName}
                        </span>
                        <Badge
                          variant={
                            row.segment === "vip"
                              ? "warning"
                              : row.segment === "at_risk"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {t(`segmentBadge_${row.segment}`)}
                        </Badge>
                        {row.latestPlate ? (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {row.latestPlate}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        LTV: €{row.totalSpendEur.toFixed(2)} • {row.visitsCount}{" "}
                        {t("visitsUnit")} • {t("avgTicketShort")}: €
                        {row.avgTicketEur.toFixed(2)}
                        {row.daysInactive !== null
                          ? ` • ${t("inactiveDays", { days: row.daysInactive })}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSent ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          {t("winbackSentBadge")}
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={sendingCustomerId === row.customer.id}
                          onClick={() => void handleSendWinback(row)}
                          className="gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("sendWinbackBtn")}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 4: Pro Financial & Accounting Export Center */}
        <TabsContent value="exports" className="grid gap-4 md:grid-cols-2">
          {[
            {
              type: "profit-ledger",
              title: t("exportProfitTitle"),
              desc: t("exportProfitDesc"),
              proOnly: true,
            },
            {
              type: "reorder-po",
              title: t("exportReorderTitle"),
              desc: t("exportReorderDesc"),
              proOnly: true,
            },
            {
              type: "vip-customers",
              title: t("exportVipTitle"),
              desc: t("exportVipDesc"),
              proOnly: true,
            },
            {
              type: "work-orders",
              title: t("exportOrdersTitle"),
              desc: t("exportOrdersDesc"),
              proOnly: false,
            },
          ].map((item) => (
            <Card key={item.type} className="p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  {item.proOnly ? (
                    <Badge
                      variant="warning"
                      className="text-[10px] border-amber-500/40 bg-amber-500/15 text-amber-300"
                    >
                      PRO
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Button
                type="button"
                variant={item.proOnly ? "default" : "outline"}
                onClick={() => handleDownloadCsv(item.type)}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("downloadCsvBtn")}
              </Button>
            </Card>
          ))}
        </TabsContent>

        {/* TAB: Bay Capacity & Turnaround Analyzer */}
        <TabsContent value="bays" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("baysConcurrentLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {bayCapacity.concurrentBays}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("baysActiveStaffLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {bayCapacity.activeStaffCount}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("baysAvgTurnaroundLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-primary">
                {bayCapacity.avgTurnaroundHours !== null
                  ? `${bayCapacity.avgTurnaroundHours} ${t("hoursShort")}`
                  : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("baysLiveLoadLabel")}</p>
              <p
                className={`mt-1 font-mono text-2xl font-bold ${
                  bayCapacity.currentBayUtilizationPct >= 85
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {bayCapacity.currentBayUtilizationPct}%
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 7-Day Appointment Load Forecast */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t("baysScheduleTitle")}
                </CardTitle>
                <CardDescription>{t("baysScheduleDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bayCapacity.dailySchedule.map((day) => (
                  <div key={day.dateIso} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-foreground">
                        {day.dateIso}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {day.bookedCount} / {day.capacitySlots} {t("baysSlotsUnit")} ({day.loadPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          day.loadPct >= 85
                            ? "bg-red-500"
                            : day.loadPct >= 60
                              ? "bg-amber-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${day.loadPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Bay Revenue Potential Simulator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  {t("baysRevenueSimTitle")}
                </CardTitle>
                <CardDescription>{t("baysRevenueSimDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("baysHoursPerDayLabel")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={simHoursPerDay}
                      onChange={(e) =>
                        setSimHoursPerDay(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("baysWorkingDaysLabel")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={simWorkingDays}
                      onChange={(e) =>
                        setSimWorkingDays(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("baysTargetUtilLabel")}</Label>
                    <Input
                      type="number"
                      min={10}
                      max={100}
                      value={simTargetUtilPct}
                      onChange={(e) =>
                        setSimTargetUtilPct(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("baysHourlyRateLabel")}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={simBayHourlyRate}
                      onChange={(e) =>
                        setSimBayHourlyRate(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-border/60 bg-background/50 p-3.5">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("baysAvailableHoursLabel")}</p>
                    <p className="font-mono text-lg font-bold text-foreground">
                      {monthlyAvailableBayHours} {t("hoursShort")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("baysBillableHoursLabel")}</p>
                    <p className="font-mono text-lg font-bold text-primary">
                      {projectedBillableBayHours} {t("hoursShort")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("baysProjectedRevLabel")}</p>
                    <p className="font-mono text-lg font-bold text-emerald-400">
                      {formatCurrency(projectedMonthlyBayRevenueEur, locale, "EUR")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: Tyre Hotel Upsell & Changeover Engine */}
        <TabsContent value="tyres" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("tyresStoredSetsLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {tyreHotelSummary.storedSetsCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                {tyreHotelSummary.totalTyresCount} {t("tyresUnitLabel")}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("tyresLowTreadLabel")}</p>
              <p
                className={`mt-1 font-mono text-2xl font-bold ${
                  tyreHotelSummary.lowTreadUpsellsCount > 0
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {tyreHotelSummary.lowTreadUpsellsCount}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("tyresSwapPipelineLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-primary">
                {formatCurrency(swapPipelineEur, locale, "EUR")}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("tyresTotalPipelineLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
                {formatCurrency(totalTyrePipelineEur, locale, "EUR")}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t("tyresEngineTitle")}
                  </CardTitle>
                  <CardDescription>{t("tyresEngineDesc")}</CardDescription>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">{t("tyresSwapFeeLabel")}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={swapFeeEur}
                      onChange={(e) =>
                        setSwapFeeEur(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    <Label className="text-xs">{t("tyresUpsellMarginLabel")}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      value={newSetUpsellProfitEur}
                      onChange={(e) =>
                        setNewSetUpsellProfitEur(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tyreHotelSummary.opportunities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {t("tyresEmptyTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("tyresEmptyDesc")}
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href="/garage/tyres">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {t("tyresOpenHotelBtn")}
                    </Link>
                  </Button>
                </div>
              ) : (
                tyreHotelSummary.opportunities.map((row) => {
                  const sent = Boolean(sentTyreIds[row.tyreSet.id]);
                  const sending = sendingTyreId === row.tyreSet.id;
                  const campaignMode = row.isLowTread
                    ? "tyre_replacement"
                    : "tyre_swap";
                  return (
                    <div
                      key={row.tyreSet.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3.5"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {row.tyreSet.plateNumber}
                          </span>
                          <span className="text-sm text-foreground">
                            {row.tyreSet.customerName}
                          </span>
                          <Badge variant="outline" className="text-[11px] font-mono">
                            {row.tyreSet.sizeSpec} ({row.tyreSet.season})
                          </Badge>
                          {row.isLowTread ? (
                            <Badge variant="warning" className="text-[11px]">
                              {t("tyresLowTreadBadge", {
                                mm: row.tyreSet.treadDepthMm ?? 0,
                              })}
                            </Badge>
                          ) : null}
                          {row.isDueSoon ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {t("tyresDueSoonBadge")}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("tyresLocationMeta", {
                            loc: row.tyreSet.shelfLocation,
                            qty: row.tyreSet.quantity,
                          })}
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={sent ? "outline" : row.isLowTread ? "default" : "secondary"}
                        disabled={sending || sent || quota.remaining <= 0}
                        onClick={() => handleSendTyreOutreach(row, campaignMode)}
                      >
                        {sent ? (
                          <>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                            {t("sentBadge")}
                          </>
                        ) : (
                          <>
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            {row.isLowTread
                              ? t("tyresSendReplacementBtn")
                              : t("tyresSendSwapBtn")}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Stalled Quote Recovery */}
        <TabsContent value="quotes">
          <GarageStalledQuotesTab
            workOrders={workOrders}
            quotaRemaining={quota.remaining}
            locale={locale}
            onQuotaUsed={() =>
              setQuota((q) => ({
                ...q,
                used: q.used + 1,
                remaining: Math.max(0, q.remaining - 1),
              }))
            }
          />
        </TabsContent>

        {/* TAB: Technician Leaderboard & Commissions */}
        <TabsContent value="techs">
          <GarageTechLeaderboardTab
            ownerName={ownerName}
            staff={staff}
            workOrders={workOrders}
            workOrderItems={workOrderItems}
            locale={locale}
            onWorkOrderAssigned={(woId, uid, name) =>
              setWorkOrders((prev) =>
                prev.map((w) =>
                  w.id === woId
                    ? { ...w, assignedStaffUid: uid, assignedStaffName: name }
                    : w
                )
              )
            }
          />
        </TabsContent>

        {/* TAB: Corporate / B2B Fleet Accounts */}
        <TabsContent value="b2b">
          <GarageB2BFleetTab
            customers={customers}
            workOrders={workOrders}
            locale={locale}
            garageName={garage.name}
          />
        </TabsContent>

        {/* TAB: Seasonal Demand Planner */}
        <TabsContent value="demand">
          <GarageSeasonalDemandTab
            workOrders={workOrders}
            appointments={appointments}
            customers={customers}
            quotaRemaining={quota.remaining}
            locale={locale}
            onQuotaUsed={() =>
              setQuota((q) => ({
                ...q,
                used: q.used + 1,
                remaining: Math.max(0, q.remaining - 1),
              }))
            }
          />
        </TabsContent>

        {/* TAB: Comeback & Warranty Quality Radar */}
        <TabsContent value="comebacks">
          <GarageComebackRadarTab workOrders={workOrders} locale={locale} />
        </TabsContent>

        {/* TAB: Mobile Multi-Point Inspection (DVI) */}
        <TabsContent value="dvi">
          <GarageDviMobileTab
            workOrders={workOrders}
            onDviSaved={(woId, dviChecks) =>
              setWorkOrders((prev) =>
                prev.map((w) => (w.id === woId ? { ...w, dviChecks } : w))
              )
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

