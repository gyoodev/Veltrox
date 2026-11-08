"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseClient } from "@/lib/firebase/client";
import {
  type ForgotPasswordFormValues,
  forgotPasswordSchema,
} from "@/lib/validators/auth";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tVal = useTranslations("validation");
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    const client = getFirebaseClient();
    if (!client) {
      toast.error(t("firebaseMissingTitle"));
      return;
    }

    try {
      await sendPasswordResetEmail(client.auth, values.email);
      setSent(true);
    } catch {
      // Avoid account enumeration — surface consistent confirmation
      setSent(true);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("resetSentTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("resetSentDesc")}
          </p>
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              {t("backToLogin")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("forgotTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("forgotSubtitle")}
            </p>
          </div>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t("emailLabel")}</Label>
              <Input
                id="reset-email"
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

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("sendingReset")}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {t("sendResetLink")}
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("backToLogin")}
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

