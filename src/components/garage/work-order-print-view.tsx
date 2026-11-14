"use client";

import { ArrowLeft, FileText, Printer, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  AppLocale,
  Customer,
  Garage,
  WorkOrder,
  WorkOrderItem,
} from "@/types/domain";

interface WorkOrderPrintViewProps {
  garage: Garage;
  workOrder: WorkOrder;
  items: WorkOrderItem[];
  customer: Customer | null;
  initialMode: "intake" | "invoice";
}

export function WorkOrderPrintView({
  garage,
  workOrder,
  items,
  customer,
  initialMode,
}: WorkOrderPrintViewProps) {
  const t = useTranslations("garageWorkspace.print");
  const tWo = useTranslations("garageWorkspace.workOrders");
  const locale = useLocale() as AppLocale;
  const [mode, setMode] = useState<"intake" | "invoice">(initialMode);

  const clientName =
    customer?.fullName || workOrder.customerName || t("walkInClient");
  const clientPhone = customer?.phone || workOrder.customerPhone || "—";
  const mergedPhotos = Array.from(
    new Set([
      ...(workOrder.dropOffPhotoUrls ?? []),
      ...(workOrder.beforePhotoUrls ?? []),
      ...(workOrder.afterPhotoUrls ?? []),
    ])
  ).slice(0, 6);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 print:bg-white print:p-0">
      {/* Screen-only toolbar */}
      <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/garage/work-orders/${workOrder.id}`}>
              <ArrowLeft className="h-4 w-4" />
              {t("backToOrder")}
            </Link>
          </Button>
          <Button
            type="button"
            variant={mode === "intake" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("intake")}
          >
            <FileText className="h-4 w-4" />
            {t("modeIntake")}
          </Button>
          <Button
            type="button"
            variant={mode === "invoice" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("invoice")}
          >
            <FileText className="h-4 w-4" />
            {t("modeInvoice")}
          </Button>
        </div>

        <Button
          type="button"
          variant="gradient"
          size="sm"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          {t("printPdfBtn")}
        </Button>
      </div>

      {/* Printable A4 Sheet */}
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-lg print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-6">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-blue-600">
              Veltrox Garage OS • #{workOrder.id.slice(-8).toUpperCase()}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
              {mode === "intake" ? t("intakeHeading") : t("invoiceHeading")}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {garage.name} • {garage.city}, {garage.address} • {garage.phone}
            </p>
          </div>

          <div className="text-right font-mono text-xs text-slate-600">
            <p>
              {t("dateLabel")}:{" "}
              {formatDate(
                mode === "invoice"
                  ? workOrder.completedAt ?? workOrder.updatedAt
                  : workOrder.createdAt,
                locale
              )}
            </p>
            <p className="mt-1 text-base font-bold text-slate-900">
              {workOrder.plateNumber}
            </p>
            <p>{workOrder.vehicleLabel}</p>
          </div>
        </header>

        {/* Client & Vehicle Block */}
        <section className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-slate-500">
              {t("clientBlock")}
            </p>
            <p className="text-sm font-bold text-slate-900">{clientName}</p>
            <p className="font-mono text-slate-700">{clientPhone}</p>
            {customer?.email ? (
              <p className="text-slate-600">{customer.email}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-slate-500">
              {t("vehicleBlock")}
            </p>
            <p className="text-sm font-bold text-slate-900">
              {workOrder.vehicleLabel} ({workOrder.plateNumber})
            </p>
            <p className="font-mono text-slate-700">
              {t("mileage")}:{" "}
              {workOrder.mileageKm
                ? `${workOrder.mileageKm.toLocaleString()} km`
                : "—"}
            </p>
            {mode === "intake" && workOrder.intakeFuelLevel ? (
              <p className="text-slate-700">
                {t("fuelLevel")}: {t(`fuel_${workOrder.intakeFuelLevel}`)}
              </p>
            ) : null}
          </div>
        </section>

        {mode === "intake" ? (
          <>
            {/* Intake Condition & Reported Requests */}
            <section className="mt-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  {t("intakeConditionHeading")}
                </h2>
                <div className="mt-2 min-h-20 rounded-xl border border-slate-200 p-4 text-sm text-slate-800 whitespace-pre-line">
                  {workOrder.intakeConditionNotes ||
                    workOrder.customerSummary ||
                    t("noConditionNotes")}
                </div>
              </div>

              {workOrder.dtcCodes && workOrder.dtcCodes.length > 0 ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    {t("diagnosticsHeading")}
                  </h2>
                  <div className="mt-2 space-y-1 rounded-xl border border-slate-200 p-4 text-xs">
                    {workOrder.dtcCodes.map((dtc, i) => (
                      <p key={`${dtc.code}-${i}`} className="font-mono">
                        <strong>{dtc.code}</strong> [{dtc.severity.toUpperCase()}]
                        : {dtc.description}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {mergedPhotos.length > 0 ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    {t("photosHeading")}
                  </h2>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {mergedPhotos.map((url) => (
                      <div
                        key={url}
                        className="aspect-video overflow-hidden rounded-lg border border-slate-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt="Vehicle intake"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <>
            {/* Service Work Performed */}
            {workOrder.customerSummary ? (
              <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t("workSummaryHeading")}
                </h2>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-800">
                  {workOrder.customerSummary}
                </p>
              </section>
            ) : null}

            {/* Invoice Table */}
            <section className="mt-6">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">{t("colType")}</th>
                    <th className="py-2 pr-3">{t("colDescription")}</th>
                    <th className="py-2 px-3 text-right">{t("colQty")}</th>
                    <th className="py-2 px-3 text-right">{t("colUnitPrice")}</th>
                    <th className="py-2 pl-3 text-right">{t("colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-xs text-slate-500"
                      >
                        {t("noItems")}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 pr-3 font-mono text-xs uppercase text-slate-600">
                          {item.type === "labor"
                            ? tWo("typeLabor")
                            : tWo("typePart")}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-slate-900">
                          {item.description}
                          {item.sku ? (
                            <span className="ml-2 font-mono text-xs text-slate-500">
                              [{item.sku}]
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatCurrency(
                            item.unitPrice,
                            locale,
                            workOrder.currency
                          )}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono font-semibold">
                          {formatCurrency(
                            item.totalPrice,
                            locale,
                            workOrder.currency
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>{tWo("laborTotal")}:</span>
                    <span className="font-mono">
                      {formatCurrency(
                        workOrder.totalLaborAmount,
                        locale,
                        workOrder.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{tWo("partsTotal")}:</span>
                    <span className="font-mono">
                      {formatCurrency(
                        workOrder.totalPartsAmount,
                        locale,
                        workOrder.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-extrabold text-slate-900">
                    <span>{tWo("grandTotal")}:</span>
                    <span className="font-mono">
                      {formatCurrency(
                        workOrder.totalAmount,
                        locale,
                        workOrder.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Signatures Footer */}
        <footer className="mt-10 grid grid-cols-2 gap-8 border-t border-slate-200 pt-8 text-xs text-slate-600">
          <div>
            <p className="font-semibold text-slate-800">{t("advisorSig")}</p>
            <div className="mt-8 border-b border-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("customerSig")}</p>
            <div className="mt-8 border-b border-slate-400" />
          </div>
        </footer>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
          {t("generatedBy")}
        </p>
      </article>
    </div>
  );
}

