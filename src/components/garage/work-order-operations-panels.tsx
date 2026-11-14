"use client";

import {
  Camera,
  ClipboardCheck,
  Cpu,
  Fuel,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { uploadImageToImgBB } from "@/lib/imgbb";
import { formatCurrency } from "@/lib/utils";
import {
  type AppLocale,
  DTC_SEVERITIES,
  type DtcDiagnosticCode,
  type DtcSeverity,
  FUEL_LEVELS,
  type FuelLevel,
  type QuoteStatus,
  type WorkOrderQuoteItem,
} from "@/types/domain";

interface QuotePanelProps {
  currency: "EUR" | "BGN";
  quoteStatus: QuoteStatus;
  quoteNotes: string;
  setQuoteNotes: (v: string) => void;
  quoteItems: WorkOrderQuoteItem[];
  setQuoteItems: (items: WorkOrderQuoteItem[]) => void;
  quoteCustomerComment: string | null;
  sendingQuote: boolean;
  onSendQuote: () => Promise<void>;
}

export function WorkOrderQuotePanel({
  currency,
  quoteStatus,
  quoteNotes,
  setQuoteNotes,
  quoteItems,
  setQuoteItems,
  quoteCustomerComment,
  sendingQuote,
  onSendQuote,
}: QuotePanelProps) {
  const t = useTranslations("garageWorkspace.workOrders.quotePanel");
  const tWo = useTranslations("garageWorkspace.workOrders");
  const locale = useLocale() as AppLocale;

  const [itemType, setItemType] = useState<"labor" | "part">("labor");
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("50");

  const quoteTotal = quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleAddQuoteLine = () => {
    const qty = Number(itemQty);
    const price = Number(itemPrice);
    if (itemDesc.trim().length < 2 || !(qty > 0) || !(price >= 0)) {
      toast.error(t("invalidLineError"));
      return;
    }
    const newItem: WorkOrderQuoteItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: itemType,
      description: itemDesc.trim(),
      quantity: qty,
      unitPrice: price,
      totalPrice: Number((qty * price).toFixed(2)),
    };
    setQuoteItems([...quoteItems, newItem]);
    setItemDesc("");
    setItemQty("1");
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          {t("title")}
        </h2>
        <Badge
          variant={
            quoteStatus === "approved"
              ? "success"
              : quoteStatus === "declined"
                ? "destructive"
                : quoteStatus === "pending"
                  ? "warning"
                  : "secondary"
          }
        >
          {t(`status_${quoteStatus}`)}
        </Badge>
      </div>

      {quoteCustomerComment ? (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs">
          <span className="font-semibold text-foreground">
            {t("customerComment")}:{" "}
          </span>
          <span className="text-muted-foreground">{quoteCustomerComment}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="wo-quote-notes">{t("notesLabel")}</Label>
        <Textarea
          id="wo-quote-notes"
          rows={2}
          value={quoteNotes}
          onChange={(e) => setQuoteNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
        />
      </div>

      {/* Draft Quote Line Items */}
      <div className="grid gap-2 rounded-xl border border-border bg-secondary/20 p-3 sm:grid-cols-12">
        <div className="sm:col-span-3">
          <Select
            value={itemType}
            onValueChange={(v) => setItemType(v as "labor" | "part")}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="labor">{tWo("typeLabor")}</SelectItem>
              <SelectItem value="part">{tWo("typePart")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-4">
          <Input
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            placeholder={t("lineDescPlaceholder")}
            className="h-9 text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            type="number"
            min={0.1}
            step="0.1"
            value={itemQty}
            onChange={(e) => setItemQty(e.target.value)}
            className="h-9 font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            className="h-9 font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-full"
            onClick={handleAddQuoteLine}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {quoteItems.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border">
          {quoteItems.map((qi) => (
            <div
              key={qi.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant={qi.type === "labor" ? "default" : "violet"}>
                  {qi.type === "labor" ? tWo("typeLabor") : tWo("typePart")}
                </Badge>
                <span>{qi.description}</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-muted-foreground">
                  {qi.quantity} × {formatCurrency(qi.unitPrice, locale, currency)}
                </span>
                <span className="font-semibold">
                  {formatCurrency(qi.totalPrice, locale, currency)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setQuoteItems(quoteItems.filter((x) => x.id !== qi.id))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div>
          <span className="text-xs text-muted-foreground">{t("quoteTotal")}:</span>{" "}
          <span className="font-mono text-lg font-bold text-foreground">
            {formatCurrency(quoteTotal, locale, currency)}
          </span>
        </div>

        <Button
          type="button"
          variant="gradient"
          size="sm"
          disabled={sendingQuote || quoteItems.length === 0}
          onClick={() => void onSendQuote()}
        >
          {sendingQuote ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {quoteStatus === "pending" ? t("resendBtn") : t("sendBtn")}
        </Button>
      </div>
    </Card>
  );
}

interface DiagnosticsIntakePanelProps {
  intakeFuelLevel: FuelLevel | null;
  setIntakeFuelLevel: (v: FuelLevel | null) => void;
  intakeConditionNotes: string;
  setIntakeConditionNotes: (v: string) => void;
  dtcCodes: DtcDiagnosticCode[];
  setDtcCodes: (codes: DtcDiagnosticCode[]) => void;
  diagnosticNotes: string;
  setDiagnosticNotes: (v: string) => void;
  beforePhotoUrls: string[];
  setBeforePhotoUrls: (urls: string[]) => void;
  afterPhotoUrls: string[];
  setAfterPhotoUrls: (urls: string[]) => void;
}

export function WorkOrderDiagnosticsPanel({
  intakeFuelLevel,
  setIntakeFuelLevel,
  intakeConditionNotes,
  setIntakeConditionNotes,
  dtcCodes,
  setDtcCodes,
  diagnosticNotes,
  setDiagnosticNotes,
  beforePhotoUrls,
  setBeforePhotoUrls,
  afterPhotoUrls,
  setAfterPhotoUrls,
}: DiagnosticsIntakePanelProps) {
  const t = useTranslations("garageWorkspace.workOrders.opsPanel");
  const beforeInputRef = useRef<HTMLInputElement | null>(null);
  const afterInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingKind, setUploadingKind] = useState<"before" | "after" | null>(
    null
  );
  const [dtcCodeInput, setDtcCodeInput] = useState("");
  const [dtcDescInput, setDtcDescInput] = useState("");
  const [dtcSevInput, setDtcSevInput] = useState<DtcSeverity>("warning");

  const handleUploadInspectionPhoto = async (
    kind: "before" | "after",
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB image size.");
      return;
    }

    setUploadingKind(kind);
    try {
      const uploaded = await uploadImageToImgBB(file, "work-order");
      if (kind === "before") {
        setBeforePhotoUrls([...beforePhotoUrls, uploaded.url]);
      } else {
        setAfterPhotoUrls([...afterPhotoUrls, uploaded.url]);
      }
      toast.success(t("photoUploadedToast"));
    } catch {
      toast.error("Photo upload failed.");
    } finally {
      setUploadingKind(null);
      e.target.value = "";
    }
  };

  const handleAddDtc = () => {
    const cleanCode = dtcCodeInput.trim().toUpperCase();
    const cleanDesc = dtcDescInput.trim();
    if (cleanCode.length < 2 || cleanDesc.length < 1) {
      toast.error(t("dtcInvalidError"));
      return;
    }
    setDtcCodes([
      ...dtcCodes,
      { code: cleanCode, description: cleanDesc, severity: dtcSevInput },
    ]);
    setDtcCodeInput("");
    setDtcDescInput("");
  };

  return (
    <div className="space-y-6">
      {/* Intake Fuel & Condition + OBD-II Diagnostics */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Cpu className="h-4 w-4 text-primary" />
          {t("diagnosticsAndIntakeTitle")}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="inline-flex items-center gap-1.5">
              <Fuel className="h-3.5 w-3.5 text-primary" />
              {t("fuelLevelLabel")}
            </Label>
            <Select
              value={intakeFuelLevel ?? "none"}
              onValueChange={(v) =>
                setIntakeFuelLevel(v === "none" ? null : (v as FuelLevel))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {FUEL_LEVELS.map((fl) => (
                  <SelectItem key={fl} value={fl}>
                    {t(`fuel_${fl}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wo-intake-cond">{t("intakeConditionLabel")}</Label>
            <Input
              id="wo-intake-cond"
              value={intakeConditionNotes}
              onChange={(e) => setIntakeConditionNotes(e.target.value)}
              placeholder={t("intakeConditionPlaceholder")}
            />
          </div>
        </div>

        {/* OBD-II DTC Editor */}
        <div className="space-y-2 border-t border-border pt-3">
          <Label>{t("obdTitle")}</Label>
          <div className="grid gap-2 sm:grid-cols-12">
            <Input
              value={dtcCodeInput}
              onChange={(e) => setDtcCodeInput(e.target.value.toUpperCase())}
              placeholder="P0420"
              className="font-mono uppercase sm:col-span-3"
            />
            <Input
              value={dtcDescInput}
              onChange={(e) => setDtcDescInput(e.target.value)}
              placeholder={t("dtcDescPlaceholder")}
              className="sm:col-span-5"
            />
            <div className="sm:col-span-3">
              <Select
                value={dtcSevInput}
                onValueChange={(v) => setDtcSevInput(v as DtcSeverity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DTC_SEVERITIES.map((sev) => (
                    <SelectItem key={sev} value={sev}>
                      {t(`sev_${sev}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="w-full sm:col-span-1"
              onClick={handleAddDtc}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {dtcCodes.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {dtcCodes.map((d, idx) => (
                <Badge
                  key={`${d.code}-${idx}`}
                  variant={
                    d.severity === "critical"
                      ? "destructive"
                      : d.severity === "warning"
                        ? "warning"
                        : "secondary"
                  }
                  className="gap-1.5 py-1 font-mono"
                >
                  <span>
                    {d.code}: {d.description}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDtcCodes(dtcCodes.filter((_, i) => i !== idx))
                    }
                    className="hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wo-diag-notes">{t("diagnosticNotesLabel")}</Label>
          <Textarea
            id="wo-diag-notes"
            rows={2}
            value={diagnosticNotes}
            onChange={(e) => setDiagnosticNotes(e.target.value)}
            placeholder={t("diagnosticNotesPlaceholder")}
          />
        </div>
      </Card>

      {/* Before / After Repair Photos */}
      <Card className="space-y-4 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Before Photos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {t("beforePhotosTitle")} ({beforePhotoUrls.length})
              </h3>
              <input
                ref={beforeInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => void handleUploadInspectionPhoto("before", e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingKind !== null || beforePhotoUrls.length >= 16}
                onClick={() => beforeInputRef.current?.click()}
              >
                {uploadingKind === "before" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                {t("uploadPhotoBtn")}
              </Button>
            </div>

            {beforePhotoUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {beforePhotoUrls.map((url) => (
                  <div
                    key={url}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Before repair"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setBeforePhotoUrls(
                          beforePhotoUrls.filter((u) => u !== url)
                        )
                      }
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* After Photos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {t("afterPhotosTitle")} ({afterPhotoUrls.length})
              </h3>
              <input
                ref={afterInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => void handleUploadInspectionPhoto("after", e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingKind !== null || afterPhotoUrls.length >= 16}
                onClick={() => afterInputRef.current?.click()}
              >
                {uploadingKind === "after" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                {t("uploadPhotoBtn")}
              </Button>
            </div>

            {afterPhotoUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {afterPhotoUrls.map((url) => (
                  <div
                    key={url}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="After repair"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAfterPhotoUrls(
                          afterPhotoUrls.filter((u) => u !== url)
                        )
                      }
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

