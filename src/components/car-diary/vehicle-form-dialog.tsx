"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Camera, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { CarSelectCombobox } from "@/components/car-diary/car-select-combobox";
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
import { getAllCarMakes, getModelsForMake, POPULAR_MAKES } from "@/lib/car-data";
import { getFirebaseClient } from "@/lib/firebase/client";
import {
  type VehicleFormValues,
  vehicleFormSchema,
} from "@/lib/validators/car-diary";
import { FUEL_TYPES, type FuelType, type Vehicle } from "@/types/domain";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerUid: string;
  editingVehicle?: Vehicle | null;
  onSaved: (vehicle: Vehicle) => void;
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  ownerUid,
  editingVehicle = null,
  onSaved,
}: VehicleFormDialogProps) {
  const t = useTranslations("carDiary.cars");
  const tFuel = useTranslations("carDiary.fuelTypes");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      make: editingVehicle?.make ?? "",
      model: editingVehicle?.model ?? "",
      year: editingVehicle?.year ?? new Date().getFullYear(),
      plateNumber: editingVehicle?.plateNumber ?? "",
      vin: editingVehicle?.vin ?? "",
      fuelType: editingVehicle?.fuelType ?? "petrol",
      currentMileageKm: editingVehicle?.currentMileageKm ?? 0,
      photoUrl: editingVehicle?.photoUrl ?? null,
      photoStoragePath: editingVehicle?.photoStoragePath ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        make: editingVehicle?.make ?? "",
        model: editingVehicle?.model ?? "",
        year: editingVehicle?.year ?? new Date().getFullYear(),
        plateNumber: editingVehicle?.plateNumber ?? "",
        vin: editingVehicle?.vin ?? "",
        fuelType: editingVehicle?.fuelType ?? "petrol",
        currentMileageKm: editingVehicle?.currentMileageKm ?? 0,
        photoUrl: editingVehicle?.photoUrl ?? null,
        photoStoragePath: editingVehicle?.photoStoragePath ?? null,
      });
    }
  }, [editingVehicle, form, open]);

  const photoPreview = form.watch("photoUrl");
  const currentMake = form.watch("make");

  const allMakes = useMemo(() => getAllCarMakes(), []);

  const makeGroups = useMemo(
    () => [
      {
        title: t("popularMakesGroup"),
        items: POPULAR_MAKES,
      },
      {
        title: t("allMakesGroup"),
        items: allMakes,
      },
    ],
    [allMakes, t]
  );

  const availableModels = useMemo(() => {
    if (!currentMake) return [];
    return getModelsForMake(currentMake);
  }, [currentMake]);

  const translateErr = (key: string | undefined): string | null => {
    if (!key) return null;
    try {
      return tVal(key as Parameters<typeof tVal>[0]);
    } catch {
      return key;
    }
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(tVal("fileRequired"));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Max 8 MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      // 1. Upload directly to public folder (public/uploads/cars)
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/vehicles/upload-photo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          url: string;
          storagePath: string;
        };
        form.setValue("photoUrl", json.url, { shouldDirty: true });
        form.setValue("photoStoragePath", json.storagePath, {
          shouldDirty: true,
        });
        toast.success(t("photoUploadedToast") || "Снимката е качена успешно");
        return;
      }

      // 2. Fallback to Firebase Storage if local route is not available
      const client = getFirebaseClient();
      if (client?.storage) {
        const ext =
          file.name
            .split(".")
            .pop()
            ?.replace(/[^a-zA-Z0-9]/g, "") || "webp";
        const folderSegment = editingVehicle?.id ?? "cover";
        const storagePath = `vehicles/${ownerUid}/${folderSegment}/photo-${Date.now()}.${ext}`;
        const storageRef = ref(client.storage, storagePath);

        await uploadBytes(storageRef, file, {
          contentType: file.type,
          cacheControl: "public,max-age=86400",
        });
        const url = await getDownloadURL(storageRef);

        form.setValue("photoUrl", url, { shouldDirty: true });
        form.setValue("photoStoragePath", storagePath, { shouldDirty: true });
        toast.success(t("photoUploadedToast") || "Снимката е качена успешно");
        return;
      }

      throw new Error("Upload failed");
    } catch (err) {
      console.error("Vehicle photo upload failed:", err);
      toast.error("Photo upload failed.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (values: VehicleFormValues) => {
    const endpoint = editingVehicle
      ? `/api/vehicles/${editingVehicle.id}`
      : "/api/vehicles";
    const method = editingVehicle ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      toast.error("Failed to save vehicle.");
      return;
    }

    const json = (await response.json()) as { vehicle: Vehicle };
    toast.success(t("savedToast"));
    onSaved(json.vehicle);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingVehicle ? t("editVehicle") : t("addVehicle")}
          </DialogTitle>
          <DialogDescription>{t("pageSubtitle")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 pt-1"
          noValidate
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="make"
              render={({ field }) => (
                <CarSelectCombobox
                  id="veh-make"
                  label={t("make")}
                  value={field.value ?? ""}
                  onChange={(val) => {
                    field.onChange(val);
                    // If current model does not exist in new make's catalog, clear it
                    const newModels = getModelsForMake(val);
                    const currentModel = form.getValues("model");
                    if (
                      newModels.length > 0 &&
                      currentModel &&
                      !newModels.some(
                        (m) => m.toLowerCase() === currentModel.toLowerCase()
                      )
                    ) {
                      form.setValue("model", "", { shouldValidate: true });
                    }
                  }}
                  placeholder={t("selectMakePrompt")}
                  searchPlaceholder={t("searchMakePlaceholder")}
                  groups={makeGroups}
                  otherOptionLabel={t("otherMakeOption")}
                  customInputLabel={t("customMakeLabel")}
                  customInputPlaceholder={t("customMakePlaceholder")}
                  formatCustomPrompt={(q) => t("useCustomMake", { query: q })}
                  noResultsText={t("noMakesFound")}
                  badgeText={`${allMakes.length} марки`}
                  error={translateErr(form.formState.errors.make?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="model"
              render={({ field }) => {
                const isMakeSelected = Boolean(
                  currentMake && currentMake.trim().length > 0
                );
                const hasCatalogModels = availableModels.length > 0;

                return (
                  <CarSelectCombobox
                    id="veh-model"
                    label={t("model")}
                    value={field.value ?? ""}
                    onChange={(val) => field.onChange(val)}
                    disabled={!isMakeSelected}
                    disabledReason={t("selectMakeFirst")}
                    placeholder={
                      isMakeSelected
                        ? t("selectModelPrompt")
                        : t("selectMakeFirst")
                    }
                    searchPlaceholder={t("searchModelPlaceholder")}
                    items={hasCatalogModels ? availableModels : undefined}
                    otherOptionLabel={t("otherModelOption")}
                    customInputLabel={t("customModelLabel")}
                    customInputPlaceholder={t("customModelPlaceholder")}
                    formatCustomPrompt={(q) => t("useCustomModel", { query: q })}
                    noResultsText={t("noModelsFound")}
                    badgeText={
                      hasCatalogModels
                        ? t("modelsAvailable", {
                            count: availableModels.length,
                          })
                        : undefined
                    }
                    error={translateErr(form.formState.errors.model?.message)}
                  />
                );
              }}
            />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="veh-plate">{t("plate")}</Label>
              <Input
                id="veh-plate"
                placeholder={t("platePlaceholder")}
                className="font-mono uppercase"
                {...form.register("plateNumber")}
              />
              {form.formState.errors.plateNumber ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.plateNumber.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="veh-year">{t("year")}</Label>
              <Input
                id="veh-year"
                type="number"
                className="font-mono"
                {...form.register("year", { valueAsNumber: true })}
              />
              {form.formState.errors.year ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.year.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("fuelType")}</Label>
              <Controller
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as FuelType)}
                  >
                    <SelectTrigger aria-label={t("fuelType")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((ft) => (
                        <SelectItem key={ft} value={ft}>
                          {tFuel(ft)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="veh-mileage">{t("currentMileage")}</Label>
              <Input
                id="veh-mileage"
                type="number"
                min={0}
                className="font-mono"
                {...form.register("currentMileageKm", { valueAsNumber: true })}
              />
              {form.formState.errors.currentMileageKm ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.currentMileageKm.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="veh-vin">{t("vin")}</Label>
            <Input
              id="veh-vin"
              maxLength={17}
              placeholder={t("vinPlaceholder")}
              className="font-mono uppercase"
              {...form.register("vin")}
            />
            {form.formState.errors.vin ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.vin.message)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("vehiclePhoto")}</Label>
            <div className="flex flex-wrap items-center gap-3">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Vehicle preview"
                  className="h-16 w-24 rounded-xl border border-border object-cover"
                />
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("uploadingPhoto")}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    {t("uploadPhoto")}
                  </>
                )}
              </Button>
              {photoPreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    form.setValue("photoUrl", null);
                    form.setValue("photoStoragePath", null);
                  }}
                >
                  {t("removePhoto")}
                </Button>
              ) : null}
            </div>
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
              disabled={form.formState.isSubmitting || uploadingPhoto}
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

