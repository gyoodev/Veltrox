"use client";

import {
  ArrowLeft,
  BellRing,
  Building2,
  Calendar,
  Car,
  Check,
  Coins,
  ExternalLink,
  FileDown,
  FileText,
  FolderLock,
  Fuel,
  Gauge,
  History,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DiaryEntryDialog } from "@/components/car-diary/diary-entry-dialog";
import { DocumentsVaultClient } from "@/components/car-diary/documents-vault-client";
import { ExpenseCharts } from "@/components/car-diary/expense-charts";
import { RemindersListClient } from "@/components/car-diary/reminders-list-client";
import { VehicleFormDialog } from "@/components/car-diary/vehicle-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  type AppLocale,
  DIARY_CATEGORIES,
  type DiaryCategory,
  type DiaryEntry,
  type Reminder,
  type Vehicle,
  type VehicleDocument,
} from "@/types/domain";

interface VehicleDetailClientProps {
  ownerUid: string;
  initialVehicle: Vehicle;
  initialEntries: DiaryEntry[];
  initialReminders: Reminder[];
  initialDocuments: VehicleDocument[];
}

const CATEGORY_BADGE_VARIANT: Record<
  DiaryCategory,
  "default" | "warning" | "violet" | "success" | "secondary"
> = {
  service: "default",
  repair: "warning",
  fuel: "violet",
  tyres: "secondary",
  inspection: "success",
  insurance: "default",
  note: "secondary",
};

