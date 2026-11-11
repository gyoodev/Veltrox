"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFirebaseClient } from "@/lib/firebase/client";
import {
  type DiaryEntryFormValues,
  diaryEntryFormSchema,
} from "@/lib/validators/car-diary";
import {
  type AttachmentItem,
  DIARY_CATEGORIES,
  type DiaryCategory,
  type DiaryEntry,
  type Vehicle,
} from "@/types/domain";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/pdf",
];

interface DiaryEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerUid: string;
  vehicles: Vehicle[];
  defaultVehicleId?: string;
  editingEntry?: DiaryEntry | null;
  onSaved: (entry: DiaryEntry, updatedMileageKm?: number) => void;
}

export function DiaryEntryDialog({
  open,
  onOpenChange,
  ownerUid,
  vehicles,
  defaultVehicleId,
  editingEntry = null,
  onSaved,
}: DiaryEntryDialogProps) {
  const t = useTranslations("carDiary.timeline");
  const tCat = useTranslations("carDiary.categories");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const resolvedVehicleId =
    editingEntry?.vehicleId ?? defaultVehicleId ?? vehicles[0]?.id ?? "";
  const activeVehicle = vehicles.find((v) => v.id === resolvedVehicleId);
  const todayStr = new Date().toISOString().slice(0, 10);

  const form = useForm<DiaryEntryFormValues>({
    resolver: zodResolver(diaryEntryFormSchema),
    defaultValues: {
      vehicleId: resolvedVehicleId,
      category: editingEntry?.category ?? "service",
      title: editingEntry?.title ?? "",
      date: editingEntry?.date ?? todayStr,
      mileageKm:
        editingEntry?.mileageKm ?? activeVehicle?.currentMileageKm ?? 0,
      costAmount: editingEntry?.costAmount ?? 0,
      currency: editingEntry?.currency ?? "EUR",
      notes: editingEntry?.notes ?? "",
      attachments: editingEntry?.attachments ?? [],
    },
  });

  useEffect(() => {
    if (open) {
      const targetVehId =
        editingEntry?.vehicleId ?? defaultVehicleId ?? vehicles[0]?.id ?? "";
      const veh = vehicles.find((v) => v.id === targetVehId);
      form.reset({
        vehicleId: targetVehId,
        category: editingEntry?.category ?? "service",
        title: editingEntry?.title ?? "",
        date: editingEntry?.date ?? new Date().toISOString().slice(0, 10),
        mileageKm: editingEntry?.mileageKm ?? veh?.currentMileageKm ?? 0,
        costAmount: editingEntry?.costAmount ?? 0,
        currency: editingEntry?.currency ?? "EUR",
        notes: editingEntry?.notes ?? "",
        attachments: editingEntry?.attachments ?? [],
      });
    }
  }, [defaultVehicleId, editingEntry, form, open, vehicles]);

  const watchedVehicleId = form.watch("vehicleId");
  const attachments = form.watch("attachments") ?? [];

  const translateErr = (key: string | undefined): string | null => {
    if (!key) return null;
    try {
      return tVal(key as Parameters<typeof tVal>[0]);
    } catch {
      return key;
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (!watchedVehicleId) {
      toast.error(tVal("vehicleRequired"));
      return;
    }

    const client = getFirebaseClient();
    if (!client) return;

    setUploading(true);
    try {
      const uploaded: AttachmentItem[] = [];
      const apiKey =
        process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
        "081c67f1d21a81269c6275b692e61030";

      for (const file of files.slice(0, 6 - attachments.length)) {
        if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
          toast.error(tVal("fileRequired"));
          continue;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error("Max 10 MB");
          continue;
        }

        let directUrl: string | null = null;
        let storagePath: string | null = null;

        // If file is an image, upload to ImgBB
        if (file.type.startsWith("image/")) {
          try {
            const imgbbForm = new FormData();
            imgbbForm.append("image", file);
            imgbbForm.append("name", `diary-${Date.now()}`);

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
          } catch {
            // fallback
          }

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
            } catch {
              // fallback to Firebase Storage
            }
          }
        }

        // Fallback to Firebase Storage if direct cloud upload not used or failed
        if (!directUrl || !storagePath) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
          storagePath = `vehicles/${ownerUid}/${watchedVehicleId}/diary/${Date.now()}-${safeName}`;
          const storageRef = ref(client.storage, storagePath);

          await uploadBytes(storageRef, file, {
            contentType: file.type,
            cacheControl: "private,max-age=86400",
          });
          directUrl = await getDownloadURL(storageRef);
        }

        uploaded.push({
          name: file.name,
          url: directUrl,
          storagePath,
          contentType: file.type,
        });
      }

      if (uploaded.length > 0) {
        form.setValue("attachments", [...attachments, ...uploaded], {
          shouldDirty: true,
        });
      }
    } catch {
      toast.error("Attachment upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (storagePath: string) => {
    form.setValue(
      "attachments",
      attachments.filter((a) => a.storagePath !== storagePath),
      { shouldDirty: true }
    );
  };

  const onSubmit = async (values: DiaryEntryFormValues) => {
    const endpoint = editingEntry
      ? `/api/diary/${editingEntry.id}`
      : "/api/diary";
    const method = editingEntry ? "PATCH" : "POST";

    const fb = getFirebaseClient();
    let idToken: string | null = null;
    if (fb?.auth.currentUser) {
      try {
        idToken = await fb.auth.currentUser.getIdToken(false);
      } catch {}
    }

    let res = await fetch(endpoint, {
      method,
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
        res = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${freshIdToken}`,
          },
          body: JSON.stringify(values),
        });
      } catch {}
    }

    if (!res.ok) {
      toast.error("Could not save diary entry.");
      return;
    }

    const json = (await res.json()) as {
      entry: DiaryEntry;
      vehicleMileageKm?: number;
    };
    toast.success(t("savedToast"));
    onSaved(json.entry, json.vehicleMileageKm);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingEntry ? t("editEntry") : t("addEntry")}
          </DialogTitle>
          <DialogDescription>{t("attachmentHint")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 pt-1"
          noValidate
        >
          {!defaultVehicleId && !editingEntry ? (
            <div className="space-y-1.5">
              <Label>{t("vehicleLabel")}</Label>
              <Controller
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label={t("vehicleLabel")}>
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
                )}
              />
            </div>
          ) : null}

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("category")}</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as DiaryCategory)}
                  >
                    <SelectTrigger aria-label={t("category")}>
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
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-date">{t("date")}</Label>
              <Input
                id="entry-date"
                type="date"
                className="font-mono"
                {...form.register("date")}
              />
              {form.formState.errors.date ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.date.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-title">{t("title")}</Label>
            <Input
              id="entry-title"
              placeholder={t("titlePlaceholder")}
              {...form.register("title")}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.title.message)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-mileage">{t("mileage")}</Label>
              <Input
                id="entry-mileage"
                type="number"
                min={0}
                className="font-mono"
                {...form.register("mileageKm", { valueAsNumber: true })}
              />
              {form.formState.errors.mileageKm ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.mileageKm.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-cost">{t("cost")}</Label>
              <Input
                id="entry-cost"
                type="number"
                step="0.01"
                min={0}
                className="font-mono"
                {...form.register("costAmount", { valueAsNumber: true })}
              />
              {form.formState.errors.costAmount ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.costAmount.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>{t("currency")}</Label>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label={t("currency")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="BGN">BGN (лв.)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-notes">{t("notes")}</Label>
            <textarea
              id="entry-notes"
              rows={3}
              placeholder={t("notesPlaceholder")}
              className="flex w-full rounded-xl border border-input bg-surface/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...form.register("notes")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("attachments")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || attachments.length >= 6}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("uploadingReceipts")}
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4" />
                    {t("uploadReceipts")}
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {attachments.length}/6
              </span>
            </div>

            {attachments.length > 0 ? (
              <ul className="space-y-1.5 pt-1">
                {attachments.map((att) => (
                  <li
                    key={att.storagePath}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5 text-xs"
                  >
                    <span className="flex items-center gap-2 truncate text-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{att.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.storagePath)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <DialogFooter className="pt-2">
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
              disabled={form.formState.isSubmitting || uploading}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tCommon("save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

