import type { NotificationChannel } from "@/lib/notifications/types";
import type {
  NotificationPreferences,
  Reminder,
  VehicleDocument,
} from "@/types/domain";

export interface ReminderEvaluation {
  shouldSend: boolean;
  reason: "due_date" | "due_mileage" | "not_due" | "inactive";
  daysUntilDue: number | null;
  kmRemaining: number | null;
}

const MS_PER_DAY = 86_400_000;

function toUtcMidnightMs(isoDateOrTimestamp: string): number | null {
  const datePart = isoDateOrTimestamp.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const parsed = Date.parse(`${datePart}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Determines whether a scheduled reminder should fire during the daily sweep:
 * - Date threshold: due within `leadDays` (default 7 days) or already overdue.
 * - Mileage threshold: vehicle odometer within `leadKm` (default 500 km) of `dueMileageKm` or exceeded.
 */
export function evaluateReminderDueState(
  reminder: Pick<Reminder, "status" | "dueDate" | "dueMileageKm">,
  currentVehicleMileageKm: number | null,
  now = new Date(),
  options?: { leadDays?: number; leadKm?: number }
): ReminderEvaluation {
  if (reminder.status !== "scheduled") {
    return {
      shouldSend: false,
      reason: "inactive",
      daysUntilDue: null,
      kmRemaining: null,
    };
  }

  const leadDays = options?.leadDays ?? 7;
  const leadKm = options?.leadKm ?? 500;
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  let daysUntilDue: number | null = null;
  if (reminder.dueDate) {
    const dueMs = toUtcMidnightMs(reminder.dueDate);
    if (dueMs !== null) {
      daysUntilDue = Math.round((dueMs - todayUtcMs) / MS_PER_DAY);
    }
  }

  let kmRemaining: number | null = null;
  if (
    reminder.dueMileageKm !== null &&
    reminder.dueMileageKm !== undefined &&
    currentVehicleMileageKm !== null &&
    currentVehicleMileageKm !== undefined
  ) {
    kmRemaining = reminder.dueMileageKm - currentVehicleMileageKm;
  }

  if (daysUntilDue !== null && daysUntilDue <= leadDays) {
    return {
      shouldSend: true,
      reason: "due_date",
      daysUntilDue,
      kmRemaining,
    };
  }

  if (kmRemaining !== null && kmRemaining <= leadKm) {
    return {
      shouldSend: true,
      reason: "due_mileage",
      daysUntilDue,
      kmRemaining,
    };
  }

  return {
    shouldSend: false,
    reason: "not_due",
    daysUntilDue,
    kmRemaining,
  };
}

export interface DocumentExpiryEvaluation {
  shouldAlert: boolean;
  daysRemaining: number | null;
  deliveryKey: string | null;
}

/**
 * Evaluates whether a stored vehicle document (`insurance`, `vignette`, `inspection`, etc.)
 * is expiring within `leadDays` (default 14 days) and up to `graceOverdueDays` (default 3 days).
 * Produces an idempotent `deliveryKey` scoped to `(documentId, expiryDate)` so each expiry cycle alerts once.
 */
export function evaluateDocumentExpiryAlert(
  doc: Pick<VehicleDocument, "id" | "expiryDate">,
  now = new Date(),
  options?: { leadDays?: number; graceOverdueDays?: number }
): DocumentExpiryEvaluation {
  if (!doc.expiryDate) {
    return { shouldAlert: false, daysRemaining: null, deliveryKey: null };
  }

  const expiryMs = toUtcMidnightMs(doc.expiryDate);
  if (expiryMs === null) {
    return { shouldAlert: false, daysRemaining: null, deliveryKey: null };
  }

  const leadDays = options?.leadDays ?? 14;
  const graceOverdueDays = options?.graceOverdueDays ?? 3;
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const daysRemaining = Math.round((expiryMs - todayUtcMs) / MS_PER_DAY);

  const shouldAlert =
    daysRemaining <= leadDays && daysRemaining >= -graceOverdueDays;

  return {
    shouldAlert,
    daysRemaining,
    deliveryKey: shouldAlert
      ? `doc-expiry:${doc.id}:${doc.expiryDate.slice(0, 10)}`
      : null,
  };
}

/**
 * Resolves effective outbound channels based on reminder configuration and user notification preferences.
 */
export function resolveEffectiveChannels(params: {
  requestedChannels: ReadonlyArray<NotificationChannel>;
  preferences?: NotificationPreferences | null;
  category: "reminder" | "document_expiry" | "system";
}): NotificationChannel[] {
  const { requestedChannels, preferences, category } = params;

  if (preferences) {
    if (category === "reminder" && !preferences.emailReminders) {
      return requestedChannels.filter((ch) => ch !== "email");
    }
    if (category === "document_expiry" && !preferences.documentExpiryAlerts) {
      return [];
    }
  }

  const unique = new Set<NotificationChannel>(requestedChannels);
  if (preferences?.preferredChannel) {
    unique.add(preferences.preferredChannel);
  }
  if (unique.size === 0) {
    unique.add("email");
  }
  return Array.from(unique);
}

