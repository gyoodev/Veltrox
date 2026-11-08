import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/marketing/landing-sections";
import { Navbar } from "@/components/marketing/navbar";
import { Card } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return {
    title: t("termsTitle"),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("legal");

  const sections = [
    { title: t("termsS1Title"), body: t("termsS1Body") },
    { title: t("termsS2Title"), body: t("termsS2Body") },
    { title: t("termsS3Title"), body: t("termsS3Body") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="container max-w-3xl flex-1 py-14 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          {t("termsUpdated")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("termsTitle")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {t("termsIntro")}
        </p>

        <div className="mt-8 space-y-5">
          {sections.map((sec) => (
            <Card key={sec.title} className="p-6">
              <h2 className="text-lg font-semibold text-foreground">
                {sec.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {sec.body}
              </p>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

