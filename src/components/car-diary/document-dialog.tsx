"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { uploadImageToImgBB } from "@/lib/imgbb";
import { FolderLock, Loader2, Upload } from "lucide-react";
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
  type DocumentFormValues,
  documentFormSchema,
} from "@/lib/validators/car-diary";
import {
  DOCUMENT_TYPES,
  type Vehicle,
  type VehicleDocument,
  type VehicleDocumentType,
} from "@/types/domain";

const MAX_DOC_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

interface DocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerUid: string;
  vehicles: Vehicle[];
  defaultVehicleId?: string;
  onSaved: (doc: VehicleDocument) => void;
}

export function DocumentDialog({
  open,
  onOpenChange,
  ownerUid: _ownerUid,
  vehicles,
  defaultVehicleId,
  onSaved,
}: DocumentDialogProps) {
  const t = useTranslations("carDiary.documents");
  const tDocTypes = useTranslations("carDiary.docTypes");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const initialVehId = defaultVehicleId ?? vehicles[0]?.id ?? "";

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      vehicleId: initialVehId,
      docType: "insurance",
      title: "",
      fileName: "",
      contentType: "",
      fileUrl: "",
      storagePath: "",
      expiryDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        vehicleId: defaultVehicleId ?? vehicles[0]?.id ?? "",
        docType: "insurance",
        title: "",
        fileName: "",
        contentType: "",
        fileUrl: "",
        storagePath: "",
        expiryDate: "",
        notes: "",
      });
    }
  }, [defaultVehicleId, form, open, vehicles]);

  const watchedVehicleId = form.watch("vehicleId");
  const watchedFileName = form.watch("fileName");

  const translateErr = (key: string | undefined): string | null => {
    if (!key) return null;
    try {
      return tVal(key as Parameters<typeof tVal>[0]);
    } catch {
      return key;
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!watchedVehicleId) {
      toast.error(tVal("vehicleRequired"));
      return;
    }
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      toast.error(tVal("fileRequired"));
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      toast.error("Max 10 MB");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadImageToImgBB(file, "doc");
      form.setValue("fileName", file.name, { shouldValidate: true });
      form.setValue("contentType", file.type, { shouldValidate: true });
      form.setValue("fileUrl", result.url, { shouldValidate: true });
      form.setValue("storagePath", result.storagePath, { shouldValidate: true });
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^.]+$/, ""), {
          shouldValidate: true,
        });
      }
    } catch {
      toast.error("Document upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (values: DocumentFormValues) => {
    const fb = getFirebaseClient();
    let idToken: string | null = null;
    if (fb?.auth.currentUser) {
      try {
        idToken = await fb.auth.currentUser.getIdToken(false);
      } catch {}
    }

    let res = await fetch("/api/documents", {
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
        res = await fetch("/api/documents", {
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
      toast.error("Could not save document.");
      return;
    }

    const json = (await res.json()) as { document: VehicleDocument };
    toast.success(t("savedToast"));
    onSaved(json.document);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderLock className="h-5 w-5 text-primary" />
            {t("addDocument")}
          </DialogTitle>
          <DialogDescription>{t("pageSubtitle")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 pt-1"
          noValidate
        >
          {!defaultVehicleId ? (
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
              <Label>{t("docType")}</Label>
              <Controller
                control={form.control}
                name="docType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as VehicleDocumentType)
                    }
                  >
                    <SelectTrigger aria-label={t("docType")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          {tDocTypes(dt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-expiry">{t("expiryDate")}</Label>
              <Input
                id="doc-expiry"
                type="date"
                className="font-mono"
                {...form.register("expiryDate")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-title">{t("title")}</Label>
            <Input
              id="doc-title"
              placeholder={t("titlePlaceholder")}
              {...form.register("title")}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.title.message)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("uploadingFile")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {t("selectFile")}
                </>
              )}
            </Button>

            {watchedFileName ? (
              <p className="text-xs font-medium text-emerald-500">
                {t("fileReady", { name: watchedFileName })}
              </p>
            ) : null}

            {form.formState.errors.fileUrl ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.fileUrl.message)}
              </p>
            ) : null}
          </div>

          <DialogFooter className="pt-3 sticky bottom-0 bg-popover/95 backdrop-blur-md border-t border-border/40 pb-1 mt-2 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto min-h-10"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={form.formState.isSubmitting || uploading}
              className="w-full sm:w-auto min-h-10 font-semibold"
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

