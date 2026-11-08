"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  type ReminderFormValues,
  reminderFormSchema,
} from "@/lib/validators/car-diary";
import {
  type Reminder,
  REMINDER_TYPES,
  type ReminderType,
  type Vehicle,
} from "@/types/domain";

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  defaultVehicleId?: string;
  onSaved: (reminder: Reminder) => void;
}

export function ReminderDialog({
  open,
  onOpenChange,
  vehicles,
  defaultVehicleId,
  onSaved,
}: ReminderDialogProps) {
  const t = useTranslations("carDiary.reminders");
  const tTypes = useTranslations("carDiary.reminderTypes");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");

  const initialVehId = defaultVehicleId ?? vehicles[0]?.id ?? "";

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      vehicleId: initialVehId,
      type: "technical_inspection",
      title: tTypes("technical_inspection"),
      dueDate: "",
      dueMileageKm: null,
      notes: "",
      channels: ["email"],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        vehicleId: defaultVehicleId ?? vehicles[0]?.id ?? "",
        type: "technical_inspection",
        title: tTypes("technical_inspection"),
        dueDate: "",
        dueMileageKm: null,
        notes: "",
        channels: ["email"],
      });
    }
  }, [defaultVehicleId, form, open, tTypes, vehicles]);

  const translateErr = (key: string | undefined): string | null => {
    if (!key) return null;
    try {
      return tVal(key as Parameters<typeof tVal>[0]);
    } catch {
      return key;
    }
  };

  const onSubmit = async (values: ReminderFormValues) => {
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Failed to save reminder.");
      return;
    }

    const json = (await res.json()) as { reminder: Reminder };
    toast.success(t("savedToast"));
    onSaved(json.reminder);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            {t("addReminder")}
          </DialogTitle>
          <DialogDescription>{t("pageSubtitle")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 pt-1"
          noValidate
        >
          {!defaultVehicleId ? (
            <div className="space-y-1.5">
              <Label>{t("vehicleLabel")}</Label>
              <Controller
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label={t("vehicleLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.make} {v.model} ({v.plateNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t("typeLabel")}</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    const rt = val as ReminderType;
                    field.onChange(rt);
                    form.setValue("title", tTypes(rt), { shouldValidate: true });
                  }}
                >
                  <SelectTrigger aria-label={t("typeLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_TYPES.map((rt) => (
                      <SelectItem key={rt} value={rt}>
                        {tTypes(rt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rem-title">{t("title")}</Label>
            <Input id="rem-title" {...form.register("title")} />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">
                {translateErr(form.formState.errors.title.message)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rem-date">{t("dueDate")}</Label>
              <Input
                id="rem-date"
                type="date"
                className="font-mono"
                {...form.register("dueDate")}
              />
              {form.formState.errors.dueDate ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.dueDate.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rem-km">{t("dueMileage")}</Label>
              <Input
                id="rem-km"
                type="number"
                min={1}
                placeholder={t("dueMileagePlaceholder")}
                className="font-mono"
                onChange={(e) => {
                  const raw = e.target.value;
                  form.setValue(
                    "dueMileageKm",
                    raw === "" ? null : Number(raw),
                    { shouldValidate: true }
                  );
                }}
              />
              {form.formState.errors.dueMileageKm ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.dueMileageKm.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                {t("channelEmail")}
              </span>
              <Badge variant="success">Email</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("channelFuture")}
            </p>
          </div>

          <DialogFooter className="pt-2">
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
                  {tCommon("saving")}
                </>
              ) : (
                tCommon("save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

