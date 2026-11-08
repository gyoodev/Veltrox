import { z } from "zod";
import { APP_LOCALES } from "@/types/domain";

/**
 * Shared Profile & GDPR Zod Schemas (Client + Server)
 *
 * Phone numbers are normalized and validated as GDPR personal data.
 */

const phoneRegex = /^\+?[0-9\s()-]{7,22}$/;

export const notificationPreferencesSchema = z.object({
  emailReminders: z.boolean(),
  serviceUpdates: z.boolean(),
  documentExpiryAlerts: z.boolean(),
  marketingEmails: z.boolean(),
  preferredChannel: z.enum(["email", "sms", "viber"]),
});

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "nameMinLength")
    .max(80, "nameMaxLength"),
  phone: z
    .string()
    .trim()
    .max(24, "phoneInvalid")
    .nullable()
    .refine((val) => val === null || val === "" || phoneRegex.test(val), {
      message: "phoneInvalid",
    }),
  avatarUrl: z.string().url().nullable().optional(),
  avatarStoragePath: z
    .string()
    .max(300)
    .regex(/^users\/[A-Za-z0-9_-]+\/avatar\/[A-Za-z0-9._-]+$/)
    .nullable()
    .optional(),
  language: z.enum(APP_LOCALES),
  notificationPreferences: notificationPreferencesSchema,
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileValues = z.output<typeof updateProfileSchema>;

/**
 * Explicit confirmation payload required for irreversible GDPR account deletion.
 * Accepts either `"DELETE"` (EN) or `"ИЗТРИЙ"` (BG).
 */
export const deleteAccountSchema = z.object({
  confirmationText: z
    .string()
    .trim()
    .refine(
      (val) => {
        const upper = val.toUpperCase();
        return upper === "DELETE" || upper === "ИЗТРИЙ";
      },
      { message: "deleteConfirmationMismatch" }
    ),
});

export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;
