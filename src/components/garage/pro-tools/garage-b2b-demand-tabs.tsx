"use client";

import {
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Send,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  computeGarageB2BFleetStatements,
  computeGarageSeasonalDemand,
} from "@/lib/subscriptions/pro-metrics-extended";
import { formatCurrency } from "@/lib/utils";
import type {
  AppLocale,
  Appointment,
  Customer,
  WorkOrder,
} from "@/types/domain";

interface GarageB2BFleetTabProps {
  customers: Customer[];
  workOrders: WorkOrder[];
  locale: AppLocale;
  garageName: string;
}

export function GarageB2BFleetTab({
  customers,
  workOrders,
  locale,
  garageName,
}: GarageB2BFleetTabProps) {
  const t = useTranslations("garageProTools");

  const [fleetOnly, setFleetOnly] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const accounts = useMemo(
    () => computeGarageB2BFleetStatements(customers, workOrders),
    [customers, workOrders]
  );

  const visibleAccounts = useMemo(() => {
    if (!fleetOnly) return accounts;
    const filtered = accounts.filter(
      (a) => a.plates.length >= 2 || a.ordersCount >= 2
    );
    return filtered.length > 0 ? filtered : accounts;
  }, [accounts, fleetOnly]);

  const handleDownloadStatementCsv = (row: (typeof accounts)[number]) => {
    const custOrders = workOrders.filter(
      (wo) => wo.customerId === row.customer.id
    );
    const header = [
      "WorkOrderID",
      "Date",
      "Plate",
      "Vehicle",
      "Status",
      "Labor",
      "Parts",
      "Total",
      "Currency",
    ].join(",");
    const lines = custOrders.map((wo) =>
      [
        wo.id,
        (wo.completedAt ?? wo.createdAt).slice(0, 10),
        `"${wo.plateNumber}"`,
        `"${wo.vehicleLabel.replace(/"/g, '""')}"`,
        wo.status,
        wo.totalLaborAmount,
        wo.totalPartsAmount,
        wo.totalAmount,
        wo.currency,
      ].join(",")
    );
    const csv = `\uFEFF${header}\n${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `b2b-statement-${row.customer.fullName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyStatement = async (row: (typeof accounts)[number]) => {
    const txt = [
      `${garageName} — B2B Fleet Statement: ${row.customer.fullName}`,
      `Vehicles (${row.plates.length}): ${row.plates.join(", ")}`,
      `Completed Spend: €${row.completedSpendEur.toFixed(2)} | Open WIP: €${row.openOrdersEur.toFixed(2)}`,
      `Total Orders: ${row.ordersCount}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedId(row.customer.id);
      toast.success(t("b2bCopiedToast"));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(t("winbackError"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("b2bTitle")}
            </CardTitle>
            <CardDescription>{t("b2bDesc")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">{t("b2bFleetOnlyLabel")}</Label>
            <Switch checked={fleetOnly} onCheckedChange={setFleetOnly} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("b2bEmpty")}</p>
        ) : (
          visibleAccounts.map((row) => (
            <div
              key={row.customer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {row.customer.fullName}
                  </span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {row.plates.length} {t("b2bVehiclesUnit")}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {row.ordersCount} {t("b2bOrdersUnit")}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {row.plates.map((plate) => (
                    <Badge
                      key={plate}
                      variant="outline"
                      className="text-[11px] font-mono"
                    >
                      {plate}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs font-mono text-muted-foreground">
                  {t("b2bSpendMeta", {
                    completed: formatCurrency(row.completedSpendEur, locale, "EUR"),
                    open: formatCurrency(row.openOrdersEur, locale, "EUR"),
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyStatement(row)}
                >
                  {copiedId === row.customer.id ? (
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("b2bCopyBtn")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownloadStatementCsv(row)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t("b2bExportCsvBtn")}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface GarageSeasonalDemandTabProps {
  workOrders: WorkOrder[];
  appointments: Appointment[];
  customers: Customer[];
  quotaRemaining: number;
  locale: AppLocale;
  onQuotaUsed: () => void;
}

export function GarageSeasonalDemandTab({
  workOrders,
  appointments,
  customers,
  quotaRemaining,
  locale,
  onQuotaUsed,
}: GarageSeasonalDemandTabProps) {
  const t = useTranslations("garageProTools");

  const [promoCustomerId, setPromoCustomerId] = useState<string>(
    customers[0]?.id ?? ""
  );
  const [promoMessage, setPromoMessage] = useState<string>("");
  const [sendingPromo, setSendingPromo] = useState(false);
  const [sentCustomers, setSentCustomers] = useState<Record<string, boolean>>(
    {}
  );

  const months = useMemo(
    () => computeGarageSeasonalDemand(workOrders, appointments),
    [appointments, workOrders]
  );

  const maxVolume = Math.max(
    1,
    ...months.map((m) => m.workOrdersCount + m.appointmentsCount)
  );

  const handleSendSeasonalPromo = async () => {
    if (!promoCustomerId) return;
    setSendingPromo(true);
    try {
      const res = await fetch("/api/garage/pro-tools/winback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: promoCustomerId,
          campaignType: "seasonal_promo",
          customMessage: promoMessage.trim() || undefined,
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
      setSentCustomers((prev) => ({ ...prev, [promoCustomerId]: true }));
      onQuotaUsed();
      toast.success(t("demandPromoSentToast"));
    } finally {
      setSendingPromo(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("demandTitle")}
          </CardTitle>
          <CardDescription>{t("demandDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {months.map((m) => {
              const vol = m.workOrdersCount + m.appointmentsCount;
              const pct = Math.round((vol / maxVolume) * 100);
              return (
                <div
                  key={m.monthIndex}
                  className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {String(m.monthIndex).padStart(2, "0")}
                    </span>
                    <Badge
                      variant={
                        m.demandLevel === "peak"
                          ? "success"
                          : m.demandLevel === "slow"
                            ? "warning"
                            : "secondary"
                      }
                      className="text-[11px]"
                    >
                      {t(`demandLevel_${m.demandLevel}`)}
                    </Badge>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">
                    {m.workOrdersCount} WO • {m.appointmentsCount} AP
                  </p>
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {formatCurrency(m.revenueEur, locale, "EUR")}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("demandCampaignTitle")}</CardTitle>
          <CardDescription>{t("demandCampaignDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("b2bEmpty")}</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("demandSelectCustomerLabel")}</Label>
                  <Select
                    value={promoCustomerId}
                    onValueChange={setPromoCustomerId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.slice(0, 40).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.fullName} ({c.plateNumbers[0] ?? c.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    disabled={
                      sendingPromo ||
                      !promoCustomerId ||
                      Boolean(sentCustomers[promoCustomerId]) ||
                      quotaRemaining <= 0
                    }
                    onClick={handleSendSeasonalPromo}
                  >
                    {sentCustomers[promoCustomerId] ? (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                        {t("sentBadge")}
                      </>
                    ) : (
                      <>
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {t("demandSendPromoBtn")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("demandPromoCopyLabel")}</Label>
                <Textarea
                  rows={2}
                  value={promoMessage}
                  onChange={(e) => setPromoMessage(e.target.value)}
                  placeholder={t("demandPromoPlaceholder")}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

