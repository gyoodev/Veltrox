import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import {
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: t("title"),
      template: "%s | Veltrox",
    },
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: "Veltrox",
      title: t("title"),
      description: t("description"),
      url: appUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const authCtx = await getCurrentAuthContext();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders initialProfile={authCtx?.profile ?? null}>
            {children}
            <CookieConsent />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

