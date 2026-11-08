"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  Clock,
  Loader2,
  Plus,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
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
import { buildDefaultWorkingHours } from "@/lib/garage-utils";
import {
  type GarageOnboardingValues,
  garageOnboardingSchema,
} from "@/lib/validators/garage";
import { DAYS_OF_WEEK, type Garage, type UserProfile } from "@/types/domain";

const PRESET_SERVICE_KEYS = [
  "oil",
  "diagnostics",
  "brakes",
  "suspension",
  "timing",
  "ac",
  "tyres",
  "electrical",
] as const;

interface OnboardingWizardProps {
  profile: UserProfile;
}

export function OnboardingWizard({ profile }: OnboardingWizardProps) {
  const t = useTranslations("garageWorkspace.onboarding");
  const tPresets = useTranslations("garageWorkspace.presetServices");
  const tDays = useTranslations("carDiary.garagesDir.days");
  const tVal = useTranslations("validation");
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [customService, setCustomService] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const defaultServices = [tPresets("oil"), tPresets("diagnostics"), tPresets("brakes")];

  const form = useForm<GarageOnboardingValues>({
    resolver: zodResolver(garageOnboardingSchema),
    defaultValues: {
      name: "",
      description: "",
      city: "",
      address: "",
      phone: profile.phone ?? "",
      email: profile.email,
      workingHours: buildDefaultWorkingHours(),
      servicesOffered: defaultServices,
      logoUrl: null,
      logoStoragePath: null,
    },
  });

  const workingHours = form.watch("workingHours");
  const servicesOffered = form.watch("servicesOffered");

  const translateErr = (key?: string) => {
    if (!key) return null;
    try {
      return tVal(key as never);
    } catch {
      return key;
    }
  };

  const handleCopyMondayToWeekdays = () => {
    const mon = workingHours.mon;
    for (const day of ["tue", "wed", "thu", "fri"] as const) {
      form.setValue(`workingHours.${day}`, { ...mon }, { shouldDirty: true });
    }
  };

  const toggleService = (label: string) => {
    const exists = servicesOffered.includes(label);
    const next = exists
      ? servicesOffered.filter((s) => s !== label)
      : [...servicesOffered, label];
    form.setValue("servicesOffered", next, { shouldValidate: true });
  };

  const addCustomService = () => {
    const trimmed = customService.trim();
    if (trimmed.length < 2) return;
    if (!servicesOffered.includes(trimmed)) {
      form.setValue("servicesOffered", [...servicesOffered, trimmed], {
        shouldValidate: true,
      });
    }
    setCustomService("");
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5 MB image size.");
      return;
    }
    setSelectedLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  };

  const goNextStep = async () => {
    if (step === 1) {
      const valid = await form.trigger([
        "name",
        "city",
        "address",
        "phone",
        "email",
        "description",
      ]);
      if (valid) setStep(2);
      return;
    }
    if (step === 2) {
      const valid = await form.trigger("workingHours");
      if (valid) setStep(3);
      return;
    }
    if (step === 3) {
      const valid = await form.trigger("servicesOffered");
      if (valid) setStep(4);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await fetch("/api/garage/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Could not complete garage onboarding.");
      return;
    }

    const json = (await res.json()) as { garage: Garage };
    const createdGarage = json.garage;

    // Refresh Firebase ID token so client Storage rules immediately see `garageId`
    const fb = getFirebaseClient();
    if (fb?.auth.currentUser) {
      try {
        const freshIdToken = await fb.auth.currentUser.getIdToken(true);
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: freshIdToken }),
        });

        if (selectedLogoFile) {
          const safeName = selectedLogoFile.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );
          const storagePath = `garages/${createdGarage.id}/logo/${Date.now()}-${safeName}`;
          const storageRef = ref(fb.storage, storagePath);
          await uploadBytes(storageRef, selectedLogoFile, {
            contentType: selectedLogoFile.type,
          });
          const logoUrl = await getDownloadURL(storageRef);

          await fetch("/api/garage/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logoUrl, logoStoragePath: storagePath }),
          });
        }
      } catch {
        // Non-fatal if optional logo upload fails; owner can re-upload in Settings
      }
    }

    toast.success(t("savedToast"));
    router.push("/garage");
    router.refresh();
  });

  const stepLabels = [
    { num: 1 as const, label: t("step1") },
    { num: 2 as const, label: t("step2") },
    { num: 3 as const, label: t("step3") },
    { num: 4 as const, label: t("step4") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Badge variant="default" className="mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          {t("badge")}
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stepper Indicator */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stepLabels.map((item) => {
          const active = step === item.num;
          const done = step > item.num;
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => {
                if (item.num < step) setStep(item.num);
              }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                active
                  ? "border-primary bg-primary/15 text-foreground shadow-glow-blue"
                  : done
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-border bg-secondary/40 text-muted-foreground"
              }`}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="font-mono">{item.num}.</span>
              )}
              <span className="truncate">
                {item.label.replace(/^\d+\.\s*/, "")}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={onSubmit} className="space-y-6">
          {/* STEP 1: Identity & Address */}
          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ob-name">{t("garageName")}</Label>
                <Input
                  id="ob-name"
                  placeholder={t("garageNamePlaceholder")}
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">
                    {translateErr(form.formState.errors.name.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-city">{t("city")}</Label>
                  <Input
                    id="ob-city"
                    placeholder={t("cityPlaceholder")}
                    {...form.register("city")}
                  />
                  {form.formState.errors.city ? (
                    <p className="text-xs text-destructive">
                      {translateErr(form.formState.errors.city.message)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ob-address">{t("address")}</Label>
                  <Input
                    id="ob-address"
                    placeholder={t("addressPlaceholder")}
                    {...form.register("address")}
                  />
                  {form.formState.errors.address ? (
                    <p className="text-xs text-destructive">
                      {translateErr(form.formState.errors.address.message)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-phone">{t("phone")}</Label>
                  <Input
                    id="ob-phone"
                    placeholder="+359 88 123 4567"
                    {...form.register("phone")}
                  />
                  {form.formState.errors.phone ? (
                    <p className="text-xs text-destructive">
                      {translateErr(form.formState.errors.phone.message)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ob-email">{t("email")}</Label>
                  <Input
                    id="ob-email"
                    type="email"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email ? (
                    <p className="text-xs text-destructive">
                      {translateErr(form.formState.errors.email.message)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ob-desc">{t("description")}</Label>
                <textarea
                  id="ob-desc"
                  rows={3}
                  placeholder={t("descriptionPlaceholder")}
                  className="flex w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...form.register("description")}
                />
              </div>
            </div>
          ) : null}

          {/* STEP 2: Working Hours */}
          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  {t("step2")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMondayToWeekdays}
                >
                  {t("copyWeekdays")}
                </Button>
              </div>

              <div className="divide-y divide-border rounded-2xl border border-border px-4">
                {DAYS_OF_WEEK.map((day) => {
                  const slot = workingHours[day];
                  return (
                    <div
                      key={day}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
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
                          {slot.closed ? t("closedDay") : "Open"}
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
                          <span className="text-muted-foreground">–</span>
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
            </div>
          ) : null}

          {/* STEP 3: Services Offered */}
          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("servicesHint")}
              </p>

              <div className="flex flex-wrap gap-2">
                {PRESET_SERVICE_KEYS.map((key) => {
                  const label = tPresets(key);
                  const selected = servicesOffered.includes(label);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleService(label)}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                        selected
                          ? "border-primary bg-primary/20 text-foreground shadow-glow-blue"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <Input
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  placeholder={t("customServicePlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomService();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCustomService}
                >
                  <Plus className="h-4 w-4" />
                  {t("addService")}
                </Button>
              </div>

              {servicesOffered.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-secondary/30 p-3.5">
                  {servicesOffered.map((svc) => (
                    <Badge key={svc} variant="default" className="gap-1 py-1">
                      <Wrench className="h-3 w-3" />
                      {svc}
                      <button
                        type="button"
                        aria-label={`Remove ${svc}`}
                        onClick={() => toggleService(svc)}
                        className="ml-1 rounded-full hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}

              {form.formState.errors.servicesOffered ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.servicesOffered.message)}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* STEP 4: Logo & Launch */}
          {step === 4 ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-secondary/30 p-6 text-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-glow-blue">
                  {logoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreviewUrl}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-10 w-10" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("logoTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.getValues("name")} • {form.getValues("city")}
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {t("uploadLogo")}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between border-t border-border pt-5">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : 1))}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button
                type="button"
                variant="gradient"
                onClick={() => void goNextStep()}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="gradient"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("finishButton")}
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

