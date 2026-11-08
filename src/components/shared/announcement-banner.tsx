"use client";

import { ArrowRight, CheckCircle2, Info, Megaphone, X } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AnnouncementBanner as BannerData, AppLocale } from "@/types/domain";

interface AnnouncementBannerProps {
  initialBanner?: BannerData | null;
}

export function AnnouncementBanner({ initialBanner }: AnnouncementBannerProps) {
  const locale = useLocale() as AppLocale;
  const [banner, setBanner] = useState<BannerData | null>(initialBanner ?? null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (initialBanner !== undefined) return;
    let active = true;
    fetch("/api/platform-banner", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { banner?: BannerData } | null) => {
        if (active && data?.banner) {
          setBanner(data.banner);
        }
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [initialBanner]);

  if (!banner || !banner.enabled || dismissed) {
    return null;
  }

  const message =
    locale === "bg"
      ? banner.messageBg || banner.messageEn
      : banner.messageEn || banner.messageBg;
  if (!message) {
    return null;
  }

  const linkLabel =
    locale === "bg"
      ? banner.linkLabelBg || banner.linkLabelEn
      : banner.linkLabelEn || banner.linkLabelBg;

  const Icon =
    banner.variant === "warning"
      ? Megaphone
      : banner.variant === "success"
        ? CheckCircle2
        : Info;

  return (
    <div
      role="region"
      aria-label={locale === "bg" ? "Системно съобщение" : "Platform announcement"}
      className={cn(
        "border-b px-4 py-2.5 text-xs sm:px-8 sm:text-sm print:hidden",
        banner.variant === "warning"
          ? "border-amber-500/35 bg-amber-500/12 text-foreground"
          : banner.variant === "success"
            ? "border-emerald-500/35 bg-emerald-500/12 text-foreground"
            : "border-primary/35 bg-primary/12 text-foreground"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              banner.variant === "warning"
                ? "text-amber-400"
                : banner.variant === "success"
                  ? "text-emerald-400"
                  : "text-primary"
            )}
            aria-hidden="true"
          />
          <span className="font-medium">{message}</span>
          {banner.linkUrl && linkLabel ? (
            <Link
              href={banner.linkUrl}
              className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
            >
              <span>{linkLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={locale === "bg" ? "Затвори банера" : "Dismiss announcement"}
          className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

