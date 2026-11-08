"use client";

import {
  ArrowRight,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Plus,
  Search,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QuickWorkOrderDialog } from "@/components/garage/quick-work-order-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import {
  type AppLocale,
  type Customer,
  WORK_ORDER_STATUSES,
  type WorkOrder,
  type WorkOrderStatus,
} from "@/types/domain";

export const STATUS_BADGE_VARIANT: Record<
  WorkOrderStatus,
  "secondary" | "default" | "warning" | "violet" | "success"
> = {
  received: "secondary",
  diagnosing: "default",
  waiting_parts: "warning",
  in_progress: "violet",
  ready: "success",
  completed: "default",
};

interface WorkOrdersBoardClientProps {
  initialWorkOrders: WorkOrder[];
  initialCustomers: Customer[];
  isManager: boolean;
  initialPlateSearch?: string;
}

export function WorkOrdersBoardClient({
  initialWorkOrders,
  initialCustomers,
  isManager,
  initialPlateSearch = "",
}: WorkOrdersBoardClientProps) {
  const t = useTranslations("garageWorkspace.workOrders");
  const tStatuses = useTranslations("garageWorkspace.statuses");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>(initialPlateSearch);
  const [quickOpen, setQuickOpen] = useState(false);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: workOrders.length };
    for (const s of WORK_ORDER_STATUSES) map[s] = 0;
    for (const wo of workOrders) {
      map[wo.status] = (map[wo.status] ?? 0) + 1;
    }
    return map;
  }, [workOrders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const normQ = normalizeLicensePlate(query);
    return workOrders.filter((wo) => {
      if (statusFilter !== "all" && wo.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (normQ.length > 0 && wo.plateNormalized.includes(normQ)) ||
        wo.plateNumber.toLowerCase().includes(q) ||
        wo.vehicleLabel.toLowerCase().includes(q) ||
        (wo.customerName?.toLowerCase().includes(q) ?? false) ||
        (wo.customerSummary?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [workOrders, statusFilter, query]);

  const handleAdvanceStatus = async (wo: WorkOrder) => {
    const idx = WORK_ORDER_STATUSES.indexOf(wo.status);
    const nextStatus = WORK_ORDER_STATUSES[idx + 1];
    if (!nextStatus) return;

    const prev = workOrders;
    setWorkOrders((list) =>
      list.map((item) =>
        item.id === wo.id ? { ...item, status: nextStatus } : item
      )
    );

    const res = await fetch(`/api/garage/work-orders/${wo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      setWorkOrders(prev);
      toast.error("Could not update status.");
      return;
    }

    toast.success(t("savedToast"));
    router.refresh();
  };

  const copyPublicLink = async (token: string) => {
    const url = `${window.location.origin}/status/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success(t("linkCopiedToast"));
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

        <div className="flex flex-wrap items-center gap-2.5">
          {isManager ? (
            <Button asChild variant="outline" size="sm">
              <a href="/api/garage/export?type=work-orders" download>
                <Download className="h-4 w-4" />
                {t("exportCsv")}
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="gradient"
            onClick={() => setQuickOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("newOrderBtn")}
          </Button>
        </div>
      </div>

      {/* Plate Search + Status Filter Strip */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlatePlaceholder")}
            aria-label={t("searchPlatePlaceholder")}
            className="h-11 pl-10"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === "all"
                ? "border-primary bg-veltrox-gradient text-white shadow-sm"
                : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {tStatuses("all")}
            <span className="font-mono text-[11px] opacity-80">
              ({counts.all ?? 0})
            </span>
          </button>

          {WORK_ORDER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === s
                  ? "border-primary bg-veltrox-gradient text-white shadow-sm"
                  : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {tStatuses(s)}
              <span className="font-mono text-[11px] opacity-80">
                ({counts[s] ?? 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Work Orders List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Button
              type="button"
              variant="gradient"
              onClick={() => setQuickOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("newOrderBtn")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((wo) => {
            const currentIdx = WORK_ORDER_STATUSES.indexOf(wo.status);
            const nextStatus = WORK_ORDER_STATUSES[currentIdx + 1];

            return (
              <Card
                key={wo.id}
                hoverLift
                className="flex flex-col justify-between p-5"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-foreground">
                        {wo.plateNumber}
                      </span>
                      <Badge variant={STATUS_BADGE_VARIANT[wo.status]}>
                        {tStatuses(wo.status)}
                      </Badge>
                    </div>

                    <span className="font-mono text-sm font-bold text-foreground">
                      {formatCurrency(wo.totalAmount, locale, wo.currency)}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {wo.vehicleLabel}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {wo.customerName ?? "—"} • {wo.customerPhone ?? ""} •{" "}
                      {formatDate(wo.createdAt, locale)}
                    </p>
                  </div>

                  {wo.customerSummary ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {wo.customerSummary}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void copyPublicLink(wo.publicStatusToken)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t("copyPublicLink")}
                    </Button>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                      <Link
                        href={`/status/${wo.publicStatusToken}`}
                        target="_blank"
                        aria-label={t("openPublicLink")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {nextStatus ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleAdvanceStatus(wo)}
                      >
                        {tStatuses(nextStatus)}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button asChild variant="gradient" size="sm">
                      <Link href={`/garage/work-orders/${wo.id}`}>
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <QuickWorkOrderDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        customers={customers}
        recentWorkOrders={workOrders}
        onCreated={(createdWo, createdCust) => {
          setWorkOrders((prev) => [createdWo, ...prev]);
          setCustomers((prev) => {
            const exists = prev.some((c) => c.id === createdCust.id);
            return exists
              ? prev.map((c) => (c.id === createdCust.id ? createdCust : c))
              : [createdCust, ...prev];
          });
          router.push(`/garage/work-orders/${createdWo.id}`);
        }}
      />
    </div>
  );
}

