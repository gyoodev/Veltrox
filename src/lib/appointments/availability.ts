import type { Appointment, DayOfWeek, Garage } from "@/types/domain";

const SOFIA_TZ = "Europe/Sofia";
const DEFAULT_CONCURRENT_BAYS = 2;

export interface TimeSlotAvailability {
  time: string;
  available: boolean;
  busyCount: number;
  capacity: number;
  remainingBays: number;
}

export interface DayAvailabilityResult {
  date: string;
  dayOfWeek: DayOfWeek;
  closed: boolean;
  concurrentBays: number;
  open: string | null;
  close: string | null;
  slots: TimeSlotAvailability[];
}

function parseMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number.parseInt(hStr ?? "0", 10);
  const m = Number.parseInt(mStr ?? "0", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getDayOfWeekFromYmd(dateStr: string): DayOfWeek {
  const [yStr, mStr, dStr] = dateStr.split("-");
  const y = Number.parseInt(yStr ?? "2026", 10);
  const m = Number.parseInt(mStr ?? "1", 10);
  const d = Number.parseInt(dStr ?? "1", 10);
  const utcDay = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  const map: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[utcDay] ?? "mon";
}

/**
 * Converts a Europe/Sofia wall-clock date + time (`YYYY-MM-DD`, `HH:mm`) into a UTC ISO string,
 * avoiding drift between UTC serverless hosts (Vercel) and local Sofia time.
 */
export function sofiaLocalToUtcIso(dateStr: string, timeStr: string): string {
  const [yStr, mStr, dStr] = dateStr.split("-");
  const [hhStr, mmStr] = timeStr.split(":");
  const y = Number.parseInt(yStr ?? "2026", 10);
  const m = Number.parseInt(mStr ?? "1", 10);
  const d = Number.parseInt(dStr ?? "1", 10);
  const hh = Number.parseInt(hhStr ?? "9", 10);
  const mm = Number.parseInt(mmStr ?? "0", 10);

  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SOFIA_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(new Date(utcGuess));
  const getPart = (type: string) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const sofiaHour = getPart("hour") === 24 ? 0 : getPart("hour");
  const sofiaAsUtc = Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day"),
    sofiaHour,
    getPart("minute"),
    0
  );
  const offsetMs = sofiaAsUtc - utcGuess;
  return new Date(utcGuess - offsetMs).toISOString();
}

function getEffectiveConcurrentBays(garage: Pick<Garage, "concurrentBays">): number {
  const raw = garage.concurrentBays ?? DEFAULT_CONCURRENT_BAYS;
  return Math.min(20, Math.max(1, Math.floor(raw)));
}

function countOverlappingAppointments(
  appointments: ReadonlyArray<
    Pick<Appointment, "scheduledStart" | "scheduledEnd" | "status">
  >,
  slotStartMs: number,
  slotEndMs: number
): number {
  let count = 0;
  for (const appt of appointments) {
    if (appt.status === "cancelled") continue;
    const apptStart = Date.parse(appt.scheduledStart);
    const apptEnd = appt.scheduledEnd
      ? Date.parse(appt.scheduledEnd)
      : apptStart + 60 * 60 * 1000;
    if (!Number.isFinite(apptStart) || !Number.isFinite(apptEnd)) continue;
    if (apptStart < slotEndMs && apptEnd > slotStartMs) {
      count += 1;
    }
  }
  return count;
}

