"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  Loader2,
  MapPin,
  Phone,
  Search,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AppointmentRequestValues,
  appointmentRequestSchema,
} from "@/lib/validators/car-diary";
import type { Garage, UserProfile, Vehicle } from "@/types/domain";

interface AppointmentDialogProps {
  garage: Garage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userVehicles?: Vehicle[];
  userProfile?: UserProfile | null;
}

export function AppointmentRequestDialog({
  garage,
  open,
  onOpenChange,
  userVehicles = [],
  userProfile = null,
}: AppointmentDialogProps) {
  const t = useTranslations("carDiary.garagesDir");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");

  const tomorrowIso = useMemo(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }, []);

  const [selectedVehicleChoice, setSelectedVehicleChoice] =
    useState<string>("manual");

  const form = useForm<AppointmentRequestValues>({
    resolver: zodResolver(appointmentRequestSchema),
    defaultValues: {
      garageId: garage?.id ?? "",
      vehicleId: null,
      customerName: userProfile?.displayName ?? "",
      customerPhone: userProfile?.phone ?? "",
      plateNumber: "",
      serviceRequested: "",
      preferredDate: tomorrowIso,
      preferredTime: "10:00",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open || !garage) return;
    const firstCar = userVehicles[0];
    setSelectedVehicleChoice(firstCar ? firstCar.id : "manual");
    form.reset({
      garageId: garage.id,
      vehicleId: firstCar ? firstCar.id : null,
      customerName: userProfile?.displayName ?? "",
      customerPhone: userProfile?.phone ?? "",
      plateNumber: firstCar ? firstCar.plateNumber : "",
      serviceRequested: "",
      preferredDate: tomorrowIso,
      preferredTime: "10:00",
      notes: "",
    });
  }, [open, garage, userVehicles, userProfile, tomorrowIso, form]);

  const translateErr = (key?: string) => {
    if (!key) return null;
    try {
      return tVal(key as never);
    } catch {
      return key;
    }
  };

  const handleVehicleChoiceChange = (choice: string) => {
    setSelectedVehicleChoice(choice);
    if (choice === "manual") {
      form.setValue("vehicleId", null);
      form.setValue("plateNumber", "");
      return;
    }
    const found = userVehicles.find((v) => v.id === choice);
    if (found) {
      form.setValue("vehicleId", found.id);
      form.setValue("plateNumber", found.plateNumber, { shouldValidate: true });
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Could not send appointment request.");
      return;
    }

    toast.success(t("bookingSentToast"));
    onOpenChange(false);
  });

  if (!garage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("modalTitle", { garage: garage.name })}</DialogTitle>
          <DialogDescription>
            {garage.address}, {garage.city}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {userVehicles.length > 0 ? (
            <div className="space-y-1.5">
              <Label>{t("selectVehicle")}</Label>
              <Select
                value={selectedVehicleChoice}
                onValueChange={handleVehicleChoiceChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {userVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.plateNumber})
                    </SelectItem>
                  ))}
                  <SelectItem value="manual">{t("manualVehicle")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appt-name">{t("customerName")}</Label>
              <Input id="appt-name" {...form.register("customerName")} />
              {form.formState.errors.customerName ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.customerName.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-phone">{t("customerPhone")}</Label>
              <Input
                id="appt-phone"
                placeholder="+359 88 123 4567"
                {...form.register("customerPhone")}
              />
              {form.formState.errors.customerPhone ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.customerPhone.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-plate">{t("plateNumber")}</Label>
            <Input
              id="appt-plate"
              placeholder="CB 1234 AB"
              className="font-mono uppercase"
              {...form.register("plateNumber")}
            />
            {form.formState.errors.plateNumber ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.plateNumber.message)}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-service">{t("serviceRequested")}</Label>
            <Input
              id="appt-service"
              placeholder={t("servicePlaceholder")}
              {...form.register("serviceRequested")}
            />
            {form.formState.errors.serviceRequested ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.serviceRequested.message)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">{t("preferredDate")}</Label>
              <Input
                id="appt-date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                {...form.register("preferredDate")}
              />
              {form.formState.errors.preferredDate ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.preferredDate.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-time">{t("preferredTime")}</Label>
              <Input
                id="appt-time"
                type="time"
                {...form.register("preferredTime")}
              />
              {form.formState.errors.preferredTime ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.preferredTime.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-notes">{t("notes")}</Label>
            <textarea
              id="appt-notes"
              rows={2}
              className="flex w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...form.register("notes")}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("submittingBooking")}
                </>
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4" />
                  {t("submitBooking")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface GarageBookingButtonProps {
  garage: Garage;
  userVehicles?: Vehicle[];
  userProfile?: UserProfile | null;
}

export function GarageBookingButton({
  garage,
  userVehicles = [],
  userProfile = null,
}: GarageBookingButtonProps) {
  const t = useTranslations("carDiary.garagesDir");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="gradient"
        size="lg"
        onClick={() => setOpen(true)}
      >
        <CalendarPlus className="h-4 w-4" />
        {t("requestAppointment")}
      </Button>
      <AppointmentRequestDialog
        garage={garage}
        open={open}
        onOpenChange={setOpen}
        userVehicles={userVehicles}
        userProfile={userProfile}
      />
    </>
  );
}

interface GarageDirectoryClientProps {
  garages: Garage[];
  userVehicles?: Vehicle[];
  userProfile?: UserProfile | null;
}

export function GarageDirectoryClient({
  garages,
  userVehicles = [],
  userProfile = null,
}: GarageDirectoryClientProps) {
  const t = useTranslations("carDiary.garagesDir");

  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [bookingGarage, setBookingGarage] = useState<Garage | null>(null);

  const cities = useMemo(() => {
    const unique = new Set<string>();
    for (const g of garages) {
      if (g.city?.trim()) unique.add(g.city.trim());
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [garages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return garages.filter((g) => {
      if (cityFilter !== "all" && g.city.trim() !== cityFilter) return false;
      if (!q) return true;
      const inName = g.name.toLowerCase().includes(q);
      const inCity = g.city.toLowerCase().includes(q);
      const inServices = g.servicesOffered.some((s) =>
        s.toLowerCase().includes(q)
      );
      return inName || inCity || inServices;
    });
  }, [garages, query, cityFilter]);

  return (
    <div className="space-y-6">
      {/* Search + City Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="pl-10"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger aria-label={t("cityAll")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("cityAll")}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Honest Results / Empty State (Zero Fake Listings) */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((garage) => (
            <Card
              key={garage.id}
              hoverLift
              className="flex flex-col justify-between p-6"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    {garage.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={garage.logoUrl}
                        alt={garage.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Wrench className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-foreground">
                      {garage.name}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">
                        {garage.city} • {garage.address}
                      </span>
                    </p>
                  </div>
                </div>

                {garage.description ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {garage.description}
                  </p>
                ) : null}

                {garage.servicesOffered.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {garage.servicesOffered.slice(0, 5).map((service) => (
                      <Badge key={service} variant="secondary">
                        {service}
                      </Badge>
                    ))}
                    {garage.servicesOffered.length > 5 ? (
                      <Badge variant="outline">
                        +{garage.servicesOffered.length - 5}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>{garage.phone}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="gradient"
                  size="sm"
                  className="flex-1"
                  onClick={() => setBookingGarage(garage)}
                >
                  <CalendarPlus className="h-4 w-4" />
                  {t("requestAppointment")}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/garages/${garage.slug}`}>
                    {t("viewProfile")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AppointmentRequestDialog
        garage={bookingGarage}
        open={Boolean(bookingGarage)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setBookingGarage(null);
        }}
        userVehicles={userVehicles}
        userProfile={userProfile}
      />
    </div>
  );
}

