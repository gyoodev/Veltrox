import {
  CheckCircle2,
  Gauge,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getVehiclePublicPass } from "@/lib/data/user-diary";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AppLocale } from "@/types/domain";

interface PublicVehiclePassPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Verified Digital Service Pass | Veltrox",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicVehiclePassPage({
  params,
}: PublicVehiclePassPageProps) {
  const { token } = await params;
  const pass = await getVehiclePublicPass(token);
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("publicVehiclePass");

  if (!pass) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="glass-panel sticky top-0 z-20 border-b border-border">
          <div className="container flex h-16 items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="container mx-auto flex max-w-xl flex-1 items-center justify-center py-16">
          <Card className="w-full space-y-3 p-8 text-center">
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">
              {t("notFoundTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("notFoundDesc")}</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="glass-panel sticky top-0 z-20 border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl flex-1 space-y-6 py-10">
        {/* Hero */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="success" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("verifiedPassBadge")}
              </Badge>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {pass.make} {pass.model} ({pass.year})
              </h1>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                <span className="rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1 font-mono font-bold text-foreground">
                  {pass.maskedPlate}
                </span>
                {pass.vinLast6 ? (
                  <span className="rounded-lg border border-border px-2.5 py-1 font-mono">
                    VIN •••{pass.vinLast6}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 font-mono">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  {pass.currentMileageKm.toLocaleString()} km
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-muted-foreground">
              <p className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                {t("driverProPassLabel")}
              </p>
              <p className="mt-1">
                {t("updatedAt")}: {formatDate(pass.updatedAt, locale)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3 border-t border-border pt-5">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
              <p className="text-xs text-muted-foreground">
                {t("odometerCheckLabel")}
              </p>
              <p
                className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${
                  pass.odometerConsistent ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {pass.odometerConsistent
                  ? t("odometerConsistentLabel")
                  : t("odometerNeedsReviewLabel")}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
              <p className="text-xs text-muted-foreground">
                {t("verifiedStampsLabel")}
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-primary">
                {pass.verifiedGarageEntriesCount} / {pass.totalEntriesCount}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
              <p className="text-xs text-muted-foreground">
                {t("complianceLabel")}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge
                  variant={pass.compliance.validInsurance ? "success" : "secondary"}
                  className="text-[11px]"
                >
                  {t("compInsurance")}
                </Badge>
                <Badge
                  variant={pass.compliance.validInspection ? "success" : "secondary"}
                  className="text-[11px]"
                >
                  {t("compInspection")}
                </Badge>
                <Badge
                  variant={pass.compliance.validVignette ? "success" : "secondary"}
                  className="text-[11px]"
                >
                  {t("compVignette")}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Service History */}
        <Card className="p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Wrench className="h-4 w-4 text-primary" />
            {t("timelineHeading")}
          </h2>

          {pass.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyTimeline")}</p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {pass.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDate(entry.date, locale)}
                      </span>
                      <span className="font-medium text-foreground">
                        {entry.title}
                      </span>
                      {entry.garageVerified ? (
                        <Badge variant="success" className="text-[11px]">
                          {entry.garageName
                            ? t("verifiedByGarage", { garage: entry.garageName })
                            : t("verifiedStamp")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    {entry.mileageKm > 0 ? (
                      <span className="text-muted-foreground">
                        {entry.mileageKm.toLocaleString()} km
                      </span>
                    ) : null}
                    {pass.includeCosts &&
                    entry.costAmount !== null &&
                    entry.currency ? (
                      <span className="font-semibold text-foreground">
                        {formatCurrency(entry.costAmount, locale, entry.currency)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

