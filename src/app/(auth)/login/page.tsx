"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
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
import { type LoginFormValues, loginSchema } from "@/lib/validators/auth";

function mapFirebaseErrorCode(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "invalidCredentials";
    case "auth/too-many-requests":
      return "tooManyRequests";
    case "auth/popup-closed-by-user":
      return "popupClosed";
    default:
      return "generic";
  }
}

function LoginFormContent() {
  const t = useTranslations("auth");
  const tVal = useTranslations("validation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConfigured, syncServerSession } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const resolveSafeRedirect = (defaultRedirect: string): string => {
    const nextParam = searchParams.get("next");
    if (
      nextParam &&
      nextParam.startsWith("/") &&
      !nextParam.startsWith("//")
    ) {
      return nextParam;
    }
    return defaultRedirect;
  };

  const onSubmit = async (values: LoginFormValues) => {
    const client = getFirebaseClient();
    if (!client) {
      toast.error(t("firebaseMissingTitle"));
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(
        client.auth,
        values.email,
        values.password
      );
      const { redirectTo } = await syncServerSession(credential.user);
      router.push(resolveSafeRedirect(redirectTo));
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message;
      if (message === "ACCOUNT_SUSPENDED") {
        toast.error(t("errors.accountSuspended"));
        return;
      }
      const errKey = mapFirebaseErrorCode(code);
      toast.error(t(`errors.${errKey}` as Parameters<typeof t>[0]));
    }
  };

  const handleGoogleSignIn = async () => {
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
      const { redirectTo } = await syncServerSession(credential.user);
      router.push(resolveSafeRedirect(redirectTo));
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const errKey = mapFirebaseErrorCode(code);
      toast.error(t(`errors.${errKey}` as Parameters<typeof t>[0]));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("loginTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
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

      <div className="mt-6">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={googleLoading || form.formState.isSubmitting}
          onClick={handleGoogleSignIn}
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

        <div className="relative my-6 flex items-center justify-center">
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
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("forgotPasswordLink")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
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

          <Button
            type="submit"
            variant="gradient"
            className="w-full"
            disabled={form.formState.isSubmitting || googleLoading}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("signingIn")}
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                {t("signInButton")}
              </>
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="font-semibold text-primary hover:underline"
        >
          {t("createAccountButton")}
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[460px] w-full rounded-2xl" />}>
      <LoginFormContent />
    </Suspense>
  );
}

