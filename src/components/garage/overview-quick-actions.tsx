"use client";

import { ExternalLink, Search, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { QuickWorkOrderDialog } from "@/components/garage/quick-work-order-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer, WorkOrder } from "@/types/domain";

interface OverviewQuickActionsProps {
  garageSlug: string;
  customers: Customer[];
  recentWorkOrders: WorkOrder[];
}

export function OverviewQuickActions({
  garageSlug,
  customers,
  recentWorkOrders,
}: OverviewQuickActionsProps) {
  const t = useTranslations("garageWorkspace.overview");
  const router = useRouter();

  const [plateQuery, setPlateQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);

  const handlePlateSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = plateQuery.trim();
    if (!q) return;
    router.push(`/garage/work-orders?plate=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <form
          onSubmit={handlePlateSearchSubmit}
          className="relative flex-1 sm:max-w-md"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input
            value={plateQuery}
            onChange={(e) => setPlateQuery(e.target.value)}
            placeholder={t("plateSearchPlaceholder")}
            aria-label={t("plateSearchPlaceholder")}
            className="h-11 pl-10 font-mono uppercase"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline">
            <Link href={`/garages/${garageSlug}`} target="_blank">
              {t("publicBookingLink")}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="gradient"
            onClick={() => setQuickOpen(true)}
          >
            <Zap className="h-4 w-4" />
            {t("newWorkOrder")}
          </Button>
        </div>
      </div>

      <QuickWorkOrderDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        customers={customers}
        recentWorkOrders={recentWorkOrders}
        initialPlate={plateQuery.trim().toUpperCase()}
        onCreated={(wo) => {
          router.push(`/garage/work-orders/${wo.id}`);
        }}
      />
    </>
  );
}

