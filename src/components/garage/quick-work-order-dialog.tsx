"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Plus, Sparkles, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { normalizeLicensePlate } from "@/lib/validators/entities";
import { getFirebaseClient } from "@/lib/firebase/client";
import {
  type QuickWorkOrderFormValues,
  quickWorkOrderFormSchema,
} from "@/lib/validators/garage";
import type { Customer, WorkOrder } from "@/types/domain";

const QUICK_PRESET_KEYS = [
  "oil",
  "diagnostics",
  "brakes",
  "suspension",
  "tyres",
  "ac",
] as const;

interface QuickWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  recentWorkOrders: WorkOrder[];
  initialPlate?: string;
  onCreated: (workOrder: WorkOrder, customer: Customer) => void;
}

/**
 * Engineered for sub-30-second mobile intake on a mechanic's phone:
 * - Instant license-plate autofill of Customer Name, Phone, and Vehicle Make/Model
 * - 1-tap Recent Customer chips
 * - 1-tap Service Preset chips
 */
export function QuickWorkOrderDialog({
  open,
  onOpenChange,
  customers,
  recentWorkOrders,
  initialPlate = "",
  onCreated,
}: QuickWorkOrderDialogProps) {
  const t = useTranslations("garageWorkspace.workOrders");
  const tPresets = useTranslations("garageWorkspace.presetServices");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");

  const [matchedCustomerName, setMatchedCustomerName] = useState<string | null>(
    null
  );

  const form = useForm<QuickWorkOrderFormValues>({
    resolver: zodResolver(quickWorkOrderFormSchema),
    defaultValues: {
      plateNumber: initialPlate,
      customerPhone: "",
      customerName: "",
      vehicleLabel: "",
      mileageKm: null,
      customerSummary: "",
      status: "received",
      currency: "EUR",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      plateNumber: initialPlate,
      customerPhone: "",
      customerName: "",
      vehicleLabel: "",
      mileageKm: null,
      customerSummary: "",
      status: "received",
      currency: "EUR",
    });
    setMatchedCustomerName(null);
  }, [open, initialPlate, form]);

  const plateValue = form.watch("plateNumber");

  // Plate-number autofill: match customer & last vehicle label in real time
  useEffect(() => {
    const norm = normalizeLicensePlate(plateValue || "");
    if (norm.length < 4) {
      setMatchedCustomerName(null);
      return;
    }

    const foundCust = customers.find((c) => {
      const plates =
        c.platesNormalized ?? c.plateNumbers.map((p) => normalizeLicensePlate(p));
      return plates.includes(norm);
    });

    const lastOrder = recentWorkOrders.find(
      (wo) => wo.plateNormalized === norm
    );

    if (foundCust) {
      setMatchedCustomerName(foundCust.fullName);
      if (!form.getValues("customerPhone")) {
        form.setValue("customerPhone", foundCust.phone, {
          shouldValidate: true,
        });
      }
      if (!form.getValues("customerName")) {
        form.setValue("customerName", foundCust.fullName);
      }
    } else {
      setMatchedCustomerName(null);
    }

    if (lastOrder && !form.getValues("vehicleLabel")) {
      form.setValue("vehicleLabel", lastOrder.vehicleLabel);
    }
  }, [plateValue, customers, recentWorkOrders, form]);

  const recentCustomerChips = useMemo(
    () => customers.slice(0, 5),
    [customers]
  );

  const applyRecentCustomer = (cust: Customer) => {
    const primaryPlate = cust.plateNumbers[0] ?? "";
    form.setValue("plateNumber", primaryPlate, { shouldValidate: true });
    form.setValue("customerPhone", cust.phone, { shouldValidate: true });
    form.setValue("customerName", cust.fullName);
    setMatchedCustomerName(cust.fullName);

    const norm = normalizeLicensePlate(primaryPlate);
    const lastWo = recentWorkOrders.find((wo) => wo.plateNormalized === norm);
    if (lastWo) {
      form.setValue("vehicleLabel", lastWo.vehicleLabel);
    }
  };

  const appendPresetService = (serviceLabel: string) => {
    const current = form.getValues("customerSummary").trim();
    const next = current ? `${current}, ${serviceLabel}` : serviceLabel;
    form.setValue("customerSummary", next, { shouldValidate: true });
  };

  const translateErr = (key?: string) => {
    if (!key) return null;
    try {
      return tVal(key as never);
    } catch {
      return key;
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const fb = getFirebaseClient();
    let idToken: string | null = null;
    if (fb?.auth.currentUser) {
      try {
        idToken = await fb.auth.currentUser.getIdToken(false);
      } catch {}
    }

    let res = await fetch("/api/garage/work-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(values),
    });

    if (res.status === 401 && fb?.auth.currentUser) {
      try {
        const freshIdToken = await fb.auth.currentUser.getIdToken(true);
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: freshIdToken }),
        });
        res = await fetch("/api/garage/work-orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${freshIdToken}`,
          },
          body: JSON.stringify(values),
        });
      } catch {}
    }

    if (!res.ok) {
      toast.error("Failed to create work order.");
      return;
    }

    const json = (await res.json()) as {
      workOrder: WorkOrder;
      customer: Customer;
    };
    toast.success(t("createdToast"));
    onCreated(json.workOrder, json.customer);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {t("quickModalTitle")}
          </DialogTitle>
          <DialogDescription>{t("quickModalDesc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 1-Tap Recent Customers */}
          {recentCustomerChips.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("recentCustomers")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentCustomerChips.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => applyRecentCustomer(cust)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
                  >
                    <span className="font-mono font-bold text-primary">
                      {cust.plateNumbers[0]}
                    </span>
                    <span className="max-w-[110px] truncate text-muted-foreground">
                      {cust.fullName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Primary Key: License Plate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="qwo-plate">{t("plateLabel")}</Label>
              {matchedCustomerName ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("matchedCustomerBadge", { name: matchedCustomerName })}
                </Badge>
              ) : null}
            </div>
            <Input
              id="qwo-plate"
              autoFocus
              placeholder="CB 1234 AB"
              className="h-12 font-mono text-base font-bold uppercase tracking-wider"
              {...form.register("plateNumber")}
            />
            {form.formState.errors.plateNumber ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.plateNumber.message)}
              </p>
            ) : null}
          </div>

          {/* Phone + Name */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qwo-phone">{t("customerPhone")}</Label>
              <Input
                id="qwo-phone"
                type="tel"
                placeholder="+359 88 123 4567"
                {...form.register("customerPhone")}
              />
              {form.formState.errors.customerPhone ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.customerPhone.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qwo-name">{t("customerName")}</Label>
              <Input id="qwo-name" {...form.register("customerName")} />
            </div>
          </div>

          {/* Optional Vehicle Label + Mileage */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qwo-veh">{t("vehicleLabel")}</Label>
              <Input
                id="qwo-veh"
                placeholder={t("vehiclePlaceholder")}
                {...form.register("vehicleLabel")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qwo-km">{t("mileageLabel")}</Label>
              <Input
                id="qwo-km"
                type="number"
                min={0}
                className="font-mono"
                onChange={(e) => {
                  const val = e.target.value;
                  form.setValue("mileageKm", val === "" ? null : Number(val));
                }}
              />
            </div>
          </div>

          {/* 1-Tap Service Presets + Summary */}
          <div className="space-y-2">
            <Label htmlFor="qwo-summary">{t("summaryLabel")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESET_KEYS.map((key) => {
                const label = tPresets(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => appendPresetService(label)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                    {label}
                  </button>
                );
              })}
            </div>
            <textarea
              id="qwo-summary"
              rows={2}
              placeholder={t("summaryPlaceholder")}
              className="flex w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...form.register("customerSummary")}
            />
            {form.formState.errors.customerSummary ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.customerSummary.message)}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={form.formState.isSubmitting}
              className="min-h-11"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("creatingOrder")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("createOrderBtn")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

