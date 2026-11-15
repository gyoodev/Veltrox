"use client";

import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileWarning,
  Send,
  Trophy,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeGarageStalledQuotes,
  computeGarageTechPerformance,
} from "@/lib/subscriptions/pro-metrics-extended";
import { formatCurrency } from "@/lib/utils";
import type {
  AppLocale,
  GarageStaff,
  WorkOrder,
  WorkOrderItem,
} from "@/types/domain";

interface GarageStalledQuotesTabProps {
  workOrders: WorkOrder[];
  quotaRemaining: number;
  locale: AppLocale;
  onQuotaUsed: () => void;
}

export function GarageStalledQuotesTab({
  workOrders,
  quotaRemaining,
  locale,
  onQuotaUsed,
}: GarageStalledQuotesTabProps) {
  const t = useTranslations("garageProTools");

  const [minHours, setMinHours] = useState<number>(24);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});

  const summary = useMemo(
    () => computeGarageStalledQuotes(workOrders, minHours),
    [minHours, workOrders]
  );

  const handleFollowup = async (wo: WorkOrder) => {
    setSendingId(wo.id);
    try {
      const res = await fetch("/api/garage/pro-tools/winback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: wo.id,
          campaignType: "quote_followup",
          plateNumber: wo.plateNumber,
          vehicleLabel: wo.vehicleLabel,
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
      setSentIds((prev) => ({ ...prev, [wo.id]: true }));
      onQuotaUsed();
      toast.success(
        t("quotesSentToast", { plate: wo.plateNumber })
      );
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("quotesStalledCountLabel")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {summary.stalledCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("quotesPendingApprovalLabel")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-400">
            {summary.pendingQuoteApprovalsCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("quotesAtRiskRevenueLabel")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-primary">
            {formatCurrency(summary.totalAtRiskEur, locale, "EUR")}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileWarning className="h-4 w-4 text-amber-400" aria-hidden="true" />
                {t("quotesTitle")}
              </CardTitle>
              <CardDescription>{t("quotesDesc")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t("quotesMinHoursLabel")}</Label>
              <Select
                value={String(minHours)}
                onValueChange={(v) => setMinHours(Number(v) || 24)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1h+</SelectItem>
                  <SelectItem value="24">24h+</SelectItem>
                  <SelectItem value="48">48h+</SelectItem>
                  <SelectItem value="72">72h+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("quotesEmpty")}</p>
          ) : (
            summary.rows.map((row) => {
              const sent = Boolean(sentIds[row.workOrder.id]);
              const sending = sendingId === row.workOrder.id;
              return (
                <div
                  key={row.workOrder.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {row.workOrder.plateNumber}
                      </span>
                      <span className="text-sm text-foreground">
                        {row.workOrder.vehicleLabel}
                      </span>
                      <Badge
                        variant={row.isQuotePending ? "warning" : "secondary"}
                        className="text-[11px]"
                      >
                        {row.isQuotePending
                          ? t("quotesBadgePendingQuote")
                          : row.workOrder.status}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {row.ageHours}h
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.workOrder.customerName || row.workOrder.customerPhone} •{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {formatCurrency(row.amountEur, locale, "EUR")}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/status/${row.workOrder.publicStatusToken}`} target="_blank">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        {t("quotesStatusLinkBtn")}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={sent ? "outline" : "secondary"}
                      disabled={sending || sent || quotaRemaining <= 0}
                      onClick={() => handleFollowup(row.workOrder)}
                    >
                      {sent ? (
                        <>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                          {t("sentBadge")}
                        </>
                      ) : (
                        <>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          {t("quotesNudgeBtn")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface GarageTechLeaderboardTabProps {
  ownerName: string;
  staff: GarageStaff[];
  workOrders: WorkOrder[];
  workOrderItems: WorkOrderItem[];
  locale: AppLocale;
  onWorkOrderAssigned: (
    woId: string,
    uid: string | null,
    name: string | null
  ) => void;
}

export function GarageTechLeaderboardTab({
  ownerName,
  staff,
  workOrders,
  workOrderItems,
  locale,
  onWorkOrderAssigned,
}: GarageTechLeaderboardTabProps) {
  const t = useTranslations("garageProTools");

  const [laborCommPct, setLaborCommPct] = useState<number>(25);
  const [partsCommPct, setPartsCommPct] = useState<number>(5);
  const [assignWoId, setAssignWoId] = useState<string>(
    () => workOrders.find((w) => w.status !== "completed")?.id ?? workOrders[0]?.id ?? ""
  );
  const [assignUid, setAssignUid] = useState<string>(staff[0]?.uid ?? "owner");
  const [savingAssign, setSavingAssign] = useState(false);

  const techRows = useMemo(
    () =>
      computeGarageTechPerformance(
        ownerName,
        staff,
        workOrders,
        workOrderItems
      ),
    [ownerName, staff, workOrderItems, workOrders]
  );

  const assignOptions = [
    { uid: "owner", name: ownerName },
    ...staff.filter((s) => s.active).map((s) => ({ uid: s.uid, name: s.displayName })),
  ];

  const handleAssignTech = async () => {
    if (!assignWoId) return;
    const picked = assignOptions.find((o) => o.uid === assignUid);
    if (!picked) return;
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/garage/work-orders/${assignWoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedStaffUid: picked.uid,
          assignedStaffName: picked.name,
        }),
      });
      if (!res.ok) {
        toast.error(t("techAssignError"));
        return;
      }
      onWorkOrderAssigned(assignWoId, picked.uid, picked.name);
      toast.success(t("techAssignSuccess", { name: picked.name }));
    } finally {
      setSavingAssign(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payroll Split Controls & Work Order Assignment */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
              {t("techCommissionTitle")}
            </CardTitle>
            <CardDescription>{t("techCommissionDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("techLaborPctLabel")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={laborCommPct}
                onChange={(e) => setLaborCommPct(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("techPartsPctLabel")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={partsCommPct}
                onChange={(e) => setPartsCommPct(Number(e.target.value) || 0)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("techAssignTitle")}
            </CardTitle>
            <CardDescription>{t("techAssignDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1 space-y-1">
              <Label className="text-xs">{t("dviSelectOrderLabel")}</Label>
              <Select value={assignWoId} onValueChange={setAssignWoId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.slice(0, 30).map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.plateNumber} — {wo.vehicleLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44 space-y-1">
              <Label className="text-xs">{t("techMemberLabel")}</Label>
              <Select value={assignUid} onValueChange={setAssignUid}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignOptions.map((o) => (
                    <SelectItem key={o.uid} value={o.uid}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={savingAssign || !assignWoId}
              onClick={handleAssignTech}
            >
              {t("techAssignBtn")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("techLeaderboardTitle")}</CardTitle>
          <CardDescription>{t("techLeaderboardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {techRows.map((row, idx) => {
            const commissionEur =
              row.laborRevenueEur * (Math.max(0, laborCommPct) / 100) +
              row.partsRevenueEur * (Math.max(0, partsCommPct) / 100);
            return (
              <div
                key={row.uid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      #{idx + 1}
                    </Badge>
                    <span className="font-semibold text-foreground">
                      {row.displayName}
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                      {row.roleLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {t("techJobsStats", {
                      done: row.completedCount,
                      active: row.activeCount,
                      avgTicket: formatCurrency(row.avgTicketEur, locale, "EUR"),
                    })}
                    {row.avgTurnaroundHours !== null
                      ? ` • ${row.avgTurnaroundHours}${t("hoursShort")}`
                      : ""}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-right text-xs">
                  <div>
                    <p className="text-muted-foreground">{t("techLaborRevLabel")}</p>
                    <p className="font-mono font-semibold text-foreground">
                      {formatCurrency(row.laborRevenueEur, locale, "EUR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("techTotalRevLabel")}</p>
                    <p className="font-mono font-semibold text-primary">
                      {formatCurrency(row.totalRevenueEur, locale, "EUR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("techPayoutLabel")}</p>
                    <p className="font-mono font-bold text-emerald-400">
                      {formatCurrency(commissionEur, locale, "EUR")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

