"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localeLabels, locales } from "@/i18n/config";
import type { AppLocale } from "@/types/domain";

export function LanguageSwitcher() {
  const currentLocale = useLocale() as AppLocale;
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelectLocale = (nextLocale: AppLocale) => {
    if (nextLocale === currentLocale) return;

    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={t("switchLanguage")}
          className="h-10 gap-1.5 rounded-xl px-3 font-mono text-xs font-semibold"
        >
          <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{localeLabels[currentLocale]?.short ?? "БГ"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleSelectLocale(loc)}
            className={
              loc === currentLocale ? "bg-secondary font-semibold" : ""
            }
          >
            <span className="font-mono text-xs text-primary">
              {localeLabels[loc].short}
            </span>
            <span>{localeLabels[loc].native}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

