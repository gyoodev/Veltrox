import { z } from "zod";
import { licensePlateSchema } from "@/lib/validators/entities";
import {
  DIARY_CATEGORIES,
  DOCUMENT_TYPES,
  FUEL_TYPES,
  REMINDER_TYPES,
} from "@/types/domain";

/**
 * Shared Client + Server Zod Validators for Phase 2 Car Owner ("Car Diary") Modules.
 *
 * Notice all schemas avoid input/output type divergence so `zodResolver` in
 * `react-hook-form` infers exact types under strict TypeScript.
 */

const currentMaxYear = new Date().getFullYear() + 1;

export const attachmentItemSchema = z.object({
  name: z.string().trim().min(1).max(180),
  url: z.string().url(),
  storagePath: z.string().min(5).max(400),
  contentType: z.string().min(3).max(100),
});

export const vehicleFormSchema = z.object({
  make: z.string().trim().min(1, "makeRequired").max(60, "fieldTooLong"),
  model: z.string().trim().min(1, "modelRequired").max(60, "fieldTooLong"),
  year: z
    .number({ invalid_type_error: "yearInvalid" })
    .int("yearInvalid")
    .min(1950, "yearInvalid")
    .max(currentMaxYear, "yearInvalid"),
  plateNumber: licensePlateSchema,
  vin: z
    .string()
    .trim()
    .max(17, "vinInvalid")
    .nullable()
    .refine(
      (val) =>
        val === null ||
        val === "" ||
        /^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$/.test(val),
      { message: "vinInvalid" }
    ),
  fuelType: z.enum(FUEL_TYPES),
  currentMileageKm: z
    .number({ invalid_type_error: "mileageInvalid" })
    .int("mileageInvalid")
    .min(0, "mileageInvalid")
    .max(3_000_000, "mileageInvalid"),
  photoUrl: z
    .string()
    .refine(
      (val) =>
        !val ||
        val.startsWith("/") ||
        val.startsWith("http://") ||
        val.startsWith("https://") ||
        val.startsWith("data:"),
      { message: "urlInvalid" }
    )
    .nullable()
    .optional(),
  photoStoragePath: z.string().max(400).nullable().optional(),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export const vehiclePatchSchema = vehicleFormSchema.partial().extend({
  garageLinkDecision: z
    .object({
      garageId: z.string().min(1),
      decision: z.enum(["accept", "decline"]),
    })
    .optional(),
});

export type VehiclePatchValues = z.infer<typeof vehiclePatchSchema>;

export const diaryEntryFormSchema = z.object({
  vehicleId: z.string().min(1, "vehicleRequired"),
  category: z.enum(DIARY_CATEGORIES),
  title: z.string().trim().min(2, "titleRequired").max(120, "fieldTooLong"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateRequired"),
  mileageKm: z
    .number({ invalid_type_error: "mileageInvalid" })
    .int("mileageInvalid")
    .min(0, "mileageInvalid")
    .max(3_000_000, "mileageInvalid"),
  costAmount: z
    .number({ invalid_type_error: "costInvalid" })
    .min(0, "costInvalid")
    .max(500_000, "costInvalid"),
  currency: z.enum(["EUR", "BGN"]),
  notes: z.string().trim().max(1500, "fieldTooLong").nullable(),
  attachments: z.array(attachmentItemSchema).max(6).optional(),
});

export type DiaryEntryFormValues = z.infer<typeof diaryEntryFormSchema>;

export const reminderFormSchema = z
  .object({
    vehicleId: z.string().min(1, "vehicleRequired"),
    type: z.enum(REMINDER_TYPES),
    title: z.string().trim().min(2, "titleRequired").max(120, "fieldTooLong"),
    dueDate: z
      .string()
      .nullable()
      .refine((v) => v === null || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
        message: "dateRequired",
      }),
    dueMileageKm: z
      .number()
      .int("mileageInvalid")
      .min(1, "mileageInvalid")
      .max(3_000_000, "mileageInvalid")
      .nullable(),
    notes: z.string().trim().max(600, "fieldTooLong").nullable(),
    channels: z
      .array(z.enum(["email", "sms", "viber"]))
      .min(1),
  })
  .refine(
    (val) =>
      Boolean(val.dueDate && val.dueDate.length > 0) ||
      (typeof val.dueMileageKm === "number" && val.dueMileageKm > 0),
    {
      message: "reminderTriggerRequired",
      path: ["dueDate"],
    }
  );

export type ReminderFormValues = z.infer<typeof reminderFormSchema>;

export const reminderPatchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  type: z.enum(REMINDER_TYPES).optional(),
  dueDate: z.string().nullable().optional(),
  dueMileageKm: z.number().int().min(1).max(3_000_000).nullable().optional(),
  notes: z.string().trim().max(600).nullable().optional(),
  status: z.enum(["scheduled", "sent", "completed", "cancelled"]).optional(),
});

export const documentFormSchema = z.object({
  vehicleId: z.string().min(1, "vehicleRequired"),
  docType: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().min(2, "titleRequired").max(120, "fieldTooLong"),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().min(3).max(100),
  fileUrl: z.string().url("fileRequired"),
  storagePath: z.string().min(5, "fileRequired").max(400),
  expiryDate: z
    .string()
    .nullable()
    .refine((v) => v === null || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "dateRequired",
    }),
  notes: z.string().trim().max(600, "fieldTooLong").nullable(),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;

export const appointmentRequestSchema = z.object({
  garageId: z.string().min(1),
  vehicleId: z.string().nullable().optional(),
  customerName: z.string().trim().min(2, "nameMinLength").max(80, "nameMaxLength"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,22}$/, "phoneInvalid"),
  plateNumber: licensePlateSchema,
  serviceRequested: z
    .string()
    .trim()
    .min(3, "titleRequired")
    .max(240, "fieldTooLong"),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateRequired"),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, "dateRequired"),
  notes: z.string().trim().max(600, "fieldTooLong").nullable(),
});

export type AppointmentRequestValues = z.infer<typeof appointmentRequestSchema>;

