import {
  BellRing,
  Calendar,
  Check,
  ExternalLink,
  Gauge,
  MapPin,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPublicWorkOrderStatus } from "@/lib/data/garage";
import { formatCurrency, formatDate } from "@/lib/utils";
import { type AppLocale, WORK_ORDER_STATUSES } from "@/types/domain";

interface PublicStatusPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Repair Status | Veltrox",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicWorkOrderStatusPage({
  params,
}: PublicStatusPageProps) {
  const { token } = await params;
  const projection = await getPublicWorkOrderStatus(token);

  if (!projection) {
    notFound();
  }

  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("publicStatus");
  const tStatuses = await getTranslations("garageWorkspace.statuses");
  const tWo = await getTranslations("garageWorkspace.workOrders");

  const currentIdx = WORK_ORDER_STATUSES.indexOf(projection.status);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal Public Header */}
      <header className="glass-panel sticky top-0 z-20 border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl flex-1 space-y-6 py-10 sm:py-14">
        {/* Garage & Vehicle Hero */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="default">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("badge")}
              </Badge>

              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {projection.vehicleLabel}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1 font-mono font-bold text-foreground">
                  {projection.maskedPlate}
                </span>
                {projection.mileageKm ? (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Gauge className="h-3.5 w-3.5 text-primary" />
                    {projection.mileageKm.toLocaleString()} km
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("updatedAt")}: {formatDate(projection.updatedAt, locale)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-left sm:text-right">
              <p className="text-base font-bold text-foreground">
                {projection.garageName}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {projection.garageCity}, {projection.garageAddress}
              </p>
              <div className="flex flex-wrap gap-2 pt-1 sm:justify-end">
                <Button asChild size="sm" variant="gradient">
                  <a href={`tel:${projection.garagePhone}`}>
                    <Phone className="h-3.5 w-3.5" />
                    {t("callGarageCta")}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/garages/${projection.garageSlug}`}>
                    {t("viewGarageProfile")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* 6-Step Progress Pipeline */}
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("progressHeading")}
            </h2>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {WORK_ORDER_STATUSES.map((st, idx) => {
                const isActive = idx === currentIdx;
                const isDone = idx < currentIdx;
                return (
                  <div
                    key={st}
                    className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-xs font-semibold ${
                      isActive
                        ? "border-primary bg-veltrox-gradient text-white shadow-glow-blue"
                        : isDone
                          ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
                          : "border-border bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    <span>{tStatuses(st)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Work Performed Summary */}
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Wrench className="h-4 w-4 text-primary" />
            {t("summaryHeading")}
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {projection.customerSummary || t("noSummaryYet")}
          </p>
        </Card>

        {/* Line Items & Total */}
        <Card className="space-y-4 p-6">
          <h2 className="text-base font-semibold text-foreground">
            {t("itemsHeading")}
          </h2>

          {projection.lineItems.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border">
              {projection.lineItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.type === "labor" ? "default" : "violet"}
                    >
                      {item.type === "labor"
                        ? tWo("typeLabor")
                        : tWo("typePart")}
                    </Badge>
                    <span className="font-medium text-foreground">
                      {item.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.quantity} ×{" "}
                      {formatCurrency(
                        item.unitPrice,
                        locale,
                        projection.currency
                      )}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatCurrency(
                        item.totalPrice,
                        locale,
                        projection.currency
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-medium text-muted-foreground">
              {t("totalLabel")}
            </span>
            <span className="font-mono text-2xl font-extrabold text-foreground">
              {formatCurrency(
                projection.totalAmount,
                locale,
                projection.currency
              )}
            </span>
          </div>
        </Card>

        {/* Next Recommended Service */}
        {projection.nextServiceDate || projection.nextServiceMileageKm ? (
          <Card className="border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t("nextServiceHeading")}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {projection.nextServiceDate
                    ? formatDate(projection.nextServiceDate, locale)
                    : ""}
                  {projection.nextServiceDate && projection.nextServiceMileageKm
                    ? " • "
                    : ""}
                  {projection.nextServiceMileageKm
                    ? `${projection.nextServiceMileageKm.toLocaleString()} km`
                    : ""}
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Drop-off Photos */}
        {projection.dropOffPhotoUrls.length > 0 ? (
          <Card className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-foreground">
              {t("photosHeading")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {projection.dropOffPhotoUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Inspection"
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          </Card>
        ) : null}

        <p className="pb-6 text-center text-xs text-muted-foreground">
          {t("privacyFooter")}
        </p>
      </main>
    </div>
  );
}

