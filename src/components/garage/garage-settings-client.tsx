"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  Building2,
  Camera,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getFirebaseClient } from "@/lib/firebase/client";
import { getEffectiveReminderQuota } from "@/lib/garage-utils";
import {
  type GarageOnboardingValues,
  garageOnboardingSchema,
} from "@/lib/validators/garage";
import { DAYS_OF_WEEK, type Garage } from "@/types/domain";

interface GarageSettingsClientProps {
  initialGarage: Garage;
}

export function GarageSettingsClient({
  initialGarage,
}: GarageSettingsClientProps) {
  const t = useTranslations("garageWorkspace.settings");
  const tOb = useTranslations("garageWorkspace.onboarding");
  const tDays = useTranslations("carDiary.garagesDir.days");
  const router = useRouter();

  const [garage, setGarage] = useState<Garage>(initialGarage);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const [customService, setCustomService] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<GarageOnboardingValues>({
    resolver: zodResolver(garageOnboardingSchema),
    defaultValues: {
      name: garage.name,
      description: garage.description ?? "",
      city: garage.city,
      address: garage.address,
      phone: garage.phone,
      email: garage.email,
      workingHours: garage.workingHours,
      servicesOffered: garage.servicesOffered,
      logoUrl: garage.logoUrl,
      logoStoragePath: garage.logoStoragePath ?? null,
    },
  });

  const workingHours = form.watch("workingHours");
  const servicesOffered = form.watch("servicesOffered");
  const logoUrl = form.watch("logoUrl");

  const quotaInfo = getEffectiveReminderQuota(garage);
  const usagePct =
    quotaInfo.quota > 0
      ? Math.min(100, Math.round((quotaInfo.used / quotaInfo.quota) * 100))
      : 0;

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB image size.");
      return;
    }

    setUploadingLogo(true);
    try {
      const apiKey =
        process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
        "081c67f1d21a81269c6275b692e61030";

      // 1. Direct ImgBB Cloud upload
      try {
        const imgbbForm = new FormData();
        imgbbForm.append("image", file);
        imgbbForm.append("name", `garage-logo-${Date.now()}`);

        const imgbbRes = await fetch(
          `https://api.imgbb.com/1/upload?key=${apiKey}`,
          {
            method: "POST",
            body: imgbbForm,
          }
        );

        if (imgbbRes.ok) {
          const imgbbJson = (await imgbbRes.json()) as {
            data?: { id: string; url: string; display_url: string };
            success: boolean;
          };
          if (imgbbJson.success && imgbbJson.data) {
            const cloudUrl = imgbbJson.data.display_url || imgbbJson.data.url;
            const path = `imgbb:${imgbbJson.data.id}`;
            form.setValue("logoUrl", cloudUrl, { shouldDirty: true });
            form.setValue("logoStoragePath", path, { shouldDirty: true });
            toast.success("Логото е качено успешно!");
            return;
          }
        }
      } catch (cloudErr) {
        console.warn("Direct logo upload to ImgBB failed, using fallback:", cloudErr);
      }

      // 2. Server proxy fallback
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
        form.setValue("logoUrl", json.url, { shouldDirty: true });
        form.setValue("logoStoragePath", json.storagePath, { shouldDirty: true });
        toast.success("Логото е качено успешно!");
        return;
      }

      // 3. Fallback to Firebase Storage
      const fb = getFirebaseClient();
      if (fb?.storage) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `garages/${garage.id}/logo/${Date.now()}-${safeName}`;
        const storageRef = ref(fb.storage, storagePath);
        await uploadBytes(storageRef, file, { contentType: file.type });
        const url = await getDownloadURL(storageRef);
        form.setValue("logoUrl", url, { shouldDirty: true });
        form.setValue("logoStoragePath", storagePath, { shouldDirty: true });
        toast.success("Логото е качено успешно!");
        return;
      }

      toast.error("Failed to upload logo.");
    } catch {
      toast.error("Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSwitchPlan = async () => {
    const targetPlan = garage.plan === "pro" ? "free" : "pro";
    setSwitchingPlan(true);
    try {
      const res = await fetch("/api/garage/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      if (!res.ok) {
        toast.error("Could not update plan.");
        return;
      }
      const json = (await res.json()) as { garage: Garage };
      setGarage(json.garage);
      toast.success(t("savedToast"));
      router.refresh();
    } finally {
      setSwitchingPlan(false);
    }
  };

  const addService = () => {
    const trimmed = customService.trim();
    if (trimmed.length < 2) return;
    if (!servicesOffered.includes(trimmed)) {
      form.setValue("servicesOffered", [...servicesOffered, trimmed], {
        shouldValidate: true,
      });
    }
    setCustomService("");
  };

  const removeService = (svc: string) => {
    form.setValue(
      "servicesOffered",
      servicesOffered.filter((s) => s !== svc),
      { shouldValidate: true }
    );
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await fetch("/api/garage/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Could not save settings.");
      return;
    }

    const json = (await res.json()) as { garage: Garage };
    setGarage(json.garage);
    toast.success(t("savedToast"));
    router.refresh();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/garages/${garage.slug}`} target="_blank">
            /garages/{garage.slug}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Plan & Monthly Reminder Quota Card */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {t("planCardTitle")}
              </h2>
              <Badge variant={garage.plan === "pro" ? "violet" : "default"}>
                <Sparkles className="h-3 w-3" />
                {garage.plan === "pro" ? t("planPro") : t("planFree")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("quotaUsed", {
                used: quotaInfo.used,
                quota: quotaInfo.quota,
              })}
            </p>
          </div>

          <Button
            type="button"
            variant={garage.plan === "pro" ? "outline" : "gradient"}
            size="sm"
            disabled={switchingPlan}
            onClick={() => void handleSwitchPlan()}
          >
            {switchingPlan ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {garage.plan === "pro" ? t("switchPlanFree") : t("switchPlanPro")}
          </Button>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-veltrox-gradient transition-all"
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </Card>

      {/* Main Settings Form */}
      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-4 border-b border-border pb-5">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={garage.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-7 w-7" />
              )}
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => void handleLogoUpload(e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {uploadingLogo ? tOb("uploadingLogo") : tOb("uploadLogo")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">{tOb("garageName")}</Label>
              <Input id="set-name" {...form.register("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-city">{tOb("city")}</Label>
              <Input id="set-city" {...form.register("city")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="set-address">{tOb("address")}</Label>
              <Input id="set-address" {...form.register("address")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-phone">{tOb("phone")}</Label>
              <Input id="set-phone" {...form.register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-email">{tOb("email")}</Label>
              <Input id="set-email" type="email" {...form.register("email")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-desc">{tOb("description")}</Label>
            <textarea
              id="set-desc"
              rows={2}
              className="flex w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...form.register("description")}
            />
          </div>
        </Card>

        {/* Services Offered */}
        <Card className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Wrench className="h-4 w-4 text-primary" />
            {tOb("step3").replace(/^\d+\.\s*/, "")}
          </h2>

          <div className="flex gap-2">
            <Input
              value={customService}
              onChange={(e) => setCustomService(e.target.value)}
              placeholder={tOb("customServicePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addService();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addService}>
              <Plus className="h-4 w-4" />
              {tOb("addService")}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {servicesOffered.map((svc) => (
              <Badge key={svc} variant="default" className="gap-1.5 py-1">
                {svc}
                <button
                  type="button"
                  aria-label={`Remove ${svc}`}
                  onClick={() => removeService(svc)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Working Hours */}
        <Card className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            {tOb("step2").replace(/^\d+\.\s*/, "")}
          </h2>

          <div className="divide-y divide-border">
            {DAYS_OF_WEEK.map((day) => {
              const slot = workingHours[day];
              return (
                <div
                  key={day}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <span className="w-28 text-sm font-medium text-foreground">
                    {tDays(day)}
                  </span>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!slot.closed}
                      onCheckedChange={(checked) =>
                        form.setValue(`workingHours.${day}.closed`, !checked)
                      }
                    />
                    <span className="w-16 text-xs text-muted-foreground">
                      {slot.closed ? tOb("closedDay") : "Open"}
                    </span>
                  </div>

                  {!slot.closed ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot.open}
                        onChange={(e) =>
                          form.setValue(
                            `workingHours.${day}.open`,
                            e.target.value
                          )
                        }
                        className="h-9 w-28 font-mono text-xs"
                      />
                      <span>–</span>
                      <Input
                        type="time"
                        value={slot.close}
                        onChange={(e) =>
                          form.setValue(
                            `workingHours.${day}.close`,
                            e.target.value
                          )
                        }
                        className="h-9 w-28 font-mono text-xs"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="gradient"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("saveSettings")}
          </Button>
        </div>
      </form>
    </div>
  );
}

