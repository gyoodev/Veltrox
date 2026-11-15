"use client";

import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  QrCode,
  ShieldAlert,
  ShieldCheck,
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
import { Switch } from "@/components/ui/switch";
import { generateQrSvgString, getQrMatrix } from "@/lib/qr-svg";
import {
  computeCrossBorderReadiness,
  type CrossBorderCountryCode,
} from "@/lib/subscriptions/pro-metrics-extended";
import type { Reminder, Vehicle, VehicleDocument } from "@/types/domain";

interface PassStateEntry {
  token: string | null;
  enabled: boolean;
  includeCosts: boolean;
}

interface DriverServicePassTabProps {
  vehicles: Vehicle[];
}

export function DriverServicePassTab({
  vehicles,
}: DriverServicePassTabProps) {
  const t = useTranslations("driverProTools");

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    vehicles[0]?.id ?? ""
  );
  const [passStates, setPassStates] = useState<Record<string, PassStateEntry>>(
    () => {
      const init: Record<string, PassStateEntry> = {};
      for (const v of vehicles) {
        init[v.id] = {
          token: v.publicPassToken ?? null,
          enabled: Boolean(v.publicPassEnabled && v.publicPassToken),
          includeCosts: Boolean(v.publicPassIncludeAmounts),
        };
      }
      return init;
    }
  );
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const currentVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null;
  const currentState: PassStateEntry = currentVehicle
    ? (passStates[currentVehicle.id] ?? {
        token: null,
        enabled: false,
        includeCosts: false,
      })
    : { token: null, enabled: false, includeCosts: false };

  const relativePath = currentState.token
    ? `/verify-car/${currentState.token}`
    : "";
  const fullPassUrl =
    relativePath && origin ? `${origin}${relativePath}` : relativePath;

  const qrMatrix = useMemo(
    () =>
      currentState.enabled && fullPassUrl
        ? getQrMatrix(fullPassUrl)
        : null,
    [currentState.enabled, fullPassUrl]
  );

  const handleTogglePass = async (
    nextEnabled: boolean,
    nextIncludeCosts: boolean
  ) => {
    if (!currentVehicle) return;
    setSaving(true);
    try {
      const res = await fetch("/api/app/pro-tools/service-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: currentVehicle.id,
          enabled: nextEnabled,
          includeCosts: nextIncludeCosts,
        }),
      });
      if (!res.ok) {
        toast.error(t("passSaveError"));
        return;
      }
      const data = (await res.json()) as {
        token?: string;
        enabled?: boolean;
        includeCosts?: boolean;
      };
      setPassStates((prev) => ({
        ...prev,
        [currentVehicle.id]: {
          token: data.token ?? currentState.token,
          enabled: Boolean(data.enabled),
          includeCosts: Boolean(data.includeCosts),
        },
      }));
      toast.success(
        nextEnabled ? t("passEnabledToast") : t("passDisabledToast")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!fullPassUrl) return;
    try {
      await navigator.clipboard.writeText(fullPassUrl);
      setCopied(true);
      toast.success(t("passLinkCopiedToast"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("dossierCopyError"));
    }
  };

  const handleDownloadQrSvg = () => {
    if (!currentVehicle || !fullPassUrl) return;
    const svg = generateQrSvgString(fullPassUrl, 3);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veltrox-pass-${currentVehicle.plateNumber}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentVehicle) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("passConfigTitle")}
          </CardTitle>
          <CardDescription>{t("passConfigDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("quickFuelVehicleLabel")}</Label>
            <Select
              value={selectedVehicleId}
              onValueChange={setSelectedVehicleId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.make} {v.model} ({v.plateNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("passIncludeCostsLabel")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("passIncludeCostsDesc")}
              </p>
            </div>
            <Switch
              checked={currentState.includeCosts}
              disabled={saving}
              onCheckedChange={(checked) => {
                setPassStates((prev) => ({
                  ...prev,
                  [currentVehicle.id]: {
                    ...currentState,
                    includeCosts: checked,
                  },
                }));
                if (currentState.enabled) {
                  void handleTogglePass(true, checked);
                }
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saving}
              onClick={() =>
                handleTogglePass(true, currentState.includeCosts)
              }
            >
              <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {currentState.enabled ? t("passRefreshBtn") : t("passActivateBtn")}
            </Button>

            {currentState.enabled ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() =>
                  handleTogglePass(false, currentState.includeCosts)
                }
              >
                {t("passDisableBtn")}
              </Button>
            ) : null}
          </div>

          {currentState.enabled && fullPassUrl ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="success">{t("passLiveBadge")}</Badge>
                <span className="font-mono text-xs text-muted-foreground truncate max-w-[240px]">
                  {relativePath}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyUrl}
                >
                  {copied ? (
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("passCopyLinkBtn")}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={relativePath} target="_blank">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    {t("passOpenPublicBtn")}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 flex flex-col justify-between">
        <CardHeader>
          <CardTitle className="text-base">{t("passQrPreviewTitle")}</CardTitle>
          <CardDescription>{t("passQrPreviewDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 pb-6">
          {qrMatrix && currentState.enabled ? (
            <>
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <svg
                  width={180}
                  height={180}
                  viewBox={`-2 -2 ${qrMatrix.length + 4} ${qrMatrix.length + 4}`}
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label="Vehicle Service Pass QR Code"
                >
                  <rect
                    x={-2}
                    y={-2}
                    width={qrMatrix.length + 4}
                    height={qrMatrix.length + 4}
                    fill="#ffffff"
                  />
                  {qrMatrix.map((row, r) =>
                    row.map((dark, c) =>
                      dark ? (
                        <rect
                          key={`${r}-${c}`}
                          x={c}
                          y={r}
                          width={1}
                          height={1}
                          fill="#0a0e1a"
                        />
                      ) : null
                    )
                  )}
                </svg>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadQrSvg}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("passDownloadQrBtn")}
              </Button>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              {t("passQrInactiveHint")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DriverCrossBorderTabProps {
  vehicles: Vehicle[];
  documents: VehicleDocument[];
  reminders: Reminder[];
}

export function DriverCrossBorderTab({
  vehicles,
  documents,
  reminders,
}: DriverCrossBorderTabProps) {
  const t = useTranslations("driverProTools");

  const [vehicleId, setVehicleId] = useState<string>(vehicles[0]?.id ?? "");
  const [country, setCountry] = useState<CrossBorderCountryCode>("gr");
  const [tripDate, setTripDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});
  const [copiedPack, setCopiedPack] = useState(false);

  const readiness = useMemo(
    () =>
      computeCrossBorderReadiness(
        vehicleId,
        country,
        documents,
        reminders,
        tripDate
      ),
    [country, documents, reminders, tripDate, vehicleId]
  );

  const selectedVehicle =
    vehicles.find((v) => v.id === vehicleId) ?? vehicles[0] ?? null;

  const handleCopyPack = async () => {
    if (!selectedVehicle) return;
    const summary = [
      `Veltrox Cross-Border Pack — ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.plateNumber})`,
      `Destination: ${t(`cbCountry_${country}`)} | Trip Date: ${tripDate}`,
      `Compliance Readiness: ${readiness.readinessPct}%`,
      `- Insurance / Green Card: ${readiness.hasValidInsurance ? "VALID" : "CHECK"}`,
      `- Technical Inspection (GTP): ${readiness.hasValidInspection ? "VALID" : "CHECK"}`,
      `- Vignette / Road Tax: ${readiness.hasValidVignette ? "VALID" : "CHECK"}`,
      `Mandatory Gear: ${readiness.gearKeys.map((g) => t(`cbGear_${g}`)).join(", ")}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedPack(true);
      toast.success(t("cbCopiedToast"));
      setTimeout(() => setCopiedPack(false), 2000);
    } catch {
      toast.error(t("dossierCopyError"));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("cbTitle")}
          </CardTitle>
          <CardDescription>{t("cbDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("quickFuelVehicleLabel")}</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.plateNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("cbDestinationLabel")}</Label>
              <Select
                value={country}
                onValueChange={(v) => setCountry(v as CrossBorderCountryCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["gr", "ro", "rs", "tr", "eu"] as const).map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`cbCountry_${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("cbTripDateLabel")}</Label>
              <Input
                type="date"
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
              <p className="text-xs text-muted-foreground">{t("cbScoreLabel")}</p>
              <p
                className={`mt-1 font-mono text-2xl font-bold ${
                  readiness.readinessPct === 100
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {readiness.readinessPct}%
              </p>
            </div>

            {[
              {
                key: "ins",
                ok: readiness.hasValidInsurance,
                label: t("complianceKindLiability"),
              },
              {
                key: "gtp",
                ok: readiness.hasValidInspection,
                label: t("complianceKindInspection"),
              },
              {
                key: "vig",
                ok: readiness.hasValidVignette,
                label: t("complianceKindVignette"),
              },
            ].map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-border/60 bg-background/40 p-3.5 flex flex-col justify-between gap-2"
              >
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <Badge
                  variant={item.ok ? "success" : "warning"}
                  className="w-fit gap-1"
                >
                  {item.ok ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <ShieldAlert className="h-3 w-3" />
                  )}
                  {item.ok ? t("cbStatusValid") : t("cbStatusMissing")}
                </Badge>
              </div>
            ))}
          </div>

          {readiness.winterTyreAdvisory ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-300">
              {t("cbWinterTyreAlert")}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("cbMandatoryGearHeading")}
            </Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {readiness.gearKeys.map((gKey) => {
                const isDone = Boolean(checkedGear[gKey]);
                return (
                  <button
                    key={gKey}
                    type="button"
                    onClick={() =>
                      setCheckedGear((prev) => ({
                        ...prev,
                        [gKey]: !prev[gKey],
                      }))
                    }
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      isDone
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-border/60 bg-background/40 text-foreground"
                    }`}
                  >
                    <span>{t(`cbGear_${gKey}`)}</span>
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyPack}
            >
              {copiedPack ? (
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("cbCopyBtn")}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/documents">{t("cbOpenDocsBtn")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

