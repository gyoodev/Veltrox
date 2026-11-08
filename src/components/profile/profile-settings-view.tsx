"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Download,
  Globe,
  Loader2,
  ShieldAlert,
  Trash2,
  User,
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
import { getInitials } from "@/lib/utils";
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
}

export function ProfileSettingsView({
  initialProfile,
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

    const client = getFirebaseClient();
    if (!client) {
      toast.error(t("saveErrorToast"));
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "webp";
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
      profileForm.setValue("avatarStoragePath", safePath, { shouldDirty: true });
      toast.success(t("avatarUploadedToast"));
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form
        onSubmit={profileForm.handleSubmit(onSubmitProfile)}
        className="space-y-6"
        noValidate
      >
        {/* 1. Avatar Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-primary" />
              {t("avatarSection")}
            </CardTitle>
            <CardDescription>{t("avatarHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-5">
            <Avatar className="h-20 w-20 text-lg">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={initialProfile.displayName} />
              ) : null}
              <AvatarFallback>
                {getInitials(
                  profileForm.watch("displayName") || initialProfile.displayName
                )}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-wrap items-center gap-2.5">
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
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("uploadingAvatar")}
                  </>
                ) : (
                  t("uploadAvatar")
                )}
              </Button>
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                >
                  {t("removeAvatar")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* 2. Personal Information & Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              {t("personalInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("displayName")}</Label>
              <Input
                id="displayName"
                autoComplete="name"
                {...profileForm.register("displayName")}
              />
              {profileForm.formState.errors.displayName ? (
                <p className="text-xs text-destructive" role="alert">
                  {translateValidationError(
                    profileForm.formState.errors.displayName.message
                  )}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailReadonly">{t("emailReadonly")}</Label>
                <Badge
                  variant={initialProfile.emailVerified ? "success" : "warning"}
                >
                  {initialProfile.emailVerified ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      {tCommon("emailVerified")}
                    </>
                  ) : (
                    tCommon("emailUnverified")
                  )}
                </Badge>
              </div>
              <Input
                id="emailReadonly"
                value={initialProfile.email}
                disabled
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder={t("phonePlaceholder")}
                {...profileForm.register("phone")}
              />
              <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
              {profileForm.formState.errors.phone ? (
                <p className="text-xs text-destructive" role="alert">
                  {translateValidationError(
                    profileForm.formState.errors.phone.message
                  )}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
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
                    <SelectTrigger aria-label={t("languageLabel")}>
                      <SelectValue />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              {t("notificationsTitle")}
            </CardTitle>
            <CardDescription>{t("notificationsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                {
                  name: "notificationPreferences.emailReminders",
                  title: t("emailReminders"),
                  desc: t("emailRemindersDesc"),
                },
                {
                  name: "notificationPreferences.serviceUpdates",
                  title: t("serviceUpdates"),
                  desc: t("serviceUpdatesDesc"),
                },
                {
                  name: "notificationPreferences.documentAlerts",
                  fieldName: "notificationPreferences.documentExpiryAlerts",
                  title: t("documentAlerts"),
                  desc: t("documentAlertsDesc"),
                },
                {
                  name: "notificationPreferences.marketingEmails",
                  title: t("marketingEmails"),
                  desc: t("marketingEmailsDesc"),
                },
              ] as const
            ).map((pref) => {
              const path =
                "fieldName" in pref ? pref.fieldName : pref.name;
              return (
                <div
                  key={path}
                  className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/25 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {pref.title}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {pref.desc}
                    </p>
                  </div>
                  <Controller
                    control={profileForm.control}
                    name={path}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label={pref.title}
                      />
                    )}
                  />
                </div>
              );
            })}

            <p className="text-xs text-muted-foreground">{t("channelNote")}</p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            disabled={profileForm.formState.isSubmitting}
          >
            {profileForm.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tCommon("saving")}
              </>
            ) : (
              t("saveChanges")
            )}
          </Button>
        </div>
      </form>

      <Separator />

      {/* 4. GDPR Data Portability & Irreversible Account Deletion */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            {t("gdprTitle")}
          </CardTitle>
          <CardDescription>{t("gdprSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* JSON Data Export */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-secondary/25 p-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("exportTitle")}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("exportDesc")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={exportingData}
              onClick={handleExportPersonalData}
              className="shrink-0"
            >
              {exportingData ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("exporting")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t("exportButton")}
                </>
              )}
            </Button>
          </div>

          {/* Full GDPR Account Deletion */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-destructive/35 bg-destructive/[0.06] p-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("deleteTitle")}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("deleteDesc")}
              </p>
            </div>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" className="shrink-0">
                  <Trash2 className="h-4 w-4" />
                  {t("deleteButton")}
                </Button>
              </DialogTrigger>
              <DialogContent>
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

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={deleteForm.formState.isSubmitting}
                    >
                      {deleteForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
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
