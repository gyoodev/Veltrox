"use client";

import {
  ArrowRight,
  Car,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { VehicleFormDialog } from "@/components/car-diary/vehicle-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Vehicle } from "@/types/domain";

interface VehiclesGridClientProps {
  ownerUid: string;
  initialVehicles: Vehicle[];
}

export function VehiclesGridClient({
  ownerUid,
  initialVehicles,
}: VehiclesGridClientProps) {
  const t = useTranslations("carDiary.cars");
  const tFuel = useTranslations("carDiary.fuelTypes");
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const handleSaved = (saved: Vehicle) => {
    setVehicles((prev) => {
      const exists = prev.some((v) => v.id === saved.id);
      if (exists) {
        return prev.map((v) => (v.id === saved.id ? saved : v));
      }
      return [saved, ...prev];
    });
    router.refresh();
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!window.confirm(t("deleteConfirm"))) return;

    const previous = vehicles;
    setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));

    const res = await fetch(`/api/vehicles/${vehicle.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setVehicles(previous);
      toast.error("Failed to delete vehicle.");
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

        <Button
          variant="gradient"
          onClick={() => {
            setEditingVehicle(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("addVehicle")}
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Button
              variant="gradient"
              onClick={() => {
                setEditingVehicle(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("addVehicle")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((veh) => (
            <Card
              key={veh.id}
              hoverLift
              className="flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="relative h-40 w-full overflow-hidden border-b border-border bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-violet-600/20">
                  {veh.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={veh.photoUrl}
                      alt={`${veh.make} ${veh.model}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Car className="h-14 w-14 text-primary/45" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <span className="rounded-lg border border-white/20 bg-[#0A0E1A]/85 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-white backdrop-blur-md">
                      {veh.plateNumber}
                    </span>
                  </div>
                  {(veh.pendingGarageLinks?.length ?? 0) > 0 ? (
                    <div className="absolute right-3 top-3">
                      <Badge variant="warning">
                        {veh.pendingGarageLinks?.length}
                      </Badge>
                    </div>
                  ) : null}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        {veh.make} {veh.model}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {veh.year} • {tFuel(veh.fuelType)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        aria-label={t("editVehicle")}
                        onClick={() => {
                          setEditingVehicle(veh);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        aria-label={t("deleteVehicle")}
                        onClick={() => void handleDelete(veh)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/70 px-2.5 py-1 font-mono font-semibold text-foreground">
                      <Gauge className="h-3.5 w-3.5 text-primary" />
                      {veh.currentMileageKm.toLocaleString()} km
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-secondary/40 px-2.5 py-1">
                      <Fuel className="h-3.5 w-3.5 text-violet-400" />
                      {tFuel(veh.fuelType)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border p-4">
                <Button asChild variant="gradient" className="w-full">
                  <Link href={`/app/cars/${veh.id}`}>
                    {t("openVehicle")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VehicleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ownerUid={ownerUid}
        editingVehicle={editingVehicle}
        onSaved={handleSaved}
      />
    </div>
  );
}

