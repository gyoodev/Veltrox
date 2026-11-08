import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LockOpen,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/server-auth";

export default async function GaragePendingApprovalPage() {
  const { profile } = await requireRole(["GARAGE_OWNER"]);
  if (profile.garageStatus === "approved") {
    redirect("/garage");
  }

  const t = await getTranslations("dashboards.pending");
  const isRejected = profile.garageStatus === "rejected";

  const steps = [
    {
      icon: CheckCircle2,
      title: t("step1Title"),
      desc: t("step1Desc"),
      done: true,
    },
    {
      icon: Clock,
      title: t("step2Title"),
      desc: t("step2Desc"),
      done: false,
    },
    {
      icon: LockOpen,
      title: t("step3Title"),
      desc: t("step3Desc"),
      done: false,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <Badge variant={isRejected ? "warning" : "default"}>{t("badge")}</Badge>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {isRejected ? t("rejectedTitle") : t("title")}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("description")}
        </p>

        {isRejected && profile.garageRejectionReason ? (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-orange-500/35 bg-orange-500/10 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <div>
              <p className="font-semibold text-foreground">
                {t("rejectedReasonLabel")}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {profile.garageRejectionReason}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-2xl border border-border bg-secondary/30 p-5"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                    step.done
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="gradient">
            <Link href="/garage/profile">
              <UserCog className="h-4 w-4" />
              {t("editProfileCta")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/garage/pending">{t("refreshStatusCta")}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