export function computeDayAvailability(params: {
  garage: Pick<Garage, "workingHours" | "concurrentBays">;
  date: string;
  durationMinutes?: number;
  appointments: ReadonlyArray<
    Pick<Appointment, "scheduledStart" | "scheduledEnd" | "status">
  >;
}): DayAvailabilityResult {
  const { garage, date, appointments } = params;
  const durationMinutes = Math.min(
    480,
    Math.max(15, params.durationMinutes ?? 60)
  );
  const dayOfWeek = getDayOfWeekFromYmd(date);
  const dayRule = garage.workingHours?.[dayOfWeek];
  const concurrentBays = getEffectiveConcurrentBays(garage);

  if (!dayRule || dayRule.closed) {
    return {
      date,
      dayOfWeek,
      closed: true,
      concurrentBays,
      open: null,
      close: null,
      slots: [],
    };
  }

  const openMin = parseMinutes(dayRule.open);
  const closeMin = parseMinutes(dayRule.close);
  if (closeMin <= openMin + 15) {
    return {
      date,
      dayOfWeek,
      closed: true,
      concurrentBays,
      open: dayRule.open,
      close: dayRule.close,
      slots: [],
    };
  }

  const slots: TimeSlotAvailability[] = [];
  for (
    let min = openMin;
    min + durationMinutes <= closeMin;
    min += 30
  ) {
    const time = formatMinutes(min);
    const slotStartMs = Date.parse(sofiaLocalToUtcIso(date, time));
    const slotEndMs = slotStartMs + durationMinutes * 60 * 1000;
    const busyCount = countOverlappingAppointments(
      appointments,
      slotStartMs,
      slotEndMs
    );
    slots.push({
      time,
      available: busyCount < concurrentBays,
      busyCount,
      capacity: concurrentBays,
      remainingBays: Math.max(0, concurrentBays - busyCount),
    });
  }

  return {
    date,
    dayOfWeek,
    closed: false,
    concurrentBays,
    open: dayRule.open,
    close: dayRule.close,
    slots,
  };
}

export function validateAppointmentSlotAvailability(params: {
  garage: Pick<Garage, "workingHours" | "concurrentBays">;
  date: string;
  time: string;
  durationMinutes?: number;
  appointments: ReadonlyArray<
    Pick<Appointment, "scheduledStart" | "scheduledEnd" | "status">
  >;
}):
  | {
      ok: true;
      scheduledStartIso: string;
      scheduledEndIso: string;
      concurrentBays: number;
    }
  | {
      ok: false;
      reason: "CLOSED_DAY" | "OUTSIDE_WORKING_HOURS" | "BAY_CAPACITY_FULL";
      concurrentBays: number;
      busyCount: number;
    } {
  const { garage, date, time, appointments } = params;
  const durationMinutes = Math.min(
    480,
    Math.max(15, params.durationMinutes ?? 60)
  );
  const concurrentBays = getEffectiveConcurrentBays(garage);
  const dayOfWeek = getDayOfWeekFromYmd(date);
  const dayRule = garage.workingHours?.[dayOfWeek];

  if (!dayRule || dayRule.closed) {
    return {
      ok: false,
      reason: "CLOSED_DAY",
      concurrentBays,
      busyCount: 0,
    };
  }

  const openMin = parseMinutes(dayRule.open);
  const closeMin = parseMinutes(dayRule.close);
  const requestedStartMin = parseMinutes(time);
  const requestedEndMin = requestedStartMin + durationMinutes;

  if (requestedStartMin < openMin || requestedEndMin > closeMin) {
    return {
      ok: false,
      reason: "OUTSIDE_WORKING_HOURS",
      concurrentBays,
      busyCount: 0,
    };
  }

  const scheduledStartIso = sofiaLocalToUtcIso(date, time);
  const scheduledEndIso = new Date(
    Date.parse(scheduledStartIso) + durationMinutes * 60 * 1000
  ).toISOString();

  const busyCount = countOverlappingAppointments(
    appointments,
    Date.parse(scheduledStartIso),
    Date.parse(scheduledEndIso)
  );

  if (busyCount >= concurrentBays) {
    return {
      ok: false,
      reason: "BAY_CAPACITY_FULL",
      concurrentBays,
      busyCount,
    };
  }

  return {
    ok: true,
    scheduledStartIso,
    scheduledEndIso,
    concurrentBays,
  };
}

