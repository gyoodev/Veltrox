"use client";

import {
  Activity,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  ScanText,
  Search,
  Sparkles,
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
import { Textarea } from "@/components/ui/textarea";
import {
  DRIVER_OBD_TRIAGE_CATALOG,
  type ObdTriageEntry,
  parseReceiptSnippet,
} from "@/lib/subscriptions/pro-metrics-extended";
import { formatCurrency } from "@/lib/utils";
import {
  type AppLocale,
  type AttachmentItem,
  DIARY_CATEGORIES,
  type DiaryCategory,
  type DiaryEntry,
  type Garage,
  type Vehicle,
} from "@/types/domain";

interface DriverObdTriageTabProps {
  vehicles: Vehicle[];
  approvedGarages: Garage[];
  userName: string;
  userPhone: string;
  locale: AppLocale;
}

export function DriverObdTriageTab({
  vehicles,
  approvedGarages,
  userName,
  userPhone,
  locale,
}: DriverObdTriageTabProps) {
  const t = useTranslations("driverProTools");

  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string>(
    DRIVER_OBD_TRIAGE_CATALOG[0]?.code ?? "P0420"
  );
  const [vehicleId, setVehicleId] = useState<string>(vehicles[0]?.id ?? "");
  const [garageId, setGarageId] = useState<string>(
    approvedGarages[0]?.id ?? ""
  );
  const [contactPhone, setContactPhone] = useState<string>(userPhone);
  const [preferredDate, setPreferredDate] = useState<string>(() =>
    new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
  );
  const [preferredTime, setPreferredTime] = useState<string>("10:00");
  const [booking, setBooking] = useState(false);
  const [bookedCode, setBookedCode] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DRIVER_OBD_TRIAGE_CATALOG;
    return DRIVER_OBD_TRIAGE_CATALOG.filter((item) => {
      const title = t(`obdTitle_${item.code}`).toLowerCase();
      return (
        item.code.toLowerCase().includes(q) ||
        title.includes(q) ||
        item.specialtyFilter.toLowerCase().includes(q)
      );
    });
  }, [query, t]);

  const activeEntry: ObdTriageEntry =
    DRIVER_OBD_TRIAGE_CATALOG.find((c) => c.code === selectedCode) ??
    DRIVER_OBD_TRIAGE_CATALOG[0]!;

  const selectedGarage =
    approvedGarages.find((g) => g.id === garageId) ?? approvedGarages[0] ?? null;

  const handleBookDiagnostic = async () => {
    const car = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
    if (!selectedGarage || !car) return;
    if (!contactPhone || contactPhone.trim().length < 7) {
      toast.error(t("obdPhoneRequired"));
      return;
    }

    setBooking(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garageId: selectedGarage.id,
          vehicleId: car.id,
          customerName: userName.trim().length >= 2 ? userName.trim() : "Veltrox Driver",
          customerPhone: contactPhone.trim(),
          plateNumber: car.plateNumber,
          serviceRequested: `${activeEntry.code}: ${t(`obdTitle_${activeEntry.code}`)}`,
          preferredDate,
          preferredTime,
          notes: t(`obdAdvice_${activeEntry.code}`),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          err.error === "SLOT_UNAVAILABLE"
            ? t("obdSlotUnavailable")
            : t("obdBookingError")
        );
        return;
      }
      setBookedCode(activeEntry.code);
      toast.success(
        t("obdBookedToast", { garage: selectedGarage.name })
      );
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Code Selector */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("obdCatalogTitle")}
          </CardTitle>
          <CardDescription>{t("obdCatalogDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("obdSearchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {filteredCatalog.map((item) => {
              const selected = item.code === activeEntry.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setSelectedCode(item.code)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {item.code}
                    </span>
                    <Badge
                      variant={
                        item.severity === "stop"
                          ? "destructive"
                          : item.severity === "soon"
                            ? "warning"
                            : "secondary"
                      }
                      className="text-[11px]"
                    >
                      {t(`obdSev_${item.severity}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {t(`obdTitle_${item.code}`)}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Diagnosis + Direct Garage Quote Booking */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-mono text-lg text-foreground">
                {activeEntry.code} — {t(`obdTitle_${activeEntry.code}`)}
              </CardTitle>
              <CardDescription className="mt-1">
                {t(`obdAdvice_${activeEntry.code}`)}
              </CardDescription>
            </div>
            <Badge
              variant={
                activeEntry.severity === "stop"
                  ? "destructive"
                  : activeEntry.severity === "soon"
                    ? "warning"
                    : "secondary"
              }
            >
              {t(`obdSev_${activeEntry.severity}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border/60 bg-background/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("obdEstCostLabel")}</p>
              <p className="font-mono text-xl font-bold text-primary">
                {formatCurrency(activeEntry.minCostEur, locale, "EUR")} –{" "}
                {formatCurrency(activeEntry.maxCostEur, locale, "EUR")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("obdSpecialtyLabel")}</p>
              <p className="font-semibold text-foreground">
                {activeEntry.specialtyFilter}
              </p>
            </div>
          </div>

          {approvedGarages.length === 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/app/garages">{t("obdBrowseGaragesBtn")}</Link>
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {t("obdBookGarageHeading")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("quickFuelVehicleLabel")}</Label>
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
                <div className="space-y-1">
                  <Label className="text-xs">{t("obdSelectGarageLabel")}</Label>
                  <Select value={garageId} onValueChange={setGarageId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedGarages.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} ({g.city})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("obdPhoneLabel")}</Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+359 88 ..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("cbTripDateLabel")}</Label>
                    <Input
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("obdTimeLabel")}</Label>
                    <Input
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  disabled={booking}
                  onClick={handleBookDiagnostic}
                >
                  <CalendarPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {bookedCode === activeEntry.code
                    ? t("obdBookedBtn")
                    : t("obdBookNowBtn")}
                </Button>
                {selectedGarage ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/garages/${selectedGarage.slug}`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      {t("obdViewProfileBtn")}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DriverOcrReceiptTabProps {
  vehicles: Vehicle[];
  onEntryCreated: (entry: DiaryEntry) => void;
  locale: AppLocale;
}

export function DriverOcrReceiptTab({
  vehicles,
  onEntryCreated,
  locale,
}: DriverOcrReceiptTabProps) {
  const t = useTranslations("driverProTools");
  const tCat = useTranslations("carDiary.categories");

  const [vehicleId, setVehicleId] = useState<string>(vehicles[0]?.id ?? "");
  const [rawSnippet, setRawSnippet] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DiaryCategory>("fuel");
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [costAmount, setCostAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<"EUR" | "BGN">("EUR");
  const [mileageKm, setMileageKm] = useState<number>(
    vehicles[0]?.currentMileageKm ?? 0
  );
  const [uploadedAttachment, setUploadedAttachment] =
    useState<AttachmentItem | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);

  const handleExtractFromText = () => {
    if (!rawSnippet.trim()) {
      toast.error(t("ocrEmptyTextError"));
      return;
    }
    const parsed = parseReceiptSnippet(rawSnippet);
    if (parsed.title) setTitle(parsed.title);
    setCategory(parsed.category);
    setDate(parsed.date);
    setCurrency(parsed.currency);
    if (parsed.rawAmount > 0) setCostAmount(parsed.rawAmount);
    if (parsed.mileageKm !== null) setMileageKm(parsed.mileageKm);
    toast.success(t("ocrExtractedToast"));
  };

  const handleReceiptPhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/vehicles/upload-photo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        toast.error(t("ocrPhotoError"));
        return;
      }
      const data = (await res.json()) as {
        url?: string;
        storagePath?: string;
      };
      if (data.url && data.storagePath) {
        setUploadedAttachment({
          name: file.name,
          url: data.url,
          storagePath: data.storagePath,
          contentType: file.type || "image/jpeg",
        });
        if (!title.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
          if (cleanName.length >= 2) setTitle(cleanName.slice(0, 80));
        }
        toast.success(t("ocrPhotoReadyToast"));
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!vehicleId || title.trim().length < 2) {
      toast.error(t("ocrValidationError"));
      return;
    }

    setSavingEntry(true);
    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          category,
          title: title.trim(),
          date,
          mileageKm: Math.max(0, Math.round(mileageKm)),
          costAmount: Math.max(0, Number(costAmount.toFixed(2))),
          currency,
          notes: rawSnippet.trim() ? rawSnippet.trim().slice(0, 800) : null,
          attachments: uploadedAttachment ? [uploadedAttachment] : undefined,
        }),
      });
      if (!res.ok) {
        toast.error(t("tripSaveError"));
        return;
      }
      const data = (await res.json()) as { entry?: DiaryEntry };
      if (data.entry) {
        onEntryCreated(data.entry);
      }
      toast.success(t("ocrSavedDiaryToast"));
      setRawSnippet("");
      setTitle("");
      setUploadedAttachment(null);
    } finally {
      setSavingEntry(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanText className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("ocrInputTitle")}
          </CardTitle>
          <CardDescription>{t("ocrInputDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("ocrUploadPhotoLabel")}</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/40 p-4 text-xs text-muted-foreground hover:border-primary/50">
              <ImagePlus className="h-4 w-4 text-primary" />
              <span>
                {uploadingPhoto
                  ? t("ocrUploadingLabel")
                  : uploadedAttachment
                    ? uploadedAttachment.name
                    : t("ocrChoosePhotoBtn")}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={handleReceiptPhotoChange}
              />
            </label>
            {uploadedAttachment ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedAttachment.url}
                  alt="Receipt preview"
                  className="max-h-36 w-full object-contain bg-black/20"
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t("ocrSnippetLabel")}</Label>
            <Textarea
              rows={5}
              value={rawSnippet}
              onChange={(e) => setRawSnippet(e.target.value)}
              placeholder={t("ocrSnippetPlaceholder")}
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleExtractFromText}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t("ocrParseBtn")}
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">{t("ocrConfirmTitle")}</CardTitle>
          <CardDescription>{t("ocrConfirmDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("quickFuelVehicleLabel")}</Label>
              <Select
                value={vehicleId}
                onValueChange={(val) => {
                  setVehicleId(val);
                  const found = vehicles.find((v) => v.id === val);
                  if (found) setMileageKm(found.currentMileageKm);
                }}
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
            <div className="space-y-1.5">
              <Label>{t("ocrCategoryLabel")}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as DiaryCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIARY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {tCat(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("ocrEntryTitleLabel")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("ocrEntryTitlePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("ocrAmountLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costAmount}
                  onChange={(e) =>
                    setCostAmount(Number(e.target.value) || 0)
                  }
                />
                <Select
                  value={currency}
                  onValueChange={(v) => setCurrency(v as "EUR" | "BGN")}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="BGN">BGN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                {formatCurrency(
                  currency === "BGN" ? costAmount / 1.95583 : costAmount,
                  locale,
                  "EUR"
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>{t("cbTripDateLabel")}</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("ocrMileageLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={mileageKm}
                  onChange={(e) =>
                    setMileageKm(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={savingEntry}
            onClick={handleSaveEntry}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("ocrSaveDiaryBtn")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

