"use client";

import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface SlotItem {
  time: string;
  available: boolean;
  busyCount: number;
  capacity: number;
  remainingBays: number;
}

interface AvailabilityResponse {
  closed: boolean;
  concurrentBays: number;
  open: string | null;
  close: string | null;
  slots: SlotItem[];
}

interface AppointmentSlotPickerProps {
  garageId: string | null | undefined;
  date: string;
  durationMinutes?: number;
  selectedTime: string;
  onSelectTime: (time: string) => void;
}

export function AppointmentSlotPicker({
  garageId,
  date,
  durationMinutes = 60,
  selectedTime,
  onSelectTime,
}: AppointmentSlotPickerProps) {
  const t = useTranslations("appointmentsAvailability");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AvailabilityResponse | null>(null);

  useEffect(() => {
    if (!garageId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(
      `/api/appointments/availability?garageId=${encodeURIComponent(garageId)}&date=${encodeURIComponent(date)}&duration=${durationMinutes}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json: AvailabilityResponse | null) => {
        if (!cancelled) {
          setData(json);
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [garageId, date, durationMinutes]);

  if (!garageId || !date) return null;

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {t("slotsHeading")}
        </span>
        {data && !data.closed && data.open && data.close ? (
          <Badge variant="outline" className="font-mono text-[10px]">
            {data.open} – {data.close} • {data.concurrentBays}{" "}
            {t("baysLabel")}
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{t("loading")}</span>
        </div>
      ) : data?.closed ? (
        <div className="flex items-center gap-2 py-2 text-xs text-amber-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{t("closedDayNotice")}</span>
        </div>
      ) : data && data.slots.length > 0 ? (
        <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">
          {data.slots.map((slot) => {
            const isSelected = selectedTime === slot.time;
            return (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => onSelectTime(slot.time)}
                className={`flex items-center justify-between rounded-lg border px-2 py-1.5 font-mono text-xs transition-all ${
                  !slot.available
                    ? "cursor-not-allowed border-border/40 bg-secondary/30 text-muted-foreground/50 line-through"
                    : isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background/70 text-foreground hover:border-primary/50"
                }`}
              >
                <span>{slot.time}</span>
                {slot.available && slot.capacity > 1 ? (
                  <span className="text-[10px] opacity-75">
                    {slot.remainingBays}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("noSlots")}</p>
      )}
    </div>
  );
}

