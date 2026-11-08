"use client";

import {
  ArrowLeft,
  ArrowRight,
  Disc3,
  Download,
  Link2,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { STATUS_BADGE_VARIANT } from "@/components/garage/work-orders-board-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LinkedVehicleMatch } from "@/lib/data/garage";
import { formatCurrency, formatDate } from "@/lib/utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import type {
  AppLocale,
  Customer,
  TyreSet,
  WorkOrder,
} from "@/types/domain";

interface CustomersLookupClientProps {
  initialCustomers: Customer[];
  isManager: boolean;
}

export function CustomersLookupClient({
  initialCustomers,
  isManager,
}: CustomersLookupClientProps) {
  const t = useTranslations("garageWorkspace.customers");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [platesRaw, setPlatesRaw] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const normQ = normalizeLicensePlate(query);
    if (!q) return customers;

    return customers.filter((c) => {
      const normPlates =
        c.platesNormalized ?? c.plateNumbers.map((p) => normalizeLicensePlate(p));
      const plateHit =
        normQ.length > 0 && normPlates.some((np) => np.includes(normQ));
      return (
        plateHit ||
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [customers, query]);

  const openModal = (cust: Customer | null) => {
    setEditingCustomer(cust);
    setFullName(cust?.fullName ?? "");
    setPhone(cust?.phone ?? "");
    setEmail(cust?.email ?? "");
    setPlatesRaw(cust ? cust.plateNumbers.join(", ") : "");
    setNotes(cust?.notes ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const plateNumbers = platesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (fullName.trim().length < 2 || phone.trim().length < 7 || plateNumbers.length === 0) {
      toast.error("Enter name, valid phone, and at least one license plate.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = editingCustomer
        ? `/api/garage/customers/${editingCustomer.id}`
        : "/api/garage/customers";
      const method = editingCustomer ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          plateNumbers,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to save customer.");
        return;
      }

      const json = (await res.json()) as { customer: Customer };
      setCustomers((prev) => {
        const exists = prev.some((c) => c.id === json.customer.id);
        return exists
          ? prev.map((c) => (c.id === json.customer.id ? json.customer : c))
          : [json.customer, ...prev];
      });
      toast.success(t("savedToast"));
      setDialogOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (customerId: string) => {
    const prev = customers;
    setCustomers((list) => list.filter((c) => c.id !== customerId));

    const res = await fetch(`/api/garage/customers/${customerId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setCustomers(prev);
      toast.error("Delete failed.");
      return;
    }
    toast.success(t("deletedToast"));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isManager ? (
            <Button asChild variant="outline" size="sm">
              <a href="/api/garage/export?type=customers" download>
                <Download className="h-4 w-4" />
                {t("exportCsv")}
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="gradient"
            onClick={() => openModal(null)}
          >
            <Plus className="h-4 w-4" />
            {t("addCustomerBtn")}
          </Button>
        </div>
      </div>

      {/* Prominent Plate Lookup Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("plateSearchHero")}
          aria-label={t("plateSearchHero")}
          className="h-12 pl-12 font-mono text-sm sm:text-base"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Button
              type="button"
              variant="gradient"
              onClick={() => openModal(null)}
            >
              <Plus className="h-4 w-4" />
              {t("addCustomerBtn")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cust) => (
            <Card
              key={cust.id}
              hoverLift
              className="flex flex-col justify-between p-5"
            >
              <div className="space-y-3">
                {/* Primary Key UI: License Plates prominently at top */}
                <div className="flex flex-wrap gap-1.5">
                  {cust.plateNumbers.map((plate) => (
                    <span
                      key={plate}
                      className="rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-foreground"
                    >
                      {plate}
                    </span>
                  ))}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {cust.fullName}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      {cust.phone}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openModal(cust)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isManager ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDelete(cust.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {cust.lastVisitAt ? (
                  <p className="text-xs text-muted-foreground">
                    {t("lastVisit")}: {formatDate(cust.lastVisitAt, locale)}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 border-t border-border pt-3.5">
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <Link href={`/garage/customers/${cust.id}`}>
                    {t("openHistory")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? t("editCustomerBtn") : t("addCustomerBtn")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cust-plates">{t("platesLabel")}</Label>
              <Input
                id="cust-plates"
                value={platesRaw}
                onChange={(e) => setPlatesRaw(e.target.value)}
                placeholder={t("platesPlaceholder")}
                className="font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-name">{t("fullName")}</Label>
              <Input
                id="cust-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">{t("phone")}</Label>
                <Input
                  id="cust-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+359 88 123 4567"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-email">{t("email")}</Label>
                <Input
                  id="cust-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-notes">{t("notes")}</Label>
              <textarea
                id="cust-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="gradient"
              disabled={submitting}
              onClick={() => void handleSave()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CustomerHistoryClientProps {
  customer: Customer;
  workOrders: WorkOrder[];
  tyreSets: TyreSet[];
  vehicleMatches: Record<string, LinkedVehicleMatch | null>;
}

export function CustomerHistoryClient({
  customer,
  workOrders,
  tyreSets,
  vehicleMatches,
}: CustomerHistoryClientProps) {
  const t = useTranslations("garageWorkspace.customers");
  const tWo = useTranslations("garageWorkspace.workOrders");
  const tStatuses = useTranslations("garageWorkspace.statuses");
  const locale = useLocale() as AppLocale;

  const [matches, setMatches] = useState(vehicleMatches);
  const [requestingPlate, setRequestingPlate] = useState<string | null>(null);

  const totalSpendEur = workOrders.reduce(
    (sum, wo) =>
      sum + (wo.currency === "BGN" ? wo.totalAmount / 1.95583 : wo.totalAmount),
    0
  );

  const requestLink = async (plate: string) => {
    setRequestingPlate(plate);
    try {
      const res = await fetch("/api/garage/vehicle-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plateNumber: plate }),
      });
      if (!res.ok) {
        toast.error("Failed to send link request.");
        return;
      }
      const cur = matches[plate];
      if (cur) {
        setMatches({ ...matches, [plate]: { ...cur, linkState: "pending" } });
      }
      toast.success(tWo("linkRequestedToast"));
    } finally {
      setRequestingPlate(null);
    }
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href="/garage/customers">
          <ArrowLeft className="h-4 w-4" />
          {t("backToCustomers")}
        </Link>
      </Button>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {customer.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {customer.phone}
              {customer.email ? ` • ${customer.email}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {customer.plateNumbers.map((plate) => {
                const match = matches[plate];
                return (
                  <div
                    key={plate}
                    className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-1.5"
                  >
                    <span className="font-mono text-xs font-bold text-foreground">
                      {plate}
                    </span>
                    {match?.linkState === "linked" ? (
                      <Badge variant="success">
                        <Sparkles className="h-3 w-3" />
                        Diary Linked
                      </Badge>
                    ) : match?.linkState === "pending" ? (
                      <Badge variant="warning">Pending</Badge>
                    ) : match?.linkState === "unlinked" ? (
                      <button
                        type="button"
                        disabled={requestingPlate === plate}
                        onClick={() => void requestLink(plate)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <Link2 className="h-3 w-3" />
                        {tWo("requestDiaryLinkBtn")}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                {t("jobsCount")}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">
                {workOrders.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                {t("lifetimeSpend")}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">
                {formatCurrency(totalSpendEur, locale, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                {t("storedTyresCount")}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">
                {tyreSets.length}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Full Vehicle Service History */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Wrench className="h-5 w-5 text-primary" />
          {t("vehicleHistoryHeading")}
        </h2>

        {workOrders.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {tWo("emptyTitle")}
          </Card>
        ) : (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <Link key={wo.id} href={`/garage/work-orders/${wo.id}`}>
                <Card
                  hoverLift
                  className="mb-3 flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs font-bold">
                        {wo.plateNumber}
                      </span>
                      <Badge variant={STATUS_BADGE_VARIANT[wo.status]}>
                        {tStatuses(wo.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(wo.createdAt, locale)}
                      </span>
                      {wo.mileageKm ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          • {wo.mileageKm.toLocaleString()} km
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {wo.vehicleLabel} — {wo.customerSummary ?? ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-foreground">
                      {formatCurrency(wo.totalAmount, locale, wo.currency)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {tyreSets.length > 0 ? (
        <Card className="space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Disc3 className="h-4 w-4 text-primary" />
            Stored Tyres
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {tyreSets.map((ts) => (
              <div
                key={ts.id}
                className="flex items-center justify-between rounded-xl border border-border bg-secondary/35 p-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {ts.brandModel} ({ts.sizeSpec})
                  </p>
                  <p className="text-muted-foreground">
                    {ts.plateNumber} • {ts.quantity}x
                  </p>
                </div>
                <Badge variant="violet" className="font-mono">
                  {ts.shelfLocation}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

