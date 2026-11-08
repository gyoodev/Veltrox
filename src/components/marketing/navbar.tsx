"use client";

import { ArrowRight, LayoutDashboard, Menu, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { getRoleHomePath } from "@/lib/auth/edge-session";

export function Navbar() {
  const t = useTranslations("nav");
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardHref = profile
    ? getRoleHomePath(profile.role, profile.garageStatus)
    : "/app";

  const navItems = [
    { href: "/#features", label: t("features") },
    { href: "/garages", label: t("findGarage") },
    { href: "/#pricing", label: t("pricing") },
    { href: "/#faq", label: t("faq") },
  ];

  return (
    <header className="glass-panel sticky top-0 z-30 w-full">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 md:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          {profile ? (
            <Button asChild variant="gradient" size="sm" className="ml-2 h-10 px-4">
              <Link href={dashboardHref}>
                <LayoutDashboard className="h-4 w-4" />
                {t("dashboard")}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="h-10 px-4">
                <Link href="/login">{t("signIn")}</Link>
              </Button>
              <Button
                asChild
                variant="gradient"
                size="sm"
                className="h-10 px-4"
              >
                <Link href="/register">
                  {t("getStarted")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-background/95 px-5 py-5 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Mobile">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 text-base font-medium text-foreground hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2.5 border-t border-border pt-4">
              {profile ? (
                <Button asChild variant="gradient" className="w-full">
                  <Link
                    href={dashboardHref}
                    onClick={() => setMobileOpen(false)}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t("dashboard")}
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      {t("signIn")}
                    </Link>
                  </Button>
                  <Button asChild variant="gradient" className="w-full">
                    <Link href="/register" onClick={() => setMobileOpen(false)}>
                      {t("getStarted")}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

