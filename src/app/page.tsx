import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HeroDashboardMockup } from "@/components/marketing/hero-dashboard-mockup";
import {
  BentoFeaturesSection,
  BottomCtaSection,
  FaqSection,
  Footer,
  PricingSection,
  TrustSection,
} from "@/components/marketing/landing-sections";
import { Navbar } from "@/components/marketing/navbar";
import { AnnouncementBanner } from "@/components/shared/announcement-banner";
import { AnimatedCtaButton } from "@/components/ui/animated-cta-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicPlatformCms } from "@/lib/data/platform-cms";
import type { AppLocale } from "@/types/domain";

export default async function LandingPage() {
  const tHero = await getTranslations("hero");
  const tMeta = await getTranslations("metadata");
  const tFaq = await getTranslations("faq");
  const tShell = await getTranslations("shell");
  const locale = (await getLocale()) as AppLocale;
  const cms = await getPublicPlatformCms();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const faqEntities =
    cms.faqs.length > 0
      ? cms.faqs.map((f) => ({
          "@type": "Question",
          name:
            locale === "bg"
              ? f.questionBg || f.questionEn
              : f.questionEn || f.questionBg,
          acceptedAnswer: {
            "@type": "Answer",
            text:
              locale === "bg"
                ? f.answerBg || f.answerEn
                : f.answerEn || f.answerBg,
          },
        }))
      : [1, 2, 3, 4, 5, 6].map((n) => ({
          "@type": "Question",
          name: tFaq(`q${n}` as "q1"),
          acceptedAnswer: {
            "@type": "Answer",
            text: tFaq(`a${n}` as "a1"),
          },
        }));

  // Structured data without any fake aggregate ratings or fabricated review counts
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Veltrox",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: appUrl,
      description: tMeta("description"),
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqEntities,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        {tShell("skipToContent")}
      </a>

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static server-rendered JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <AnnouncementBanner initialBanner={cms.banner} />
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-grid-subtle pt-14 pb-20 sm:pt-20 sm:pb-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-veltrox-glow"
          />

          <div className="container relative">
            <div className="mx-auto max-w-4xl text-center">
              <Badge variant="default" className="mb-6 py-1 px-3.5 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {tHero("eyebrow")}
              </Badge>

              <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-[4rem] lg:leading-[1.08]">
                {tHero("titleLine1")}{" "}
                <span className="text-gradient-veltrox">
                  {tHero("titleHighlight")}
                </span>{" "}
                {tHero("titleLine2")}
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {tHero("subtitle")}
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
                <AnimatedCtaButton href="/register?role=USER">
                  {tHero("primaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </AnimatedCtaButton>
                <Button asChild variant="glass" size="lg">
                  <Link href="/register?role=GARAGE_OWNER">
                    {tHero("secondaryCta")}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-14 sm:mt-16">
              <HeroDashboardMockup />
            </div>
          </div>
        </section>

        <TrustSection />
        <BentoFeaturesSection />
        <PricingSection />
        <FaqSection cmsFaqs={cms.faqs} />
        <BottomCtaSection />
      </main>

      <Footer />
    </div>
  );
}
