"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BellRing,
  Disc3,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import {
  type TyreSetFormValues,
  tyreSetFormSchema,
} from "@/lib/validators/garage";
import {
  type AppLocale,
  type Customer,
  TYRE_SEASONS,
  type TyreSeason,
  type TyreSet,
  type TyreStorageStatus,
} from "@/types/domain";

interface TyreStorageClientProps {
  initialTyreSets: TyreSet[];
  customers: Customer[];
}

export function TyreStorageClient({
  initialTyreSets,
  customers,
}: TyreStorageClientProps) {
  const t = useTranslations("garageWorkspace.tyres");
  const tSeasons = useTranslations("garageWorkspace.tyreSeasons");
  const tStatuses = useTranslations("garageWorkspace.tyreStatuses");
  const tWo = useTranslations("garageWorkspace.workOrders");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [tyreSets, setTyreSets] = useState<TyreSet[]>(initialTyreSets);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<TyreSetFormValues>({
    resolver: zodResolver(tyreSetFormSchema),
    defaultValues: {
      plateNumber: "",
      customerName: "",
      customerPhone: "",
      brandModel: "",
      sizeSpec: "205/55 R16",
      season: "winter",
      quantity: 4,
      withRims: false,
      treadDepthMm: 6.5,
      shelfLocation: "",
      status: "stored",
      seasonalReminderDate: null,
      notes: "",
    },
  });

  const watchedPlate = form.watch("plateNumber");

  useEffect(() => {
    const norm = normalizeLicensePlate(watchedPlate || "");
    if (norm.length < 4) return;
    const found = customers.find((c) => {
      const plates =
        c.platesNormalized ?? c.plateNumbers.map((p) => normalizeLicensePlate(p));
      return plates.includes(norm);
    });
    if (found) {
      if (!form.getValues("customerName")) {
        form.setValue("customerName", found.fullName);
      }
      if (!form.getValues("customerPhone")) {
        form.setValue("customerPhone", found.phone);
      }
    }
  }, [watchedPlate, customers, form]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const normQ = normalizeLicensePlate(query);
    if (!q) return tyreSets;
    return tyreSets.filter(
      (ts) =>
        (normQ.length > 0 && ts.plateNormalized.includes(normQ)) ||
        ts.shelfLocation.toLowerCase().includes(q) ||
        ts.customerName.toLowerCase().includes(q) ||
        ts.brandModel.toLowerCase().includes(q)
    );
  }, [tyreSets, query]);

  const handleStatusChange = async (
    item: TyreSet,
    status: TyreStorageStatus
  ) => {
    const prev = tyreSets;
    setTyreSets((list) =>
      list.map((tItem) => (tItem.id === item.id ? { ...tItem, status } : tItem))
    );

    const res = await fetch(`/api/garage/tyres/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      setTyreSets(prev);
      toast.error("Update failed.");
      return;
    }

    toast.success(t("savedToast"));
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    const prev = tyreSets;
    setTyreSets((list) => list.filter((i) => i.id !== id));
    const res = await fetch(`/api/garage/tyres/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setTyreSets(prev);
      toast.error("Delete failed.");
      return;
    }
    toast.success(t("deletedToast"));
    router.refresh();
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await fetch("/api/garage/tyres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (res.status === 429) {
      toast.error(tWo("quotaExceededToast"));
      return;
    }

    if (!res.ok) {
      toast.error("Could not save tyre set.");
      return;
    }

    const json = (await res.json()) as { tyreSet: TyreSet };
    setTyreSets((prev) => [json.tyreSet, ...prev]);
    toast.success(t("savedToast"));
    setDialogOpen(false);
    form.reset();
    router.refresh();
  });

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

        <Button
          type="button"
          variant="gradient"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("addTyreSet")}
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-11 pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Disc3}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Button
              type="button"
              variant="gradient"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("addTyreSet")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ts) => (
            <Card
              key={ts.id}
              hoverLift
              className="flex flex-col justify-between p-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-foreground">
                    {ts.plateNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl border border-violet-500/35 bg-violet-500/15 px-2.5 py-1 font-mono text-xs font-bold text-violet-300">
                    <MapPin className="h-3.5 w-3.5" />
                    {ts.shelfLocation}
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {ts.brandModel}
                  </h2>
                  <p className="font-mono text-xs text-primary">
                    {ts.sizeSpec} • {ts.quantity}x
                    {ts.treadDepthMm !== null ? ` • ${ts.treadDepthMm} mm` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ts.customerName} • {ts.customerPhone}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="default">{tSeasons(ts.season)}</Badge>
                  <Badge variant="secondary">
                    {ts.withRims ? t("withRims") : t("withoutRims")}
                  </Badge>
                  <Badge
                    variant={ts.status === "stored" ? "success" : "outline"}
                  >
                    {tStatuses(ts.status)}
                  </Badge>
                </div>

                {ts.seasonalReminderDate ? (
                  <p className="flex items-center gap-1.5 text-xs text-orange-400">
                    <BellRing className="h-3.5 w-3.5" />
                    {formatDate(ts.seasonalReminderDate, locale)}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
                <div className="flex gap-1.5">
                  {ts.status !== "stored" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleStatusChange(ts, "stored")}
                    >
                      {t("markStored")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void handleStatusChange(ts, "mounted_on_car")
                      }
                    >
                      {t("markMounted")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleStatusChange(ts, "returned")}
                  >
                    {t("markReturned")}
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => void handleDelete(ts.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Store Tyre Set Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addTyreSet")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ts-plate">{tWo("plateLabel")}</Label>
                <Input
                  id="ts-plate"
                  placeholder="CB 1234 AB"
                  className="font-mono uppercase"
                  {...form.register("plateNumber")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ts-shelf">{t("shelfLabel")} *</Label>
                <Input
                  id="ts-shelf"
                  placeholder={t("shelfPlaceholder")}
                  className="font-mono uppercase"
                  {...form.register("shelfLocation")}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ts-cname">{tWo("customerName")}</Label>
                <Input id="ts-cname" {...form.register("customerName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ts-cphone">{tWo("customerPhone")}</Label>
                <Input
                  id="ts-cphone"
                  placeholder="+359 88 123 4567"
                  {...form.register("customerPhone")}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ts-brand">{t("brandModel")}</Label>
                <Input
                  id="ts-brand"
                  placeholder={t("brandPlaceholder")}
                  {...form.register("brandModel")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ts-size">{t("sizeSpec")}</Label>
                <Input
                  id="ts-size"
                  placeholder={t("sizePlaceholder")}
                  className="font-mono uppercase"
                  {...form.register("sizeSpec")}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t("season")}</Label>
                <Controller
                  control={form.control}
                  name="season"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as TyreSeason)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYRE_SEASONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {tSeasons(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ts-qty">{t("quantity")}</Label>
                <Input
                  id="ts-qty"
                  type="number"
                  min={1}
                  max={8}
                  {...form.register("quantity", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ts-tread">{t("treadDepth")}</Label>
                <Input
                  id="ts-tread"
                  type="number"
                  step="0.5"
                  min={0}
                  max={20}
                  onChange={(e) =>
                    form.setValue(
                      "treadDepthMm",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <Label htmlFor="ts-rims" className="cursor-pointer">
                {t("withRims")}
              </Label>
              <Controller
                control={form.control}
                name="withRims"
                render={({ field }) => (
                  <Switch
                    id="ts-rims"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ts-rem">{t("seasonalReminder")}</Label>
              <Input
                id="ts-rem"
                type="date"
                onChange={(e) =>
                  form.setValue(
                    "seasonalReminderDate",
                    e.target.value || null
                  )
                }
              />
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