export function VehicleDetailClient({
  ownerUid,
  initialVehicle,
  initialEntries,
  initialReminders,
  initialDocuments,
}: VehicleDetailClientProps) {
  const tCars = useTranslations("carDiary.cars");
  const tFuel = useTranslations("carDiary.fuelTypes");
  const tTimeline = useTranslations("carDiary.timeline");
  const tCat = useTranslations("carDiary.categories");
  const tExp = useTranslations("carDiary.expenses");
  const tRem = useTranslations("carDiary.reminders");
  const tDocs = useTranslations("carDiary.documents");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle>(initialVehicle);
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);

  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const [mileageInput, setMileageInput] = useState<string>(
    String(initialVehicle.currentMileageKm)
  );
  const [savingMileage, setSavingMileage] = useState(false);
  const [processingLinkId, setProcessingLinkId] = useState<string | null>(null);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (categoryFilter !== "all" && entry.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        (entry.notes?.toLowerCase().includes(q) ?? false) ||
        (entry.garageName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, categoryFilter, searchQuery]);

  const handleQuickMileageUpdate = async () => {
    const parsedKm = Number(mileageInput);
    if (
      !Number.isInteger(parsedKm) ||
      parsedKm < 0 ||
      parsedKm > 3_000_000
    ) {
      toast.error("Invalid mileage value.");
      return;
    }

    setSavingMileage(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentMileageKm: parsedKm }),
      });

      if (!res.ok) {
        toast.error("Could not update mileage.");
        return;
      }

      const json = (await res.json()) as { vehicle: Vehicle };
      setVehicle(json.vehicle);
      setMileageInput(String(json.vehicle.currentMileageKm));
      toast.success(tCars("mileageUpdated"));
      router.refresh();
    } finally {
      setSavingMileage(false);
    }
  };

  const handleGarageLinkDecision = async (
    garageId: string,
    decision: "accept" | "decline"
  ) => {
    setProcessingLinkId(garageId);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garageLinkDecision: { garageId, decision },
        }),
      });

      if (!res.ok) {
        toast.error("Could not process garage link request.");
        return;
      }

      const json = (await res.json()) as { vehicle: Vehicle };
      setVehicle(json.vehicle);
      toast.success(
        decision === "accept" ? tCars("linkAccepted") : tCars("linkDeclined")
      );
      router.refresh();
    } finally {
      setProcessingLinkId(null);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!window.confirm(tCars("deleteConfirm"))) return;

    const res = await fetch(`/api/vehicles/${vehicle.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      toast.error("Could not delete vehicle.");
      return;
    }

    toast.success(tCars("deletedToast"));
    router.push("/app/cars");
    router.refresh();
  };

  const handleEntrySaved = (saved: DiaryEntry, updatedMileageKm?: number) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      const next = exists
        ? prev.map((e) => (e.id === saved.id ? saved : e))
        : [saved, ...prev];
      return next.sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
      });
    });

    if (
      typeof updatedMileageKm === "number" &&
      updatedMileageKm > vehicle.currentMileageKm
    ) {
      setVehicle((prev) => ({ ...prev, currentMileageKm: updatedMileageKm }));
      setMileageInput(String(updatedMileageKm));
    }

    router.refresh();
  };

  const handleDeleteEntry = async (entryId: string) => {
    const prev = entries;
    setEntries((list) => list.filter((e) => e.id !== entryId));

    const res = await fetch(`/api/diary/${entryId}`, { method: "DELETE" });
    if (!res.ok) {
      setEntries(prev);
      toast.error("Failed to delete entry.");
      return;
    }

    toast.success(tTimeline("deletedToast"));
    router.refresh();
  };

  const pendingLinks = vehicle.pendingGarageLinks ?? [];
  const linkedGarageIds = vehicle.linkedGarageIds ?? [];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/cars">
            <ArrowLeft className="h-4 w-4" />
            {tCars("pageTitle")}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/cars/${vehicle.id}/service-book`}>
              <FileDown className="h-4 w-4 text-primary" />
              {tCars("exportPdf")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditVehicleOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            {tCars("editVehicle")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => void handleDeleteVehicle()}
          >
            <Trash2 className="h-4 w-4" />
            {tCars("deleteVehicle")}
          </Button>
        </div>
      </div>

      {/* Pending Garage Link Requests */}
      {pendingLinks.length > 0 ? (
        <div className="space-y-3">
          {pendingLinks.map((req) => {
            const busy = processingLinkId === req.garageId;
            return (
              <Card
                key={req.garageId}
                className="border-orange-500/35 bg-orange-500/10 p-4 sm:p-5"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {tCars("pendingLinkTitle")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tCars("pendingLinkDesc", { garage: req.garageName })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="gradient"
                      disabled={busy}
                      onClick={() =>
                        void handleGarageLinkDecision(req.garageId, "accept")
                      }
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {tCars("acceptLink")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void handleGarageLinkDecision(req.garageId, "decline")
                      }
                    >
                      <X className="h-4 w-4" />
                      {tCars("declineLink")}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Vehicle Hero Header Card */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-12">
          <div className="relative h-52 overflow-hidden border-b border-border bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-violet-600/20 md:col-span-4 md:h-auto md:border-b-0 md:border-r">
            {vehicle.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vehicle.photoUrl}
                alt={`${vehicle.make} ${vehicle.model}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-48 w-full items-center justify-center">
                <Car className="h-16 w-16 text-primary/45" />
              </div>
            )}
            <div className="absolute left-4 top-4">
              <span className="rounded-xl border border-white/20 bg-[#0A0E1A]/90 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-white shadow-md backdrop-blur-md">
                {vehicle.plateNumber}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-5 sm:p-6 md:col-span-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {vehicle.make} {vehicle.model}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="default">{vehicle.year}</Badge>
                  <Badge variant="violet">
                    <Fuel className="h-3 w-3" />
                    {tFuel(vehicle.fuelType)}
                  </Badge>
                  {vehicle.vin ? (
                    <span className="rounded-lg border border-border bg-secondary/50 px-2.5 py-0.5 font-mono text-[11px] text-foreground">
                      VIN: {vehicle.vin}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Linked Garages Indicator */}
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tCars("linkedGarages")}
                </p>
                {linkedGarageIds.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tCars("noLinkedGarages")}
                  </p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5 sm:justify-end">
                    {linkedGarageIds.map((gid) => (
                      <Badge key={gid} variant="success">
                        <Building2 className="h-3 w-3" />
                        {vehicle.linkedGarageNames?.[gid] ?? gid.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Inline Quick Odometer Updater */}
            <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <div className="min-w-[180px] flex-1 sm:max-w-xs">
                <label
                  htmlFor="quick-mileage-input"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  {tCars("currentMileage")}
                </label>
                <Input
                  id="quick-mileage-input"
                  type="number"
                  min={0}
                  max={3000000}
                  value={mileageInput}
                  onChange={(e) => setMileageInput(e.target.value)}
                  className="font-mono"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  savingMileage ||
                  Number(mileageInput) === vehicle.currentMileageKm
                }
                onClick={() => void handleQuickMileageUpdate()}
              >
                {savingMileage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gauge className="h-4 w-4 text-primary" />
                )}
                {tCars("quickMileageSave")}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 4-Tab Vehicle Workspace */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="timeline" className="gap-2">
            <History className="h-4 w-4" />
            {tTimeline("tabTitle")} ({entries.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <Coins className="h-4 w-4" />
            {tExp("tabTitle")}
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2">
            <BellRing className="h-4 w-4" />
            {tRem("tabTitle")}
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FolderLock className="h-4 w-4" />
            {tDocs("tabTitle")}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TIMELINE */}
        <TabsContent value="timeline" className="space-y-5 pt-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tTimeline("searchPlaceholder")}
                  aria-label={tTimeline("searchPlaceholder")}
                  className="pl-9"
                />
              </div>

              <div className="w-full sm:w-52">
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger aria-label={tTimeline("category")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tCat("all")}</SelectItem>
                    {DIARY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {tCat(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              variant="gradient"
              onClick={() => {
                setEditingEntry(null);
                setEntryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {tTimeline("addEntry")}
            </Button>
          </div>

          {filteredEntries.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={tTimeline("emptyTitle")}
              description={tTimeline("emptyDesc")}
              action={
                <Button
                  type="button"
                  variant="gradient"
                  onClick={() => {
                    setEditingEntry(null);
                    setEntryDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {tTimeline("addEntry")}
                </Button>
              }
            />
          ) : (
            <div className="relative space-y-4 before:absolute before:bottom-4 before:left-5 before:top-4 before:hidden before:w-px before:bg-border sm:before:block">
              {filteredEntries.map((entry) => {
                const attachments = entry.attachments ?? [];
                const legacyUrls =
                  attachments.length === 0 ? entry.attachmentUrls ?? [] : [];

                return (
                  <div key={entry.id} className="relative sm:pl-12">
                    <div
                      aria-hidden="true"
                      className="absolute left-3 top-6 hidden h-4 w-4 rounded-full border-2 border-primary bg-background shadow-glow-blue sm:block"
                    />
                    <Card className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={CATEGORY_BADGE_VARIANT[entry.category]}
                            >
                              {tCat(entry.category)}
                            </Badge>
                            {entry.garageId ? (
                              <Badge variant="success">
                                <Sparkles className="h-3 w-3" />
                                {entry.garageName
                                  ? `${tTimeline("syncedFromGarage")}: ${entry.garageName}`
                                  : tTimeline("syncedFromGarage")}
                              </Badge>
                            ) : null}
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(entry.date, locale)}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                              <Gauge className="h-3.5 w-3.5 text-primary" />
                              {entry.mileageKm.toLocaleString()} km
                            </span>
                          </div>

                          <h3 className="text-base font-semibold text-foreground">
                            {entry.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          {entry.costAmount > 0 ? (
                            <span className="rounded-xl border border-border bg-secondary/60 px-3 py-1 font-mono text-sm font-bold text-foreground">
                              {formatCurrency(
                                entry.costAmount,
                                locale,
                                entry.currency
                              )}
                            </span>
                          ) : null}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={tTimeline("editEntry")}
                            onClick={() => {
                              setEditingEntry(entry);
                              setEntryDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={tTimeline("deleteEntry")}
                            onClick={() => void handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {entry.notes ? (
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {entry.notes}
                        </p>
                      ) : null}

                      {attachments.length > 0 || legacyUrls.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                          {attachments.map((att) => (
                            <a
                              key={att.storagePath}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              {att.contentType === "application/pdf" ? (
                                <FileText className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Paperclip className="h-3.5 w-3.5 text-primary" />
                              )}
                              <span className="max-w-[180px] truncate">
                                {att.name}
                              </span>
                              <ExternalLink className="h-3 w-3 opacity-70" />
                            </a>
                          ))}
                          {legacyUrls.map((url, idx) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              <Paperclip className="h-3.5 w-3.5 text-primary" />
                              <span>Receipt #{idx + 1}</span>
                              <ExternalLink className="h-3 w-3 opacity-70" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: EXPENSES */}
        <TabsContent value="expenses" className="pt-2">
          <ExpenseCharts entries={entries} vehicles={[vehicle]} />
        </TabsContent>

        {/* TAB 3: REMINDERS */}
        <TabsContent value="reminders" className="pt-2">
          <RemindersListClient
            initialReminders={initialReminders}
            vehicles={[vehicle]}
            scopedVehicleId={vehicle.id}
          />
        </TabsContent>

        {/* TAB 4: DOCUMENTS */}
        <TabsContent value="documents" className="pt-2">
          <DocumentsVaultClient
            ownerUid={ownerUid}
            initialDocuments={initialDocuments}
            vehicles={[vehicle]}
            scopedVehicleId={vehicle.id}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Vehicle Modal */}
      <VehicleFormDialog
        open={editVehicleOpen}
        onOpenChange={setEditVehicleOpen}
        ownerUid={ownerUid}
        editingVehicle={vehicle}
        onSaved={(updated) => {
          setVehicle(updated);
          setMileageInput(String(updated.currentMileageKm));
          router.refresh();
        }}
      />

      {/* Add / Edit Diary Entry Modal */}
      <DiaryEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        ownerUid={ownerUid}
        vehicles={[vehicle]}
        defaultVehicleId={vehicle.id}
        editingEntry={editingEntry}
        onSaved={handleEntrySaved}
      />
    </div>
  );
}

