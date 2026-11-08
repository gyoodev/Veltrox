"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  AppLocale,
  DiaryEntry,
  UserProfile,
  Vehicle,
} from "@/types/domain";

interface ServiceBookPrintProps {
  vehicle: Vehicle;
  owner: UserProfile;
  entries: DiaryEntry[];
  totalInvestedEur: number;
}

export function ServiceBookPrint({
  vehicle,
  owner,
  entries,
  totalInvestedEur,
}: ServiceBookPrintProps) {
  const t = useTranslations("carDiary.serviceBook");
  const tFuel = useTranslations("carDiary.fuelTypes");
  const tCat = useTranslations("carDiary.categories");
  const locale = useLocale() as AppLocale;

  const sortedAsc = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      {/* Screen-Only Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/cars/${vehicle.id}`}>
            <ArrowLeft className="h-4 w-4" />
            {t("backToCar")}
          </Link>
        </Button>

        <Button
          type="button"
          variant="gradient"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          {t("printPdfButton")}
        </Button>
      </div>

      {/* Print-Ready A4 Sheet */}
      <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-white p-8 text-slate-900 shadow-lg print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-6">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-blue-600">
              VELTROX • VERIFIED LOG
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
          </div>
          <div className="text-right font-mono text-xs text-slate-600">
            <p>{t("generatedOn")}:</p>
            <p className="font-semibold text-slate-900">
              {formatDate(new Date().toISOString(), locale)}
            </p>
          </div>
        </header>

        {/* Vehicle Identification Grid */}
        <section className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Vehicle
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {vehicle.make} {vehicle.model}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("plateLabel")}
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
              {vehicle.plateNumber}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("vinLabel")}
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
              {vehicle.vin || "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("yearFuelLabel")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {vehicle.year} • {tFuel(vehicle.fuelType)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("currentMileageLabel")}
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
              {vehicle.currentMileageKm.toLocaleString()} km
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("totalInvestedLabel")}
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
              {formatCurrency(totalInvestedEur, locale, "EUR")} (
              {t("ownerLabel")}: {owner.displayName})
            </p>
          </div>
        </section>

        {/* Chronological Maintenance Table */}
        <section className="mt-8">
          <h2 className="text-base font-bold text-slate-900">
            {t("historyHeading")} ({sortedAsc.length})
          </h2>

          {sortedAsc.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("emptyRecords")}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="py-2.5 pr-3 font-semibold">{t("colDate")}</th>
                    <th className="py-2.5 px-3 font-semibold">
                      {t("colMileage")}
                    </th>
                    <th className="py-2.5 px-3 font-semibold">
                      {t("colCategory")}
                    </th>
                    <th className="py-2.5 px-3 font-semibold">
                      {t("colDescription")}
                    </th>
                    <th className="py-2.5 px-3 font-semibold">
                      {t("colSource")}
                    </th>
                    <th className="py-2.5 pl-3 text-right font-semibold">
                      {t("colCost")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedAsc.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="whitespace-nowrap py-3 pr-3 font-mono text-slate-800">
                        {formatDate(entry.date, locale)}
                      </td>
                      <td className="whitespace-nowrap py-3 px-3 font-mono font-semibold text-slate-900">
                        {entry.mileageKm.toLocaleString()} km
                      </td>
                      <td className="whitespace-nowrap py-3 px-3 text-slate-700">
                        {tCat(entry.category)}
                      </td>
                      <td className="py-3 px-3 text-slate-900">
                        <p className="font-semibold">{entry.title}</p>
                        {entry.notes ? (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            {entry.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap py-3 px-3 text-slate-700">
                        {entry.garageId
                          ? entry.garageName || t("sourceGarage")
                          : t("sourceOwner")}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(
                          entry.costAmount,
                          locale,
                          entry.currency
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-[11px] text-slate-500">
          {t("footerDisclaimer")}
        </footer>
      </article>
    </div>
  );
}

