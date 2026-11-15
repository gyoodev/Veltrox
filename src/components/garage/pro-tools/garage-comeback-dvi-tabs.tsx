"use client";

import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  ImagePlus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
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
import { computeGarageComebackRadar } from "@/lib/subscriptions/pro-metrics-extended";
import { formatCurrency } from "@/lib/utils";
import type {
  AppLocale,
  DviCheckItem,
  DviStatus,
  WorkOrder,
} from "@/types/domain";

interface GarageComebackRadarTabProps {
  workOrders: WorkOrder[];
  locale: AppLocale;
}

export function GarageComebackRadarTab({
  workOrders,
  locale,
}: GarageComebackRadarTabProps) {
  const t = useTranslations("garageProTools");

  const [windowDays, setWindowDays] = useState<number>(45);

  const alerts = useMemo(
    () => computeGarageComebackRadar(workOrders, windowDays),
    [windowDays, workOrders]
  );

  const totalExposureEur = useMemo(
    () => alerts.reduce((acc, a) => acc + a.reworkExposureEur, 0),
    [alerts]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("comebackCountLabel")}</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold ${
              alerts.length > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {alerts.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("comebackExposureLabel")}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-primary">
            {formatCurrency(totalExposureEur, locale, "EUR")}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <RotateCcw className="h-4 w-4 text-amber-400" aria-hidden="true" />
                {t("comebackTitle")}
              </CardTitle>
              <CardDescription>{t("comebackDesc")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t("comebackWindowLabel")}</Label>
              <Select
                value={String(windowDays)}
                onValueChange={(v) => setWindowDays(Number(v) || 45)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14d</SelectItem>
                  <SelectItem value="30">30d</SelectItem>
                  <SelectItem value="45">45d</SelectItem>
                  <SelectItem value="60">60d</SelectItem>
                  <SelectItem value="90">90d</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{t("comebackAllGood")}</span>
            </div>
          ) : (
            alerts.map((row) => (
              <div
                key={`${row.previousOrder.id}-${row.currentOrder.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {row.plateNumber}
                    </span>
                    <span className="text-sm text-foreground">
                      {row.customerName}
                    </span>
                    <Badge variant="warning" className="text-[11px] font-mono">
                      +{row.daysBetween}d
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("comebackPrevLabel")}:{" "}
                    {row.previousOrder.customerSummary || row.previousOrder.status}
                  </p>
                  <p className="text-xs text-foreground">
                    {t("comebackCurrLabel")}:{" "}
                    {row.currentOrder.customerSummary || row.currentOrder.status}
                  </p>
                </div>

                <Button asChild size="sm" variant="outline">
                  <Link href={`/garage/work-orders/${row.currentOrder.id}`}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    {t("comebackInspectBtn")}
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const DEFAULT_DVI_CHECKPOINT_IDS = [
  "brakes",
  "tyres",
  "battery",
  "suspension",
  "fluids",
  "cooling",
  "lights",
  "ac",
] as const;

interface GarageDviMobileTabProps {
  workOrders: WorkOrder[];
  onDviSaved: (woId: string, dviChecks: DviCheckItem[]) => void;
}

export function GarageDviMobileTab({
  workOrders,
  onDviSaved,
}: GarageDviMobileTabProps) {
  const t = useTranslations("garageProTools");

  const [selectedWoId, setSelectedWoId] = useState<string>(
    () =>
      workOrders.find((w) => w.status !== "completed")?.id ??
      workOrders[0]?.id ??
      ""
  );
  const selectedWo =
    workOrders.find((w) => w.id === selectedWoId) ?? workOrders[0] ?? null;

  const buildInitialChecks = (wo: WorkOrder | null): DviCheckItem[] => {
    if (wo?.dviChecks && wo.dviChecks.length > 0) {
      return wo.dviChecks;
    }
    return DEFAULT_DVI_CHECKPOINT_IDS.map((id) => ({
      id,
      label: t(`dviPoint_${id}`),
      status: "ok",
      note: null,
      photoUrl: null,
      estimatedCostEur: null,
    }));
  };

  const [checks, setChecks] = useState<DviCheckItem[]>(() =>
    buildInitialChecks(selectedWo)
  );
  const [uploadingPointId, setUploadingPointId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChecks(buildInitialChecks(selectedWo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWoId]);

  const handlePhotoUpload = async (
    pointId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingPointId(pointId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/vehicles/upload-photo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        toast.error(t("dviUploadError"));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        setChecks((prev) =>
          prev.map((c) => (c.id === pointId ? { ...c, photoUrl: data.url } : c))
        );
        toast.success(t("dviPhotoAttachedToast"));
      }
    } finally {
      setUploadingPointId(null);
    }
  };

  const handleSaveDvi = async () => {
    if (!selectedWo) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const payload = checks.map((c) => ({ ...c, updatedAt: nowIso }));
      const res = await fetch(`/api/garage/work-orders/${selectedWo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dviChecks: payload }),
      });
      if (!res.ok) {
        toast.error(t("dviSaveError"));
        return;
      }
      onDviSaved(selectedWo.id, payload);
      toast.success(t("dviSavedToast"));
    } finally {
      setSaving(false);
    }
  };

  if (!selectedWo) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {t("dviNoWorkOrders")}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              {t("dviTitle")}
            </CardTitle>
            <CardDescription>{t("dviDesc")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedWoId} onValueChange={setSelectedWoId}>
              <SelectTrigger className="w-60">
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
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/status/${selectedWo.publicStatusToken}`}
                target="_blank"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {t("quotesStatusLinkBtn")}
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {checks.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border/60 bg-background/40 p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                <div className="flex items-center gap-1">
                  {(["ok", "attention", "critical"] as const).map((st) => (
                    <Button
                      key={st}
                      type="button"
                      size="sm"
                      variant={
                        item.status === st
                          ? st === "ok"
                            ? "default"
                            : st === "attention"
                              ? "secondary"
                              : "destructive"
                          : "outline"
                      }
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setChecks((prev) =>
                          prev.map((c) =>
                            c.id === item.id ? { ...c, status: st as DviStatus } : c
                          )
                        )
                      }
                    >
                      {t(`dviStatus_${st}`)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  className="sm:col-span-2 h-8 text-xs"
                  placeholder={t("dviNotePlaceholder")}
                  value={item.note ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setChecks((prev) =>
                      prev.map((c) =>
                        c.id === item.id ? { ...c, note: val || null } : c
                      )
                    );
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  step={5}
                  className="h-8 text-xs font-mono"
                  placeholder="€"
                  value={item.estimatedCostEur ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setChecks((prev) =>
                      prev.map((c) =>
                        c.id === item.id
                          ? {
                              ...c,
                              estimatedCostEur: raw ? Number(raw) || 0 : null,
                            }
                          : c
                      )
                    );
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary hover:underline">
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>
                    {uploadingPointId === item.id
                      ? t("dviUploading")
                      : item.photoUrl
                        ? t("dviReplacePhoto")
                        : t("dviAttachPhoto")}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingPointId === item.id}
                    onChange={(e) => handlePhotoUpload(item.id, e)}
                  />
                </label>

                {item.photoUrl ? (
                  <a
                    href={item.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-emerald-400 hover:underline"
                  >
                    {t("dviPhotoReadyBadge")}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" disabled={saving} onClick={handleSaveDvi}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("dviSaveBtn")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

