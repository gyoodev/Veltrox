"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Download,
  Globe,
  Loader2,
  Mail,
  Megaphone,
  Phone,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { localeLabels } from "@/i18n/config";
import { getFirebaseClient } from "@/lib/firebase/client";
import type { BulgariaFuelPricesPayload } from "@/lib/fuel-prices";
import { cn, getInitials } from "@/lib/utils";
import {
  type DeleteAccountFormValues,
  deleteAccountSchema,
  type UpdateProfileValues,
  updateProfileSchema,
} from "@/lib/validators/profile";
import type { AppLocale, UserProfile } from "@/types/domain";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

interface ProfileSettingsViewProps {
  initialProfile: UserProfile;
  initialFuelPrices?: BulgariaFuelPricesPayload | null;
}

export function ProfileSettingsView({
  initialProfile,
  initialFuelPrices: _initialFuelPrices = null,
}: ProfileSettingsViewProps) {
  const t = useTranslations("profile");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { setProfileState, signOut } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialProfile.avatarUrl
  );
  const [avatarStoragePath, setAvatarStoragePath] = useState<string | null>(
    initialProfile.avatarStoragePath
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const profileForm = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: initialProfile.displayName,
      phone: initialProfile.phone ?? "",
      avatarUrl: initialProfile.avatarUrl,
      avatarStoragePath: initialProfile.avatarStoragePath,
      language: initialProfile.language,
      notificationPreferences: initialProfile.notificationPreferences,
    },
  });

  const deleteForm = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      confirmationText: "",
    },
  });

  const translateValidationError = (key: string | undefined): string | null => {
    if (!key) return null;
    try {
      return tVal(key as Parameters<typeof tVal>[0]);
    } catch {
      return key;
    }
  };

  const handleAvatarFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error(t("avatarInvalidType"));
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t("avatarTooLarge"));
      return;
    }

    setUploadingAvatar(true);
    try {
      const apiKey =
        process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
        "081c67f1d21a81269c6275b692e61030";

      // 1. Direct ImgBB Cloud upload
      try {
        const imgbbForm = new FormData();
        imgbbForm.append("image", file);
        imgbbForm.append("name", `avatar-${Date.now()}`);

        const imgbbRes = await fetch(
          `https://api.imgbb.com/1/upload?key=${apiKey}`,
          {
            method: "POST",
            body: imgbbForm,
          }
        );

        if (imgbbRes.ok) {
          const imgbbJson = (await imgbbRes.json()) as {
            data?: {
              id: string;
              url: string;
              display_url: string;
            };
            success: boolean;
          };

          if (imgbbJson.success && imgbbJson.data) {
            const cloudUrl = imgbbJson.data.display_url || imgbbJson.data.url;
            setAvatarUrl(cloudUrl);
            setAvatarStoragePath(`imgbb:${imgbbJson.data.id}`);
            profileForm.setValue("avatarUrl", cloudUrl, { shouldDirty: true });
            profileForm.setValue(
              "avatarStoragePath",
              `imgbb:${imgbbJson.data.id}`,
              { shouldDirty: true }
            );
            toast.success(t("avatarUploadedToast"));
            return;
          }
        }
      } catch (cloudErr) {
        console.warn(
          "Direct avatar upload to ImgBB failed, trying backend:",
          cloudErr
        );
      }

      // 2. Server proxy upload (relays to ImgBB or local storage)
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
        setAvatarUrl(json.url);
        setAvatarStoragePath(json.storagePath);
        profileForm.setValue("avatarUrl", json.url, { shouldDirty: true });
        profileForm.setValue("avatarStoragePath", json.storagePath, {
          shouldDirty: true,
        });
        toast.success(t("avatarUploadedToast"));
        return;
      }

      // 3. Fallback to Firebase Storage
      const client = getFirebaseClient();
      if (client?.storage) {
        const ext =
          file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "webp";
        const safePath = `users/${initialProfile.uid}/avatar/avatar-${Date.now()}.${ext}`;
        const storageRef = ref(client.storage, safePath);

        await uploadBytes(storageRef, file, {
          contentType: file.type,
          cacheControl: "public,max-age=86400",
        });
        const downloadUrl = await getDownloadURL(storageRef);

        setAvatarUrl(downloadUrl);
        setAvatarStoragePath(safePath);
        profileForm.setValue("avatarUrl", downloadUrl, { shouldDirty: true });
        profileForm.setValue("avatarStoragePath", safePath, {
          shouldDirty: true,
        });
        toast.success(t("avatarUploadedToast"));
        return;
      }

      throw new Error("Upload failed");
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error(t("saveErrorToast"));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    setAvatarStoragePath(null);
    profileForm.setValue("avatarUrl", null, { shouldDirty: true });
    profileForm.setValue("avatarStoragePath", null, { shouldDirty: true });
  };

  const onSubmitProfile = async (values: UpdateProfileValues) => {
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          avatarUrl,
          avatarStoragePath,
        }),
      });

      if (!response.ok) {
        throw new Error("PROFILE_UPDATE_FAILED");
      }

      const json = (await response.json()) as { profile: UserProfile };
      setProfileState(json.profile);
      toast.success(t("savedToast"));
      router.refresh();
    } catch {
      toast.error(t("saveErrorToast"));
    }
  };

  const handleExportPersonalData = async () => {
    setExportingData(true);
    try {
      const res = await fetch("/api/user/export", { method: "GET" });
      if (!res.ok) {
        throw new Error("EXPORT_FAILED");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `veltrox-gdpr-export-${initialProfile.uid.slice(0, 8)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("saveErrorToast"));
    } finally {
      setExportingData(false);
    }
  };

  const onConfirmAccountDeletion = async (values: DeleteAccountFormValues) => {
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        throw new Error("DELETE_FAILED");
      }

      toast.success(t("accountDeletedToast"));
      setDeleteDialogOpen(false);
      await signOut();
    } catch {
      toast.error(t("deleteErrorToast"));
    }
  };

  const roleBadgeLabel =
    initialProfile.role === "ADMIN"
      ? "Администратор"
      : initialProfile.role === "GARAGE_OWNER"
        ? "Автосервиз"
        : "Потребител";

  const notificationItems = [
    {
      path: "notificationPreferences.emailReminders" as const,
      title: t("emailReminders"),
      desc: t("emailRemindersDesc"),
      icon: CalendarClock,
      badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      activeBg: "border-blue-500/35 bg-blue-500/[0.03]",
    },
    {
      path: "notificationPreferences.serviceUpdates" as const,
      title: t("serviceUpdates"),
      desc: t("serviceUpdatesDesc"),
      icon: Wrench,
      badgeColor: "bg-violet-500/10 text-violet-500 border-violet-500/20",
      activeBg: "border-violet-500/35 bg-violet-500/[0.03]",
    },
    {
      path: "notificationPreferences.documentExpiryAlerts" as const,
      title: t("documentAlerts"),
      desc: t("documentAlertsDesc"),
      icon: ShieldCheck,
      badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      activeBg: "border-emerald-500/35 bg-emerald-500/[0.03]",
    },
    {
      path: "notificationPreferences.marketingEmails" as const,
      title: t("marketingEmails"),
      desc: t("marketingEmailsDesc"),
      icon: Megaphone,
      badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      activeBg: "border-amber-500/35 bg-amber-500/[0.03]",
    },
  ] as const;

  return (
    <div className="space-y-8">
      {/* 1. Header & Identity Hero Card */}
      <Card className="overflow-hidden border border-border/80 bg-card/60 backdrop-blur-xl shadow-lg shadow-black/5">
        {/* Ambient Top Banner */}
        <div className="relative h-28 sm:h-36 w-full overflow-hidden bg-gradient-to-r from-blue-600/25 via-indigo-600/20 to-violet-600/25 border-b border-border/50">
          <div className="absolute inset-0 bg-grid-subtle opacity-40" />
          <div className="absolute -right-8 -top-8 h-44 w-44 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
          <div className="absolute left-1/4 -bottom-10 h-36 w-36 rounded-full bg-accent/20 blur-2xl pointer-events-none" />
          <div className="absolute top-3.5 right-4 flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-background/70 backdrop-blur-md border-border/70 text-xs font-medium py-1 px-2.5 shadow-sm"
            >
              {roleBadgeLabel}
            </Badge>
          </div>
        </div>

        {/* Identity Body with Floating Avatar */}
        <div className="px-5 pb-6 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
              <div className="relative group shrink-0 w-fit">
                <Avatar className="h-24 w-24 sm:h-28 sm:w-28 text-2xl font-bold ring-4 ring-card shadow-2xl border-2 border-border/60 bg-muted">
                  {avatarUrl ? (
                    <AvatarImage
                      src={avatarUrl}
                      alt={initialProfile.displayName}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 text-foreground font-bold">
                    {getInitials(
                      profileForm.watch("displayName") || initialProfile.displayName
                    )}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-medium backdrop-blur-[2px] cursor-pointer"
                  aria-label={t("uploadAvatar")}
                >
                  <Camera className="h-5 w-5 mb-0.5" />
                  <span>{t("uploadAvatar")}</span>
                </button>
              </div>

              <div className="space-y-1.5 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {profileForm.watch("displayName") || initialProfile.displayName || "Потребител"}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                  <span className="truncate">{initialProfile.email}</span>
                  {initialProfile.emailVerified ? (
                    <Badge variant="success" className="shrink-0 text-[10px] px-1.5 py-0 h-4">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                      {tCommon("emailVerified")}
                    </Badge>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 w-full sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={handleAvatarFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto h-9 text-xs font-semibold shadow-sm"
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {t("uploadingAvatar")}
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {t("uploadAvatar")}
                  </>
                )}
              </Button>
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  className="w-full sm:w-auto h-9 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {t("removeAvatar")}
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/80">{t("avatarHint")}</p>
        </div>
      </Card>

      <form
        onSubmit={profileForm.handleSubmit(onSubmitProfile)}
        className="space-y-6"
        noValidate
      >
        {/* 2. Personal Information & Language */}
        <Card className="overflow-hidden border border-border/80 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <User className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{t("personalInfo")}</CardTitle>
                <CardDescription className="text-xs">{t("subtitle")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:gap-5 sm:grid-cols-2 pt-6">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("displayName")}
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="displayName"
                  autoComplete="name"
                  className="pl-10 h-11 bg-background/50 border-border/70 focus-visible:ring-primary/30"
                  {...profileForm.register("displayName")}
                />
              </div>
              {profileForm.formState.errors.displayName ? (
                <p className="text-xs text-destructive font-medium" role="alert">
                  {translateValidationError(
                    profileForm.formState.errors.displayName.message
                  )}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <Label htmlFor="emailReadonly" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("emailReadonly")}
                </Label>
                <Badge
                  variant={initialProfile.emailVerified ? "success" : "warning"}
                  className="shrink-0 text-[10px] font-semibold"
                >
                  {initialProfile.emailVerified ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {tCommon("emailVerified")}
                    </>
                  ) : (
                    tCommon("emailUnverified")
                  )}
                </Badge>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="emailReadonly"
                  value={initialProfile.email}
                  disabled
                  readOnly
                  className="pl-10 h-11 font-mono text-xs sm:text-sm bg-muted/40 border-border/50 truncate cursor-not-allowed opacity-90"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("phoneLabel")}
              </Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder={t("phonePlaceholder")}
                  className="pl-10 h-11 bg-background/50 border-border/70 focus-visible:ring-primary/30"
                  {...profileForm.register("phone")}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("phoneHint")}</p>
              {profileForm.formState.errors.phone ? (
                <p className="text-xs text-destructive font-medium" role="alert">
                  {translateValidationError(
                    profileForm.formState.errors.phone.message
                  )}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                {t("languageLabel")}
              </Label>
              <Controller
                control={profileForm.control}
                name="language"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as AppLocale)}
                  >
                    <SelectTrigger
                      aria-label={t("languageLabel")}
                      className="h-11 bg-background/50 border-border/70"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Globe className="h-4 w-4 text-primary shrink-0" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bg">
                        {localeLabels.bg.native} ({localeLabels.bg.short})
                      </SelectItem>
                      <SelectItem value="en">
                        {localeLabels.en.native} ({localeLabels.en.short})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Notification Preferences */}
        <Card className="overflow-hidden border border-border/80 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20 shrink-0">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{t("notificationsTitle")}</CardTitle>
                <CardDescription className="text-xs">{t("notificationsSubtitle")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-6">
            {notificationItems.map((pref) => {
              const IconComponent = pref.icon;
              return (
                <Controller
                  key={pref.path}
                  control={profileForm.control}
                  name={pref.path}
                  render={({ field }) => {
                    const isChecked = Boolean(field.value);
                    return (
                      <div
                        onClick={() => field.onChange(!isChecked)}
                        className={cn(
                          "flex items-start justify-between gap-3.5 rounded-2xl border p-4 transition-all duration-200 cursor-pointer select-none",
                          isChecked
                            ? pref.activeBg
                            : "border-border/70 bg-secondary/15 hover:border-border hover:bg-secondary/30"
                        )}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1 pr-2">
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 mt-0.5 transition-colors",
                              pref.badgeColor
                            )}
                          >
                            <IconComponent className="h-4.5 w-4.5" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground break-words">
                              {pref.title}
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground break-words">
                              {pref.desc}
                            </p>
                          </div>
                        </div>
                        <div
                          className="shrink-0 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={isChecked}
                            onCheckedChange={field.onChange}
                            aria-label={pref.title}
                          />
                        </div>
                      </div>
                    );
                  }}
                />
              );
            })}

            <div className="rounded-xl border border-border/60 bg-secondary/15 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span>{t("channelNote")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Save Bar with Dirty State Indicator */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            {profileForm.formState.isDirty ? (
              <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Имате незапазени промени
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Всички промени са записани
              </span>
            )}
          </div>
          <Button
            type="submit"
            variant="gradient"
            size="default"
            disabled={profileForm.formState.isSubmitting}
            className="w-full sm:w-auto min-h-11 px-6 text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30"
          >
            {profileForm.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {tCommon("saving")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t("saveChanges")}
              </>
            )}
          </Button>
        </div>
      </form>

      <Separator />

      {/* 4. GDPR Data Portability & Irreversible Account Deletion */}
      <Card className="border-border/80 overflow-hidden shadow-sm">
        <CardHeader className="pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shrink-0">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{t("gdprTitle")}</CardTitle>
              <CardDescription className="text-xs">{t("gdprSubtitle")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* JSON Data Export */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-secondary/15 p-4 sm:p-5 sm:flex-row sm:items-center hover:border-primary/30 transition-colors">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0 mt-0.5">
                <Download className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t("exportTitle")}
                  </p>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-mono tracking-wider border-blue-500/30 text-blue-500"
                  >
                    JSON
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("exportDesc")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={exportingData}
              onClick={handleExportPersonalData}
              className="w-full sm:w-auto shrink-0 min-h-10 text-xs font-semibold border-border/80 hover:bg-secondary/60"
            >
              {exportingData ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("exporting")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t("exportButton")}
                </>
              )}
            </Button>
          </div>

          {/* Full GDPR Account Deletion */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-destructive/35 bg-destructive/[0.04] p-4 sm:p-5 sm:flex-row sm:items-center hover:border-destructive/50 transition-colors">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-destructive">
                    {t("deleteTitle")}
                  </p>
                  <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                    Danger zone
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("deleteDesc")}
                </p>
              </div>
            </div>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full sm:w-auto shrink-0 min-h-10 text-xs font-semibold shadow-sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("deleteButton")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    {t("deleteModalTitle")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("deleteModalWarning")}
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={deleteForm.handleSubmit(onConfirmAccountDeletion)}
                  className="space-y-4 pt-2"
                >
                  <div className="space-y-2">
                    <Label htmlFor="deleteConfirmInput">
                      {t("deleteTypePrompt")}
                    </Label>
                    <Input
                      id="deleteConfirmInput"
                      placeholder={t("deleteConfirmPlaceholder")}
                      autoComplete="off"
                      className="font-mono"
                      {...deleteForm.register("confirmationText")}
                    />
                    {deleteForm.formState.errors.confirmationText ? (
                      <p className="text-xs text-destructive" role="alert">
                        {translateValidationError(
                          deleteForm.formState.errors.confirmationText.message
                        )}
                      </p>
                    ) : null}
                  </div>

                  <DialogFooter className="pt-3 sticky bottom-0 bg-popover/95 backdrop-blur-md border-t border-border/40 pb-1 mt-2 z-10">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                      className="w-full sm:w-auto min-h-10"
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={deleteForm.formState.isSubmitting}
                      className="w-full sm:w-auto min-h-10 font-semibold"
                    >
                      {deleteForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {t("deletingAccount")}
                        </>
                      ) : (
                        t("deleteConfirmButton")
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
