import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("auth");

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-12">
      {/* Left Brand Showcase Column (Desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-[#070B15] p-10 text-white lg:col-span-5 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-veltrox-glow"
        />
        <div className="relative z-10">
          <Logo className="text-white [&_span]:text-white" />
        </div>

        <div className="relative z-10 max-w-md space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1 text-xs font-medium text-blue-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            GDPR • Multi-Tenant • Firebase Security
          </div>
          <p className="text-2xl font-semibold leading-snug tracking-tight text-slate-100">
            “{t("showcaseQuote")}”
          </p>
        </div>

        <p className="relative z-10 font-mono text-xs text-slate-400">
          Veltrox Platform
        </p>
      </div>

      {/* Right Interactive Auth Column */}
      <div className="flex flex-col lg:col-span-7">
        <header className="flex h-16 items-center justify-between px-6 sm:px-10">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}

