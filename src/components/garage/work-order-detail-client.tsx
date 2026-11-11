"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  BellRing,
  Camera,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { LinkedVehicleMatch } from "@/lib/data/garage";
import { getFirebaseClient } from "@/lib/firebase/client";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import { formatCurrency } from "@/lib/utils";
import {
  type AppLocale,
  type AttachmentItem,
  type Customer,
  type Garage,
  WORK_ORDER_STATUSES,
  type WorkOrder,
  type WorkOrderItem,
  type WorkOrderStatus,
} from "@/types/domain";

interface WorkOrderDetailClientProps {
  initialGarage: Garage;
  initialWorkOrder: WorkOrder;
  initialItems: WorkOrderItem[];
  customer: Customer | null;
  initialVehicleMatch: LinkedVehicleMatch | null;
  isManager: boolean;
}

export function WorkOrderDetailClient({
  initialGarage,
  initialWorkOrder,
  initialItems,
  customer,
  initialVehicleMatch,
  isManager,
}: WorkOrderDetailClientProps) {
  const t = useTranslations("garageWorkspace.workOrders");
  const tStatuses = useTranslations("garageWorkspace.statuses");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [garage, setGarage] = useState<Garage>(initialGarage);
  const [wo, setWo] = useState<WorkOrder>(initialWorkOrder);
  const [items, setItems] = useState<WorkOrderItem[]>(initialItems);
  const [vehicleMatch, setVehicleMatch] = useState<LinkedVehicleMatch | null>(
    initialVehicleMatch
  );

  // Editable fields
  const [vehicleLabel, setVehicleLabel] = useState(wo.vehicleLabel);
  const [mileageStr, setMileageStr] = useState(
    wo.mileageKm !== null ? String(wo.mileageKm) : ""
  );
  const [customerSummary, setCustomerSummary] = useState(
    wo.customerSummary ?? ""
  );
  const [internalNotes, setInternalNotes] = useState(wo.internalNotes ?? "");
  const [nextServiceDate, setNextServiceDate] = useState(
    wo.nextServiceDate ?? ""
  );
  const [nextServiceKmStr, setNextServiceKmStr] = useState(
    wo.nextServiceMileageKm !== null ? String(wo.nextServiceMileageKm) : ""
  );
  const [photos, setPhotos] = useState<AttachmentItem[]>(
    wo.dropOffPhotos ?? []
  );

  // Line item form state
  const [itemType, setItemType] = useState<"labor" | "part">("labor");
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [requestingLink, setRequestingLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const quotaInfo = getEffectiveReminderQuota(garage);

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/status/${wo.publicStatusToken}`;
    await navigator.clipboard.writeText(url);
    toast.success(t("linkCopiedToast"));
  };

  const handleStatusSelect = async (nextStatus: WorkOrderStatus) => {
    if (nextStatus === wo.status) return;
    const prev = wo.status;
    setWo((cur) => ({ ...cur, status: nextStatus }));

    const res = await fetch(`/api/garage/work-orders/${wo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      setWo((cur) => ({ ...cur, status: prev }));
      toast.error("Failed to update status.");
      return;
    }

    const json = (await res.json()) as { workOrder: WorkOrder; garage: Garage };
    setWo(json.workOrder);
    setGarage(json.garage);
    toast.success(t("savedToast"));
    router.refresh();
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const mileageKm = mileageStr.trim() === "" ? null : Number(mileageStr);
      const nextServiceMileageKm =
        nextServiceKmStr.trim() === "" ? null : Number(nextServiceKmStr);

      const res = await fetch(`/api/garage/work-orders/${wo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleLabel: vehicleLabel.trim() || wo.plateNumber,
          mileageKm:
            mileageKm !== null && Number.isFinite(mileageKm) ? mileageKm : null,
          customerSummary,
          internalNotes,
          dropOffPhotos: photos,
          nextServiceDate: nextServiceDate.trim() || null,
          nextServiceMileageKm:
            nextServiceMileageKm !== null &&
            Number.isFinite(nextServiceMileageKm)
              ? nextServiceMileageKm
              : null,
        }),
      });

      if (res.status === 429) {
        toast.error(t("quotaExceededToast"));
        return;
      }

      if (!res.ok) {
        toast.error("Could not save work order.");
        return;
      }

      const json = (await res.json()) as {
        workOrder: WorkOrder;
        garage: Garage;
      };
      setWo(json.workOrder);
      setGarage(json.garage);
      toast.success(t("savedToast"));
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    const qty = Number(itemQty);
    const price = Number(itemPrice);
    if (itemDesc.trim().length < 2 || !(qty > 0) || !(price >= 0)) {
      toast.error("Enter valid description, quantity, and price.");
      return;
    }

    setAddingItem(true);
    try {
      const res = await fetch(`/api/garage/work-orders/${wo.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: itemType,
          description: itemDesc.trim(),
          quantity: qty,
          unitPrice: price,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to add line item.");
        return;
      }

      const json = (await res.json()) as {
        workOrder: WorkOrder;
        items: WorkOrderItem[];
      };
      setWo(json.workOrder);
      setItems(json.items);
      setItemDesc("");
      setItemQty("1");
      setItemPrice("");
      router.refresh();
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const prevItems = items;
    setItems((list) => list.filter((i) => i.id !== itemId));

    const res = await fetch(
      `/api/garage/work-orders/${wo.id}/items?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      setItems(prevItems);
      toast.error("Could not delete item.");
      return;
    }

    const json = (await res.json()) as {
      workOrder: WorkOrder;
      items: WorkOrderItem[];
    };
    setWo(json.workOrder);
    setItems(json.items);
    router.refresh();
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB photo size.");
      return;
    }

    const fb = getFirebaseClient();
    if (!fb) return;

    setUploadingPhoto(true);
    try {
      let directUrl: string | null = null;
      let storagePath: string | null = null;

      const apiKey =
        process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
        "081c67f1d21a81269c6275b692e61030";

      // 1. Direct ImgBB Cloud upload
      try {
        const imgbbForm = new FormData();
        imgbbForm.append("image", file);
        imgbbForm.append("name", `work-order-${wo.id}-${Date.now()}`);

        const imgbbRes = await fetch(
          `https://api.imgbb.com/1/upload?key=${apiKey}`,
          { method: "POST", body: imgbbForm }
        );
        if (imgbbRes.ok) {
          const imgbbJson = (await imgbbRes.json()) as {
            data?: { id: string; url: string; display_url: string };
            success: boolean;
          };
          if (imgbbJson.success && imgbbJson.data) {
            directUrl = imgbbJson.data.display_url || imgbbJson.data.url;
            storagePath = `imgbb:${imgbbJson.data.id}`;
          }
        }
      } catch {}

      // 2. Server proxy fallback
      if (!directUrl) {
        try {
          const proxyForm = new FormData();
          proxyForm.append("file", file);
          const proxyRes = await fetch("/api/vehicles/upload-photo", {
            method: "POST",
            body: proxyForm,
          });
          if (proxyRes.ok) {
            const proxyJson = (await proxyRes.json()) as {
              url: string;
              storagePath: string;
            };
            directUrl = proxyJson.url;
            storagePath = proxyJson.storagePath;
          }
        } catch {}
      }

      // 3. Fallback to Firebase Storage
      if (!directUrl || !storagePath) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        storagePath = `garages/${garage.id}/workOrders/${wo.id}/${Date.now()}-${safeName}`;
        const storageRef = ref(fb.storage, storagePath);
        await uploadBytes(storageRef, file, { contentType: file.type });
        directUrl = await getDownloadURL(storageRef);
      }

      const nextPhotos: AttachmentItem[] = [
        ...photos,
        {
          name: file.name,
          url: directUrl,
          storagePath,
          contentType: file.type,
        },
      ];
      setPhotos(nextPhotos);

      let idToken: string | null = null;
      if (fb?.auth.currentUser) {
        try {
          idToken = await fb.auth.currentUser.getIdToken(false);
        } catch {}
      }

      const res = await fetch(`/api/garage/work-orders/${wo.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ dropOffPhotos: nextPhotos }),
      });
      if (res.ok) {
        const json = (await res.json()) as { workOrder: WorkOrder };
        setWo(json.workOrder);
        toast.success("Снимката е запазена успешно.");
      }
    } catch {
      toast.error("Photo upload failed.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (storagePath: string) => {
    const nextPhotos = photos.filter((p) => p.storagePath !== storagePath);
    setPhotos(nextPhotos);
    await fetch(`/api/garage/work-orders/${wo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dropOffPhotos: nextPhotos }),
    });
  };

  const handleRequestDiaryLink = async () => {
    setRequestingLink(true);
    try {
      const res = await fetch("/api/garage/vehicle-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plateNumber: wo.plateNumber }),
      });

      if (!res.ok) {
        toast.error("Could not send link request.");
        return;
      }

      if (vehicleMatch) {
        setVehicleMatch({ ...vehicleMatch, linkState: "pending" });
      }
      toast.success(t("linkRequestedToast"));
    } finally {
      setRequestingLink(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await fetch(`/api/garage/work-orders/${wo.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete work order.");
      return;
    }
    router.push("/garage/work-orders");
    router.refresh();
  };

  const activeStageIndex = WORK_ORDER_STATUSES.indexOf(wo.status);

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/garage/work-orders">
            <ArrowLeft className="h-4 w-4" />
            {t("backToOrders")}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyPublicLink()}
          >
            <Copy className="h-4 w-4 text-primary" />
            {t("copyPublicLink")}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/status/${wo.publicStatusToken}`} target="_blank">
              {t("openPublicLink")}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {isManager ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void handleDeleteOrder()}
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteOrderBtn")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Header + 6-Stage Status Pipeline */}
      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-xl border border-primary/35 bg-primary/15 px-3 py-1 font-mono text-sm font-bold tracking-wider text-foreground">
                {wo.plateNumber}
              </span>
              <h1 className="text-2xl font-bold text-foreground">
                {wo.vehicleLabel}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {customer ? (
                <Link
                  href={`/garage/customers/${customer.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {customer.fullName}
                </Link>
              ) : (
                wo.customerName ?? "—"
              )}{" "}
              • {wo.customerPhone ?? ""}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("grandTotal")}
            </p>
            <p className="font-mono text-3xl font-extrabold text-foreground">
              {formatCurrency(wo.totalAmount, locale, wo.currency)}
            </p>
          </div>
        </div>

        {/* Interactive 6-Status Stepper */}
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("statusPipeline")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {WORK_ORDER_STATUSES.map((st, idx) => {
              const isCurrent = wo.status === st;
              const isPassed = idx < activeStageIndex;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => void handleStatusSelect(st)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    isCurrent
                      ? "border-primary bg-veltrox-gradient text-white shadow-glow-blue"
                      : isPassed
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isPassed ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  <span className="truncate">{tStatuses(st)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Car Owner Diary Link Banner */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("diarySyncTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {!vehicleMatch
                  ? t("diaryNotRegistered")
                  : vehicleMatch.linkState === "linked"
                    ? t("diaryLinked")
                    : vehicleMatch.linkState === "pending"
                      ? t("diaryPending")
                      : t("diaryUnlinked")}
              </p>
            </div>
          </div>

          {vehicleMatch?.linkState === "linked" ? (
            <Badge variant="success">
              <Sparkles className="h-3 w-3" />
              Linked
            </Badge>
          ) : vehicleMatch?.linkState === "pending" ? (
            <Badge variant="warning">Pending</Badge>
          ) : vehicleMatch?.linkState === "unlinked" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={requestingLink}
              onClick={() => void handleRequestDiaryLink()}
            >
              {requestingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 text-primary" />
              )}
              {t("requestDiaryLinkBtn")}
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Line Items: Labor & Parts */}
      <Card className="space-y-4 p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t("lineItemsTitle")}
        </h2>

        {/* Add Line Item Row */}
        <div className="grid gap-2.5 sm:grid-cols-12">
          <div className="sm:col-span-2">
            <Select
              value={itemType}
              onValueChange={(v) => setItemType(v as "labor" | "part")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="labor">{t("typeLabor")}</SelectItem>
                <SelectItem value="part">{t("typePart")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-5">
            <Input
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              placeholder={t("itemDescPlaceholder")}
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={itemQty}
              onChange={(e) => setItemQty(e.target.value)}
              placeholder={t("qty")}
              className="font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder={t("unitPrice")}
              className="font-mono"
            />
          </div>

          <div className="sm:col-span-1">
            <Button
              type="button"
              variant="gradient"
              className="w-full"
              disabled={addingItem}
              aria-label={t("addItemBtn")}
              onClick={() => void handleAddItem()}
            >
              {addingItem ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("emptyItems")}
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Badge
                    variant={item.type === "labor" ? "default" : "violet"}
                  >
                    {item.type === "labor" ? t("typeLabor") : t("typePart")}
                  </Badge>
                  <span className="font-medium text-foreground">
                    {item.description}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.quantity} ×{" "}
                    {formatCurrency(item.unitPrice, locale, wo.currency)}
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(item.totalPrice, locale, wo.currency)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDeleteItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-6 border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">
            {t("laborSubtotal")}:{" "}
            <strong className="font-mono text-foreground">
              {formatCurrency(wo.totalLaborAmount, locale, wo.currency)}
            </strong>
          </span>
          <span className="text-muted-foreground">
            {t("partsSubtotal")}:{" "}
            <strong className="font-mono text-foreground">
              {formatCurrency(wo.totalPartsAmount, locale, wo.currency)}
            </strong>
          </span>
          <span className="text-muted-foreground">
            {t("grandTotal")}:{" "}
            <strong className="font-mono text-base text-primary">
              {formatCurrency(wo.totalAmount, locale, wo.currency)}
            </strong>
          </span>
        </div>
      </Card>

      {/* Vehicle Info, Summaries, Private Notes, Drop-off Photos & Automatic Return Reminder */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="space-y-4 p-6 lg:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wo-veh-label">{t("vehicleLabel")}</Label>
              <Input
                id="wo-veh-label"
                value={vehicleLabel}
                onChange={(e) => setVehicleLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-mileage">{t("mileageLabel")}</Label>
              <Input
                id="wo-mileage"
                type="number"
                min={0}
                value={mileageStr}
                onChange={(e) => setMileageStr(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wo-summary">{t("customerSummaryTitle")}</Label>
            <textarea
              id="wo-summary"
              rows={3}
              value={customerSummary}
              onChange={(e) => setCustomerSummary(e.target.value)}
              className="flex w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="wo-internal"
              className="flex items-center gap-1.5 text-orange-400"
            >
              <Lock className="h-3.5 w-3.5" />
              {t("internalNotesTitle")}
            </Label>
            <textarea
              id="wo-internal"
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="flex w-full rounded-xl border border-orange-500/25 bg-orange-500/5 px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("internalNotesHint")}
            </p>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          {/* Automatic Return Reminder */}
          <Card className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <BellRing className="h-4 w-4 text-primary" />
                  {t("autoReminderTitle")}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("autoReminderDesc")}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-[11px]">
                {quotaInfo.used}/{quotaInfo.quota}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wo-next-date">{t("nextDateLabel")}</Label>
                <Input
                  id="wo-next-date"
                  type="date"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wo-next-km">{t("nextMileageLabel")}</Label>
                <Input
                  id="wo-next-km"
                  type="number"
                  min={1}
                  placeholder="165000"
                  value={nextServiceKmStr}
                  onChange={(e) => setNextServiceKmStr(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </Card>

          {/* Drop-off Photos */}
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                {t("dropOffPhotosTitle")} ({photos.length})
              </h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => void handlePhotoUpload(e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingPhoto || photos.length >= 8}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {uploadingPhoto ? t("uploadingPhoto") : t("uploadPhoto")}
              </Button>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2.5">
                {photos.map((photo) => (
                  <div
                    key={photo.storagePath}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                  >
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="h-full w-full object-cover"
                      />
                    </a>
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => void handleRemovePhoto(photo.storagePath)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/75 p-1 text-white opacity-80 hover:bg-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      {/* Sticky / Bottom Save Action */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="gradient"
          size="lg"
          disabled={saving}
          onClick={() => void handleSaveDetails()}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t("saveDetailsBtn")}
        </Button>
      </div>
    </div>
  );
}

