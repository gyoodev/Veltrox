import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GarageDirectoryClient } from "@/components/car-diary/garage-directory-client";
import { Footer } from "@/components/marketing/landing-sections";
import { Navbar } from "@/components/marketing/navbar";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getApprovedGarages, getUserDiaryBundle } from "@/lib/data/user-diary";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("carDiary.garagesDir");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: {
      canonical: `${appUrl}/garages`,
    },
    openGraph: {
      title: `${t("pageTitle")} | Veltrox`,
      description: t("pageSubtitle"),
      url: `${appUrl}/garages`,
      type: "website",
    },
  };
}

export default async function PublicGaragesDirectoryPage() {
  const [garages, authCtx, t] = await Promise.all([
    getApprovedGarages(),
    getCurrentAuthContext(),
    getTranslations("carDiary.garagesDir"),
  ]);

  const userBundle =
    authCtx && authCtx.profile.role === "USER"
      ? await getUserDiaryBundle(authCtx.profile.uid)
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 bg-grid-subtle py-12 sm:py-16">
        <div className="container space-y-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {t("pageSubtitle")}
            </p>
          </div>

          <GarageDirectoryClient
            garages={garages}
            userVehicles={userBundle?.vehicles ?? []}
            userProfile={authCtx?.profile ?? null}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}

