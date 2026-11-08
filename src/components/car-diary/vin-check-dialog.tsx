"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gauge,
  HelpCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { formatNumber } from "@/lib/utils";
import type { Vehicle } from "@/types/domain";

interface VinCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
  onVehicleUpdated?: (updated: Vehicle) => void;
}

export function VinCheckDialog({
  open,
  onOpenChange,
  vehicle,
  onVehicleUpdated,
}: VinCheckDialogProps) {
  const t = useTranslations("carDiary.cars");
  const tCommon = useTranslations("common");

  const [copied, setCopied] = useState(false);
  const [vinInput, setVinInput] = useState("");
  const [savingVin, setSavingVin] = useState(false);

  const [newMileageInput, setNewMileageInput] = useState(
    String(vehicle.currentMileageKm || "")
  );
  const [savingMileage, setSavingMileage] = useState(false);

  const currentVin = vehicle.vin?.trim();

  const handleCopyVin = async () => {
    if (!currentVin) return;
    try {
      await navigator.clipboard.writeText(currentVin);
      setCopied(true);
      toast.success(t("vinCopiedToast"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Неуспешно копиране.");
    }
  };

  const handleSaveVin = async () => {
    const cleaned = vinInput.trim().toUpperCase();
    if (cleaned.length !== 17 || /[IOQ]/i.test(cleaned)) {
      toast.error("VIN номерът трябва да е точно 17 символа (без букви I, O, Q).");
      return;
    }

    setSavingVin(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: cleaned }),
      });

      if (!res.ok) {
        toast.error("Грешка при запис на VIN номера.");
        return;
      }

      const json = (await res.json()) as { vehicle: Vehicle };
      toast.success("VIN номерът е запазен!");
      onVehicleUpdated?.(json.vehicle);
    } catch {
      toast.error("Грешка при запис на VIN номера.");
    } finally {
      setSavingVin(false);
    }
  };

  const handleUpdateMileage = async () => {
    const parsedKm = Number(newMileageInput);
    if (!Number.isInteger(parsedKm) || parsedKm < 0 || parsedKm > 3_000_000) {
      toast.error("Невалидна стойност за пробег.");
      return;
    }

    setSavingMileage(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentMileageKm: parsedKm }),
      });

      if (!res.ok) {
        toast.error("Грешка при обновяване на километража.");
        return;
      }

      const json = (await res.json()) as { vehicle: Vehicle };
      toast.success(t("mileageUpdated"));
      onVehicleUpdated?.(json.vehicle);
    } catch {
      toast.error("Грешка при обновяване на километража.");
    } finally {
      setSavingMileage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                {t("vinCheckDialogTitle")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("vinCheckDialogDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1 flex-1">
          {/* Vehicle Identity Banner */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-secondary/20 p-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground text-sm">
                {vehicle.make} {vehicle.model}
              </span>
              <span className="text-muted-foreground ml-2">({vehicle.year} г.)</span>
            </div>
            <span className="rounded-lg border border-border bg-background px-2.5 py-1 font-mono text-xs font-bold text-foreground">
              {vehicle.plateNumber}
            </span>
          </div>

          {currentVin ? (
            <>
              {/* VIN Display & 1-Click Copy Box */}
              <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Номер на рама (VIN)
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30">
                    17 символа
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-background/80 p-3">
                  <span className="font-mono text-base sm:text-lg font-bold tracking-widest text-foreground select-all break-all text-center sm:text-left">
                    {currentVin}
                  </span>
                  <Button
                    type="button"
                    variant={copied ? "default" : "outline"}
                    size="sm"
                    onClick={handleCopyVin}
                    className="shrink-0 h-9 text-xs gap-1.5 font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Копиран!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t("copyVinBtn")}</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
                  <span>Текущ отчетен пробег във Veltrox:</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {formatNumber(vehicle.currentMileageKm)} км
                  </span>
                </div>
              </div>

              {/* How it works & Steps */}
              <div className="rounded-2xl border border-border/70 bg-secondary/15 p-4 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>{t("vinCheckWhyTitle")}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  {t("vinCheckWhyDesc")}
                </p>

                <div className="space-y-1.5 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{t("vinCheckStep1")}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{t("vinCheckStep2")}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{t("vinCheckStep3")}</span>
                  </div>
                </div>
              </div>

              {/* Direct Link to Official Public Check Portal */}
              <Button
                asChild
                variant="gradient"
                className="w-full h-11 text-xs sm:text-sm font-semibold shadow-md shadow-primary/20"
              >
                <a
                  href="https://public-eis.rta.government.bg/public-vehicle-check/vin-check"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span>{t("openRtaVinCheckPortal")}</span>
                </a>
              </Button>

              {/* In-app Odometer Sync / Correction */}
              <div className="rounded-2xl border border-border/70 bg-secondary/15 p-4 space-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {t("syncMileageTitle")}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("syncMileageDesc")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={3000000}
                    value={newMileageInput}
                    onChange={(e) => setNewMileageInput(e.target.value)}
                    placeholder="напр. 195000"
                    className="font-mono h-10 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      savingMileage ||
                      Number(newMileageInput) === vehicle.currentMileageKm ||
                      !newMileageInput
                    }
                    onClick={handleUpdateMileage}
                    className="shrink-0 h-10 text-xs font-semibold"
                  >
                    {savingMileage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("saveNewMileage")
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Vehicle has NO VIN yet */
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] p-4 space-y-3.5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    {t("noVinSet")}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("noVinSetDesc")}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label htmlFor="input-vin-direct" className="text-xs font-semibold text-foreground">
                  {t("addVinPrompt")}
                </Label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    id="input-vin-direct"
                    value={vinInput}
                    onChange={(e) =>
                      setVinInput(e.target.value.toUpperCase().slice(0, 17))
                    }
                    placeholder="17-символен номер на рама"
                    maxLength={17}
                    className="font-mono uppercase tracking-wider h-10 text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    variant="gradient"
                    disabled={savingVin || vinInput.trim().length !== 17}
                    onClick={handleSaveVin}
                    className="shrink-0 h-10 text-xs font-semibold"
                  >
                    {savingVin ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("saveVinAndCheck")
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 sticky bottom-0 bg-popover/95 backdrop-blur-md border-t border-border/40 pb-1 mt-2 z-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto min-h-10"
          >
            {tCommon("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

