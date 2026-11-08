"use client";

import { sendEmailVerification } from "firebase/auth";
import { CheckCircle2, Loader2, MailCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRoleHomePath } from "@/lib/auth/edge-session";
import { getFirebaseClient } from "@/lib/firebase/client";

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { firebaseUser, profile, syncServerSession } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  const dashboardHref = profile
    ? getRoleHomePath(profile.role, profile.garageStatus)
    : "/app";

  const handleResend = async () => {
    const client = getFirebaseClient();
    const currentUser = client?.auth.currentUser ?? firebaseUser;
    if (!currentUser) {
      router.push("/login");
      return;
    }

    setResending(true);
    try {
      await sendEmailVerification(currentUser);
      toast.success(t("resendSent"));
    } catch {
      toast.error(t("errors.tooManyRequests"));
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerification = async () => {
    const client = getFirebaseClient();
    const currentUser = client?.auth.currentUser ?? firebaseUser;
    if (!currentUser) {
      router.push("/login");
      return;
    }

    setChecking(true);
    try {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        const { redirectTo } = await syncServerSession(currentUser, {
          forceRefresh: true,
        });
        toast.success(t("verifiedSuccess"));
        router.push(redirectTo);
        router.refresh();
      } else {
        toast.info(t("stillUnverified"));
      }
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {profile?.emailVerified ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        ) : (
          <MailCheck className="h-7 w-7" />
        )}
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("verifyTitle")}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("verifySubtitle")}
      </p>

      <div className="mt-6 space-y-3">
        <Button
          type="button"
          variant="gradient"
          className="w-full"
          disabled={checking}
          onClick={handleCheckVerification}
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t("checkVerification")}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={resending}
          onClick={handleResend}
        >
          {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("resendVerification")}
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link href={dashboardHref}>{tCommon("goToDashboard")}</Link>
        </Button>
      </div>
    </Card>
  );
}

