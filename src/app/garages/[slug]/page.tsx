import {
  ArrowLeft,
  Clock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GarageBookingButton } from "@/components/car-diary/garage-directory-client";
import { Footer } from "@/components/marketing/landing-sections";
import { Navbar } from "@/components/marketing/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import {
  getApprovedGarageBySlug,
  getUserDiaryBundle,
} from "@/lib/data/user-diary";

interface GarageProfilePageProps {
  params: Promise<{ slug: string }>;
}

const ORDERED_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

const SCHEMA_DAY_MAP: Record<(typeof ORDERED_DAYS)[number], string> = {
  mon: "https://schema.org/Monday",
  tue: "https://schema.org/Tuesday",
  wed: "https://schema.org/Wednesday",
  thu: "https://schema.org/Thursday",
  fri: "https://schema.org/Friday",
  sat: "https://schema.org/Saturday",
  sun: "https://schema.org/Sunday",
};

export async function generateMetadata({
  params,
}: GarageProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const garage = await getApprovedGarageBySlug(slug);
  if (!garage) {
    return { title: "Garage Not Found" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const description =
    garage.description ||
    `${garage.name} — ${garage.city}, ${garage.address}. ${garage.servicesOffered.slice(0, 5).join(", ")}`;

  return {
    title: `${garage.name} (${garage.city})`,
    description,
    alternates: {
      canonical: `${appUrl}/garages/${garage.slug}`,
    },
    openGraph: {
      title: `${garage.name} | Veltrox`,
      description,
      url: `${appUrl}/garages/${garage.slug}`,
      type: "website",
    },
  };
}

export default async function PublicGarageProfilePage({
  params,
}: GarageProfilePageProps) {
  const { slug } = await params;
  const [garage, authCtx, t, tDays] = await Promise.all([
    getApprovedGarageBySlug(slug),
    getCurrentAuthContext(),
    getTranslations("carDiary.garagesDir"),
    getTranslations("carDiary.garagesDir.days"),
  ]);

  if (!garage) {
    notFound();
  }

  const userBundle =
    authCtx && authCtx.profile.role === "USER"
      ? await getUserDiaryBundle(authCtx.profile.uid)
      : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Honest LocalBusiness / AutoRepair JSON-LD (strictly real fields, zero fake ratings)
  const openingHoursSpecification = ORDERED_DAYS.filter(
    (day) => garage.workingHours?.[day] && !garage.workingHours[day].closed
  ).map((day) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: SCHEMA_DAY_MAP[day],
    opens: garage.workingHours[day].open,
    closes: garage.workingHours[day].close,
  }));

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: garage.name,
    url: `${appUrl}/garages/${garage.slug}`,
    telephone: garage.phone,
    email: garage.email,
    description: garage.description ?? undefined,
    image: garage.logoUrl ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: garage.address,
      addressLocality: garage.city,
    },
    openingHoursSpecification,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessSchema),
        }}
      />
      <Navbar />

      <main className="flex-1 bg-grid-subtle py-10 sm:py-16">
        <div className="container space-y-8">
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href="/garages">
                <ArrowLeft className="h-4 w-4" />
                {t("pageTitle")}
              </Link>
            </Button>
          </div>

          {/* Hero Profile Card */}
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-glow-blue">
                  {garage.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={garage.logoUrl}
                      alt={garage.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Wrench className="h-9 w-9" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                      {garage.name}
                    </h1>
                    <Badge variant="success">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Veltrox Verified
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      {garage.city}, {garage.address}
                    </span>
                    <a
                      href={`tel:${garage.phone}`}
                      className="inline-flex items-center gap-1.5 text-foreground hover:text-primary"
                    >
                      <Phone className="h-4 w-4 text-primary" />
                      {garage.phone}
                    </a>
                    {garage.email ? (
                      <a
                        href={`mailto:${garage.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary"
                      >
                        <Mail className="h-4 w-4 text-primary" />
                        {garage.email}
                      </a>
                    ) : null}
                  </div>

                  {garage.description ? (
                    <p className="max-w-2xl pt-1 text-sm leading-relaxed text-muted-foreground">
                      {garage.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0">
                <GarageBookingButton
                  garage={garage}
                  userVehicles={userBundle?.vehicles ?? []}
                  userProfile={authCtx?.profile ?? null}
                />
              </div>
            </div>
          </Card>

          {/* Services + Working Hours Grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="p-6 lg:col-span-7">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Wrench className="h-5 w-5 text-primary" />
                {t("servicesOffered")}
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {garage.servicesOffered.map((service) => (
                  <Badge
                    key={service}
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                  >
                    {service}
                  </Badge>
                ))}
              </div>
            </Card>

            <Card className="p-6 lg:col-span-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Clock className="h-5 w-5 text-primary" />
                {t("workingHours")}
              </h2>

              <dl className="mt-4 divide-y divide-border text-sm">
                {ORDERED_DAYS.map((day) => {
                  const slot = garage.workingHours?.[day];
                  const isClosed = !slot || slot.closed;
                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between py-2.5"
                    >
                      <dt className="font-medium text-foreground">
                        {tDays(day)}
                      </dt>
                      <dd className="font-mono text-xs text-muted-foreground">
                        {isClosed
                          ? t("closed")
                          : `${slot.open} – ${slot.close}`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

