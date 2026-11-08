"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import {
  AlertCircle,
  Car,
  Clock,
  Loader2,
  UserPlus,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getFirebaseClient } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { type RegisterFormValues, registerSchema } from "@/lib/validators/auth";
import type { RegistrableRole } from "@/types/domain";

function RegisterFormContent() {
  const t = useTranslations("auth");
  const tVal = useTranslations("validation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConfigured, syncServerSession } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const initialRoleParam = searchParams.get("role");
  const defaultRole: RegistrableRole =
    initialRoleParam === "GARAGE_OWNER" ? "GARAGE_OWNER" : "USER";

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: defaultRole,
      acceptTerms: false,
    },
  });

  const selectedRole = form.watch("role");

  const onSubmit = async (values: RegisterFormValues) => {
    const client = getFirebaseClient();
    if (!client) {
      toast.error(t("firebaseMissingTitle"));
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(
        client.auth,
        values.email,
        values.password
      );

      await updateProfile(credential.user, {
        displayName: values.displayName,
      });

      // Dispatch Firebase verification email immediately
      try {
        await sendEmailVerification(credential.user);
      } catch {
        // Non-blocking: user can re-trigger verification from /verify-email
      }

      const { redirectTo } = await syncServerSession(credential.user, {
        requestedRole: values.role,
        displayName: values.displayName,
        forceRefresh: true,
      });

      router.push(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        toast.error(t("errors.emailInUse"));
        return;
      }
      toast.error(t("errors.generic"));
    }
  };

  const handleGoogleRegister = async () => {
    const client = getFirebaseClient();
    if (!client) {
      toast.error(t("firebaseMissingTitle"));
      return;
    }

    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(
        client.auth,
        client.googleProvider
      );
      const { redirectTo } = await syncServerSession(credential.user, {
        requestedRole: selectedRole,
        forceRefresh: true,
      });
      router.push(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user") {
        toast.error(t("errors.popupClosed"));
      } else {
        toast.error(t("errors.generic"));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("registerTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("registerSubtitle")}
        </p>
      </div>

      {!isConfigured ? (
        <div
          role="status"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-orange-500/35 bg-orange-500/10 p-3.5 text-xs text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          <div>
            <p className="font-semibold">{t("firebaseMissingTitle")}</p>
            <p className="mt-0.5 text-muted-foreground">
              {t("firebaseMissingDesc")}
            </p>
          </div>
        </div>
      ) : null}

      {/* Role Selector: USER vs GARAGE_OWNER ONLY (ADMIN can NEVER be chosen) */}
      <div className="mt-6 space-y-2.5">
        <Label>{t("rolePrompt")}</Label>
        <div
          role="radiogroup"
          aria-label={t("rolePrompt")}
          className="grid gap-3 sm:grid-cols-2"
        >
          {(
            [
              {
                role: "USER" as const,
                icon: Car,
                title: t("roleOwnerTitle"),
                desc: t("roleOwnerDesc"),
              },
              {
                role: "GARAGE_OWNER" as const,
                icon: Wrench,
                title: t("roleGarageTitle"),
                desc: t("roleGarageDesc"),
              },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            const active = selectedRole === option.role;
            return (
              <button
                key={option.role}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  form.setValue("role", option.role, { shouldValidate: true })
                }
                className={cn(
                  "flex flex-col items-start rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/10 shadow-glow-blue"
                    : "border-border bg-secondary/25 hover:bg-secondary/50"
                )}
              >
                <div
                  className={cn(
                    "mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl",
                    active
                      ? "bg-veltrox-gradient text-white"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {option.title}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {option.desc}
                </span>
              </button>
            );
          })}
        </div>

        {selectedRole === "GARAGE_OWNER" ? (
          <div className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-foreground">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <span>{t("garageApprovalNotice")}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={googleLoading || form.formState.isSubmitting}
          onClick={handleGoogleRegister}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12Z"
              />
            </svg>
          )}
          {t("continueWithGoogle")}
        </Button>

        <div className="relative my-5 flex items-center justify-center">
          <Separator />
          <span className="absolute bg-card px-3 text-xs text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="displayName">{t("nameLabel")}</Label>
            <Input
              id="displayName"
              autoComplete="name"
              placeholder={t("namePlaceholder")}
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName?.message ? (
              <p className="text-xs text-destructive" role="alert">
                {tVal(
                  form.formState.errors.displayName.message as Parameters<
                    typeof tVal
                  >[0]
                )}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email">{t("emailLabel")}</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              {...form.register("email")}
            />
            {form.formState.errors.email?.message ? (
              <p className="text-xs text-destructive" role="alert">
                {tVal(
                  form.formState.errors.email.message as Parameters<
                    typeof tVal
                  >[0]
                )}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reg-password">{t("passwordLabel")}</Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...form.register("password")}
              />
              {form.formState.errors.password?.message ? (
                <p className="text-xs text-destructive" role="alert">
                  {tVal(
                    form.formState.errors.password.message as Parameters<
                      typeof tVal
                    >[0]
                  )}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("confirmPasswordLabel")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword?.message ? (
                <p className="text-xs text-destructive" role="alert">
                  {tVal(
                    form.formState.errors.confirmPassword.message as Parameters<
                      typeof tVal
                    >[0]
                  )}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border accent-blue-600"
                {...form.register("acceptTerms")}
              />
              <span>
                {t("acceptTermsPrefix")}{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-primary hover:underline"
                >
                  {t("privacyLink")}
                </Link>{" "}
                {t("andWord")}{" "}
                <Link
                  href="/terms"
                  className="font-medium text-primary hover:underline"
                >
                  {t("termsLink")}
                </Link>
                .
              </span>
            </label>
            {form.formState.errors.acceptTerms?.message ? (
              <p className="text-xs text-destructive" role="alert">
                {tVal(
                  form.formState.errors.acceptTerms.message as Parameters<
                    typeof tVal
                  >[0]
                )}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            variant="gradient"
            className="w-full"
            disabled={form.formState.isSubmitting || googleLoading}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("creatingAccount")}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                {t("createAccountButton")}
              </>
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          {t("signInButton")}
        </Link>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[620px] w-full rounded-2xl" />}>
      <RegisterFormContent />
    </Suspense>
  );
}

