"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";

export function HeroDashboardMockup() {
  const tHero = useTranslations("hero");
  const tCommon = useTranslations("common");
  const [activeView, setActiveView] = useState<"owner" | "garage">("owner");

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Ambient Radial Glow Behind Mockup */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-r from-blue-600/20 via-violet-600/15 to-orange-500/15 blur-2xl"
      />

      <div className="glass-card relative overflow-hidden rounded-2xl border border-slate-900/10 dark:border-white/10 p-3 sm:p-5">
        {/* Top Window Chrome + Explicit Demo Data Label */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500/70" />
            <span className="h-3 w-3 rounded-full bg-amber-500/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
            <Badge variant="demo" className="ml-2">
              {tCommon("demoData")}
            </Badge>
          </div>

          <div
            role="tablist"
            aria-label="Preview mode"
            className="inline-flex rounded-xl border border-border bg-secondary/70 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "owner"}
              onClick={() => setActiveView("owner")}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeView === "owner"
                  ? "bg-veltrox-gradient text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Car className="h-3.5 w-3.5" aria-hidden="true" />
              {tHero("tabOwner")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "garage"}
              onClick={() => setActiveView("garage")}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeView === "garage"
                  ? "bg-veltrox-gradient text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
              {tHero("tabGarage")}
            </button>
          </div>
        </div>

        {/* Animated Interactive Body */}
        <div className="mt-4 min-h-[300px]">
          <AnimatePresence mode="wait">
            {activeView === "owner" ? (
              <motion.div
                key="owner-preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="grid gap-4 md:grid-cols-12"
              >
                {/* Left Column: Vehicle Summary & Animated Counters */}
                <div className="space-y-4 md:col-span-7">
                  <div className="rounded-2xl border border-border bg-secondary/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                          <Car className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">
                            {tHero("mockup.ownerVehicle")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            2021 • Diesel • Automatic
                          </p>
                        </div>
                      </div>
                      <Badge variant="demo">{tCommon("demoData")}</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2.5">
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <p className="text-[11px] text-muted-foreground">
                          {tHero("mockup.ownerTrackedMileage")}
                        </p>
                        <p className="mt-1 font-mono text-lg font-bold text-foreground">
                          <AnimatedCounter value={142850} />
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <p className="text-[11px] text-muted-foreground">
                          {tHero("mockup.ownerCostPerKm")}
                        </p>
                        <p className="mt-1 font-mono text-lg font-bold text-foreground">
                          <AnimatedCounter value={0.14} decimals={2} prefix="€" />
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <p className="text-[11px] text-muted-foreground">
                          {tHero("mockup.ownerDocsStored")}
                        </p>
                        <p className="mt-1 font-mono text-lg font-bold text-foreground">
                          <AnimatedCounter value={6} />
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Linked Garage Synced Entry */}
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/[0.07] p-4">
                    <div className="flex items-start gap-3">
                      <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {tHero("mockup.ownerRecentService")}
                        </p>
                        <Badge variant="violet" className="mt-1.5">
                          <Sparkles className="h-3 w-3" />
                          {tHero("mockup.ownerSyncedBadge")}
                        </Badge>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      €185.00
                    </span>
                  </div>
                </div>

                {/* Right Column: Upcoming Reminders */}
                <div className="flex flex-col justify-between gap-3 md:col-span-5">
                  <div className="rounded-2xl border border-orange-500/30 bg-orange-500/[0.08] p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="warning">
                        <BellRing className="h-3 w-3" />
                        Reminder
                      </Badge>
                      <Badge variant="demo">{tCommon("demoData")}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      {tHero("mockup.ownerNextOil")}
                    </p>
                    <p className="mt-1 font-mono text-xs text-orange-600 dark:text-orange-300">
                      {tHero("mockup.ownerNextOilDue")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-secondary/35 p-4">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        Vault OK
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {tHero("mockup.ownerVignette")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tHero("mockup.ownerVignetteDue")}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="garage-preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="grid gap-4 md:grid-cols-12"
              >
                <div className="space-y-3 md:col-span-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Search className="h-4 w-4 text-primary" />
                      <span className="font-mono text-foreground">
                        {tHero("mockup.garageQuickSearch")}
                      </span>
                    </div>
                    <Badge variant="demo">{tCommon("demoData")}</Badge>
                  </div>

                  {[
                    {
                      plate: tHero("mockup.garageOrder1Plate"),
                      car: tHero("mockup.garageOrder1Car"),
                      status: tHero("mockup.garageOrder1Status"),
                      variant: "default" as const,
                    },
                    {
                      plate: tHero("mockup.garageOrder2Plate"),
                      car: tHero("mockup.garageOrder2Car"),
                      status: tHero("mockup.garageOrder2Status"),
                      variant: "warning" as const,
                    },
                    {
                      plate: tHero("mockup.garageOrder3Plate"),
                      car: tHero("mockup.garageOrder3Car"),
                      status: tHero("mockup.garageOrder3Status"),
                      variant: "success" as const,
                    },
                  ].map((order) => (
                    <div
                      key={order.plate}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-foreground">
                          {order.plate}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {order.car}
                        </span>
                      </div>
                      <Badge variant={order.variant}>{order.status}</Badge>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col justify-between gap-3 md:col-span-4">
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Retention
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {tHero("mockup.garageAutoReminder")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-secondary/35 p-4">
                    <div className="flex items-center gap-2 text-violet-400">
                      <ExternalLink className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Live Link
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {tHero("mockup.garagePublicLink")}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

