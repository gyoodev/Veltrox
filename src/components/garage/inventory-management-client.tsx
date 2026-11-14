"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
import {
  type InventoryPartFormValues,
  inventoryPartFormSchema,
} from "@/lib/validators/inventory";
import type { AppLocale, InventoryPart } from "@/types/domain";

interface InventoryManagementClientProps {
  initialParts: InventoryPart[];
  currency?: "EUR" | "BGN";
}

export function InventoryManagementClient({
  initialParts,
  currency = "EUR",
}: InventoryManagementClientProps) {
  const t = useTranslations("garageWorkspace.inventory");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;

  const [parts, setParts] = useState<InventoryPart[]>(initialParts);
  const [query, setQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<InventoryPart | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const form = useForm<InventoryPartFormValues>({
    resolver: zodResolver(inventoryPartFormSchema),
    defaultValues: {
      sku: "",
      name: "",
      brand: "",
      category: "",
      supplierName: "",
      costPrice: 0,
      sellPrice: 0,
      stockQty: 0,
      minStockAlert: 2,
      unit: "pcs",
      notes: "",
    },
  });

  const openCreate = () => {
    setEditingPart(null);
    form.reset({
      sku: "",
      name: "",
      brand: "",
      category: "",
      supplierName: "",
      costPrice: 0,
      sellPrice: 0,
      stockQty: 0,
      minStockAlert: 2,
      unit: "pcs",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (part: InventoryPart) => {
    setEditingPart(part);
    form.reset({
      sku: part.sku,
      name: part.name,
      brand: part.brand ?? "",
      category: part.category ?? "",
      supplierName: part.supplierName ?? "",
      costPrice: part.costPrice,
      sellPrice: part.sellPrice,
      stockQty: part.stockQty,
      minStockAlert: part.minStockAlert,
      unit: part.unit ?? "pcs",
      notes: part.notes ?? "",
    });
    setDialogOpen(true);
  };

  const filteredParts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (lowStockOnly && p.stockQty > p.minStockAlert) return false;
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.supplierName ?? "").toLowerCase().includes(q)
      );
    });
  }, [parts, query, lowStockOnly]);

  const lowStockCount = useMemo(
    () => parts.filter((p) => p.stockQty <= p.minStockAlert).length,
    [parts]
  );

  const totalInventoryValue = useMemo(
    () =>
      parts.reduce(
        (sum, p) => sum + Math.max(0, p.stockQty) * Math.max(0, p.costPrice),
        0
      ),
    [parts]
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const url = editingPart
      ? `/api/garage/inventory/${editingPart.id}`
      : "/api/garage/inventory";
    const method = editingPart ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error(t("saveError"));
      return;
    }

    const json = (await res.json()) as { part: InventoryPart };
    if (editingPart) {
      setParts((prev) =>
        prev.map((p) => (p.id === json.part.id ? json.part : p))
      );
    } else {
      setParts((prev) => [...prev, json.part]);
    }

    toast.success(t("savedToast"));
    setDialogOpen(false);
  });

  const handleAdjustStock = async (part: InventoryPart, delta: number) => {
    setBusyId(part.id);
    try {
      const res = await fetch(`/api/garage/inventory/${part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockDelta: delta }),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      const json = (await res.json()) as { part: InventoryPart };
      setParts((prev) => prev.map((p) => (p.id === part.id ? json.part : p)));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (partId: string) => {
    setBusyId(partId);
    try {
      const res = await fetch(`/api/garage/inventory/${partId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      setParts((prev) => prev.filter((p) => p.id !== partId));
      toast.success(t("deletedToast"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        <Button type="button" variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("addPartBtn")}
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("totalSkus")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {parts.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("stockValueCost")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(totalInventoryValue, locale, currency)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("lowStockLabel")}</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold ${
              lowStockCount > 0 ? "text-amber-500" : "text-emerald-500"
            }`}
          >
            {lowStockCount}
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          variant={lowStockOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setLowStockOnly((v) => !v)}
        >
          <AlertTriangle className="h-4 w-4" />
          {t("lowStockOnly", { count: lowStockCount })}
        </Button>
      </div>

      {/* Inventory List */}
      {filteredParts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredParts.map((part) => {
            const isLow = part.stockQty <= part.minStockAlert;
            const marginEur = part.sellPrice - part.costPrice;
            const marginPct =
              part.sellPrice > 0
                ? Math.round((marginEur / part.sellPrice) * 100)
                : 0;
            const busy = busyId === part.id;

            return (
              <Card
                key={part.id}
                className="flex flex-col justify-between gap-3 p-5"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {part.sku}
                      </Badge>
                      {part.brand ? (
                        <Badge variant="secondary" className="text-xs">
                          {part.brand}
                        </Badge>
                      ) : null}
                      {isLow ? (
                        <Badge variant="warning" className="text-[11px]">
                          {t("lowStockBadge")}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(part)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => void handleDelete(part.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-base font-bold text-foreground">
                    {part.name}
                  </p>

                  {part.supplierName ? (
                    <p className="text-xs text-muted-foreground">
                      {t("supplierLabel")}: {part.supplierName}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
                  <div className="space-y-0.5 font-mono">
                    <p className="text-muted-foreground">
                      {t("costLabel")}:{" "}
                      {formatCurrency(part.costPrice, locale, currency)} •{" "}
                      {t("sellLabel")}:{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(part.sellPrice, locale, currency)}
                      </span>
                    </p>
                    <p className="text-emerald-500">
                      {t("marginLabel")}:{" "}
                      {formatCurrency(marginEur, locale, currency)} ({marginPct}
                      %)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busy || part.stockQty <= 0}
                      onClick={() => void handleAdjustStock(part, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span
                      className={`min-w-[3.2rem] text-center font-mono text-sm font-bold ${
                        isLow ? "text-amber-500" : "text-foreground"
                      }`}
                    >
                      {part.stockQty} {part.unit || "pcs"}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busy}
                      onClick={() => void handleAdjustStock(part, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPart ? t("editPartTitle") : t("addPartBtn")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="part-sku">{t("skuLabel")}</Label>
                <Input
                  id="part-sku"
                  placeholder="OF-1234"
                  className="font-mono uppercase"
                  {...form.register("sku")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-brand">{t("brandLabel")}</Label>
                <Input id="part-brand" {...form.register("brand")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="part-name">{t("partNameLabel")}</Label>
              <Input id="part-name" {...form.register("name")} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="part-supplier">{t("supplierLabel")}</Label>
                <Input id="part-supplier" {...form.register("supplierName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-unit">{t("unitLabel")}</Label>
                <Input id="part-unit" placeholder="pcs / L" {...form.register("unit")} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="part-cost">{t("costLabel")}</Label>
                <Input
                  id="part-cost"
                  type="number"
                  step="0.01"
                  min={0}
                  {...form.register("costPrice", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-sell">{t("sellLabel")}</Label>
                <Input
                  id="part-sell"
                  type="number"
                  step="0.01"
                  min={0}
                  {...form.register("sellPrice", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-qty">{t("stockQtyLabel")}</Label>
                <Input
                  id="part-qty"
                  type="number"
                  step="0.1"
                  min={0}
                  {...form.register("stockQty", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-min">{t("minAlertLabel")}</Label>
                <Input
                  id="part-min"
                  type="number"
                  step="0.1"
                  min={0}
                  {...form.register("minStockAlert", { valueAsNumber: true })}
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

