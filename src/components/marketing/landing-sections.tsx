"use client";

import {
  ArrowRight,
  BellRing,
  Check,
  ExternalLink,
  FileSpreadsheet,
  FolderLock,
  Gauge,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/shared/cookie-consent";
import { Logo } from "@/components/shared/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AnimatedCtaButton } from "@/components/ui/animated-cta-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppLocale, PlatformFaqItem } from "@/types/domain";

export function TrustSection() {
  const t = useTranslations("trust");

  const pillars = [
    {
      icon: ShieldCheck,
      title: t("pillar1Title"),
      desc: t("pillar1Desc"),
    },
    {
      icon: Smartphone,
      title: t("pillar2Title"),
      desc: t("pillar2Desc"),
    },
    {
      icon: LockKeyhole,
      title: t("pillar3Title"),
      desc: t("pillar3Desc"),
    },
    {
      icon: FileSpreadsheet,
      title: t("pillar4Title"),
      desc: t("pillar4Desc"),
    },
  ];

  return (
    <section className="border-y border-border bg-secondary/20 py-16">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} hoverLift className="p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function BentoFeaturesSection() {
  const t = useTranslations("bento");
  const tCommon = useTranslations("common");

  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="violet" className="mb-4">
            {t("eyebrow")}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Asymmetric 12-Column Bento Grid */}
        <div className="mt-14 grid gap-5 md:grid-cols-12">
          {/* Card 1: Automatic Timely Reminders (Large 7-col) */}
          <Card hoverLift className="relative overflow-hidden p-7 md:col-span-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-orange-500/15 blur-3xl"
            />
            <div className="flex items-center justify-between gap-2">
              <Badge variant="warning">{t("card1Badge")}</Badge>
              <Badge variant="demo">{tCommon("demoData")}</Badge>
            </div>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500">
              <BellRing className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              {t("card1Title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("card1Desc")}
            </p>
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-3.5 py-2.5 font-mono text-xs text-foreground">
                • {t("card1PreviewItem1")}
              </div>
              <div className="rounded-xl border border-primary/25 bg-primary/[0.08] px-3.5 py-2.5 font-mono text-xs text-foreground">
                • {t("card1PreviewItem2")}
              </div>
            </div>
          </Card>

          {/* Card 2: Car Owner Timeline & Expenses (5-col) */}
          <Card hoverLift className="p-7 md:col-span-5">
            <Badge variant="default">{t("card2Badge")}</Badge>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Gauge className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              {t("card2Title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("card2Desc")}
            </p>
          </Card>

          {/* Card 3: Sub-30s Work Orders by Plate (5-col) */}
          <Card hoverLift className="p-7 md:col-span-5">
            <Badge variant="violet">{t("card3Badge")}</Badge>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
              <Wrench className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              {t("card3Title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("card3Desc")}
            </p>
          </Card>

          {/* Card 4: Public Repair Status Link (7-col) */}
          <Card hoverLift className="p-7 md:col-span-7">
            <Badge variant="success">{t("card4Badge")}</Badge>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <ExternalLink className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              {t("card4Title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("card4Desc")}
            </p>
          </Card>

          {/* Card 5: Documents Vault & Tyre Hotel (6-col) */}
          <Card hoverLift className="p-7 md:col-span-6">
            <Badge variant="secondary">{t("card5Badge")}</Badge>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
              <FolderLock className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              {t("card5Title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("card5Desc")}
            </p>
          </Card>

          {/* Card 6: Connected Ecosystem Garage -> Car Diary (6-col) */}
          <Card hoverLift className="p-7 md:col-span-6">
            <Badge variant="violet">{t("card6Badge")}</Badge>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
              <Link2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              {t("card6Title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("card6Desc")}
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

const BGN_PER_EUR = 1.95583;

function formatPlanPriceLabel(
  eurAmount: number,
  currency: "EUR" | "BGN" = "EUR"
): string {
  const safeEur = Number.isFinite(eurAmount) && eurAmount >= 0 ? eurAmount : 0;
  if (currency === "BGN") {
    const bgn = safeEur * BGN_PER_EUR;
    return bgn === 0
      ? "0 лв."
      : Number.isInteger(bgn)
        ? `${bgn} лв.`
        : `${bgn.toFixed(2)} лв.`;
  }
  return safeEur === 0
    ? "€0"
    : Number.isInteger(safeEur)
      ? `€${safeEur}`
      : `€${safeEur.toFixed(2)}`;
}

interface PricingSectionProps {
  currency?: "EUR" | "BGN";
  userProPriceEur?: number;
  garageProPriceEur?: number;
  userSubscriptionsEnabled?: boolean;
  garageSubscriptionsEnabled?: boolean;
}

export function PricingSection({
  currency = "EUR",
  userProPriceEur = 4.9,
  garageProPriceEur = 49,
  userSubscriptionsEnabled = true,
  garageSubscriptionsEnabled = true,
}: PricingSectionProps = {}) {
  const t = useTranslations("pricing");
  const freePriceLabel = formatPlanPriceLabel(0, currency);
  const ownerProPriceLabel = formatPlanPriceLabel(userProPriceEur, currency);
  const garageProPriceLabel = formatPlanPriceLabel(garageProPriceEur, currency);

  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-border bg-secondary/15 py-20 sm:py-28"
    >
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="default" className="mb-4">
            {t("eyebrow")}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <Tabs defaultValue="owners" className="mx-auto mt-10 max-w-4xl">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="owners">{t("tabOwners")}</TabsTrigger>
              <TabsTrigger value="garages">{t("tabGarages")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="owners" className="mt-8">
            <div
              className={
                userSubscriptionsEnabled
                  ? "grid gap-6 md:grid-cols-2"
                  : "mx-auto max-w-md"
              }
            >
              {/* Driver Free */}
              <Card className="flex flex-col justify-between p-7">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-foreground">
                      {t("ownerFreeName")}
                    </h3>
                    <Badge variant="secondary">{t("foreverFree")}</Badge>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-extrabold text-foreground">
                      {freePriceLabel}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("perMonth")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("ownerFreeDesc")}
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    {[
                      t("ownerFreeF1"),
                      t("ownerFreeF2"),
                      t("ownerFreeF3"),
                      t("ownerFreeF4"),
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="mt-8 w-full"
                >
                  <Link href="/register?role=USER">{t("ctaOwner")}</Link>
                </Button>
              </Card>

              {/* Driver Pro */}
              {userSubscriptionsEnabled ? (
                <Card className="relative flex flex-col justify-between border-primary/45 p-7 shadow-glow-blue">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground">
                        {t("ownerProName")}
                      </h3>
                      <Badge variant="violet">{t("recommended")}</Badge>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-mono text-4xl font-extrabold text-foreground">
                        {ownerProPriceLabel}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t("perMonth")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t("ownerProDesc")}
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-foreground">
                      {[
                        t("ownerProF1"),
                        t("ownerProF2"),
                        t("ownerProF3"),
                        t("ownerProF4"),
                      ].map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    asChild
                    variant="gradient"
                    size="lg"
                    className="mt-8 w-full"
                  >
                    <Link href="/register?role=USER">
                      {t("ctaOwner")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </Card>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="garages" className="mt-8">
            <div
              className={
                garageSubscriptionsEnabled
                  ? "grid gap-6 md:grid-cols-2"
                  : "mx-auto max-w-md"
              }
            >
              {/* Garage Free */}
              <Card className="flex flex-col justify-between p-7">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-foreground">
                      {t("garageFreeName")}
                    </h3>
                    <Badge variant="secondary">{t("foreverFree")}</Badge>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-extrabold text-foreground">
                      {freePriceLabel}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("perMonth")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("garageFreeDesc")}
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    {[
                      t("garageFreeF1"),
                      t("garageFreeF2"),
                      t("garageFreeF3"),
                      t("garageFreeF4"),
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="mt-8 w-full"
                >
                  <Link href="/register?role=GARAGE_OWNER">
                    {t("ctaGarage")}
                  </Link>
                </Button>
              </Card>

              {/* Garage Pro */}
              {garageSubscriptionsEnabled ? (
                <Card className="relative flex flex-col justify-between border-primary/45 p-7 shadow-glow-blue">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground">
                        {t("garageProName")}
                      </h3>
                      <Badge variant="violet">{t("recommended")}</Badge>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-mono text-4xl font-extrabold text-foreground">
                        {garageProPriceLabel}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t("perMonth")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t("garageProDesc")}
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-foreground">
                      {[
                        t("garageProF1"),
                        t("garageProF2"),
                        t("garageProF3"),
                        t("garageProF4"),
                      ].map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    asChild
                    variant="gradient"
                    size="lg"
                    className="mt-8 w-full"
                  >
                    <Link href="/register?role=GARAGE_OWNER">
                      {t("ctaGarage")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </Card>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

export function FaqSection({ cmsFaqs }: { cmsFaqs?: PlatformFaqItem[] }) {
  const t = useTranslations("faq");
  const locale = useLocale() as AppLocale;

  const items =
    cmsFaqs && cmsFaqs.length > 0
      ? cmsFaqs.map((f) => ({
          q:
            locale === "bg"
              ? f.questionBg || f.questionEn
              : f.questionEn || f.questionBg,
          a:
            locale === "bg"
              ? f.answerBg || f.answerEn
              : f.answerEn || f.answerBg,
        }))
      : [
          { q: t("q1"), a: t("a1") },
          { q: t("q2"), a: t("a2") },
          { q: t("q3"), a: t("a3") },
          { q: t("q4"), a: t("a4") },
          { q: t("q5"), a: t("a5") },
          { q: t("q6"), a: t("a6") },
        ];

  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container max-w-3xl">
        <div className="text-center">
          <Badge variant="outline" className="mb-4">
            {t("eyebrow")}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10 w-full">
          {items.map((item, idx) => (
            <AccordionItem key={item.q} value={`faq-${idx}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function BottomCtaSection() {
  const t = useTranslations("ctaBanner");

  return (
    <section className="py-16 sm:py-24">
      <div className="container">
        <div className="glass-card relative overflow-hidden rounded-3xl border border-primary/30 px-6 py-14 text-center sm:px-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-veltrox-glow"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              {t("subtitle")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <AnimatedCtaButton href="/register?role=USER">
                {t("buttonPrimary")}
                <ArrowRight className="h-4 w-4" />
              </AnimatedCtaButton>
              <Button asChild variant="glass" size="lg">
                <Link href="/register?role=GARAGE_OWNER">
                  {t("buttonSecondary")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="border-t border-border bg-secondary/20 py-12">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              {t("product")}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/#features" className="hover:text-foreground">
                  {tNav("features")}
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-foreground">
                  {tNav("pricing")}
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-foreground">
                  {tNav("faq")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              {t("legal")}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  {t("terms")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT)
                    )
                  }
                  className="text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {t("cookieSettings")}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Veltrox. {t("rights")}
        </div>
      </div>
    </footer>
  );
}

