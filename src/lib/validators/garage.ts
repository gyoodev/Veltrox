import { z } from "zod";
import { attachmentItemSchema } from "@/lib/validators/car-diary";
import { licensePlateSchema } from "@/lib/validators/entities";
import {
  STAFF_ROLES,
  TYRE_SEASONS,
  TYRE_STORAGE_STATUSES,
  WORK_ORDER_STATUSES,
} from "@/types/domain";

/**
 * Shared Client + Server Zod Schemas for Phase 3 Garage Modules.
 *
 * Strictly avoids `.transform()` so `z.input` === `z.output` for `zodResolver`
 * under `strict: true` + `noUncheckedIndexedAccess: true`.
 */

export const workingDaySlotSchema = z.object({
  open: z.string().default("08:30"),
  close: z.string().default("18:00"),
  closed: z.boolean().default(false),
});

export const workingHoursSchema = z.object({
  mon: workingDaySlotSchema,
  tue: workingDaySlotSchema,
  wed: workingDaySlotSchema,
  thu: workingDaySlotSchema,
  fri: workingDaySlotSchema,
  sat: workingDaySlotSchema,
  sun: workingDaySlotSchema,
});

export const garageOnboardingSchema = z.object({
  name: z.string().trim().min(2, "nameMinLength").max(80, "nameMaxLength"),
  description: z.string().trim().max(500, "fieldTooLong").nullish(),
  city: z.string().trim().min(2, "cityRequired").max(60, "fieldTooLong"),
  address: z.string().trim().min(3, "addressRequired").max(160, "fieldTooLong"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s().\/-]{6,25}$/, "phoneInvalid"),
  email: z.string().trim().email("emailInvalid"),
  workingHours: workingHoursSchema,
  servicesOffered: z
    .array(z.string().trim().min(2).max(60))
    .min(1, "servicesRequired")
    .max(25, "fieldTooLong"),
  logoUrl: z
    .string()
    .trim()
    .refine(
      (val) =>
        !val ||
        val.startsWith("http://") ||
        val.startsWith("https://") ||
        val.startsWith("/") ||
        val.startsWith("data:"),
      { message: "Invalid logo URL" }
    )
    .nullish()
    .or(z.literal("")),
  logoStoragePath: z.string().max(400).nullish(),
});

export type GarageOnboardingValues = z.infer<typeof garageOnboardingSchema>;

export const garageSettingsPatchSchema = garageOnboardingSchema.partial().extend({
  plan: z.enum(["free", "pro"]).optional(),
});

export type GarageSettingsPatchValues = z.infer<typeof garageSettingsPatchSchema>;

export const customerFormSchema = z.object({
  fullName: z.string().trim().min(2, "nameMinLength").max(80, "nameMaxLength"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,22}$/, "phoneInvalid"),
  email: z
    .string()
    .trim()
    .nullable()
    .refine(
      (val) =>
        val === null ||
        val === "" ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: "emailInvalid" }
    ),
  plateNumbers: z
    .array(licensePlateSchema)
    .min(1, "plateInvalid")
    .max(12, "fieldTooLong"),
  notes: z.string().trim().max(800, "fieldTooLong").nullable(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const customerPatchSchema = customerFormSchema.partial();

/**
 * Sub-30-second mobile Work Order intake schema:
 * Minimizes required inputs to Plate + Customer Phone + Service Summary,
 * with smart defaults (`status = "received"`, `currency = "EUR"`).
 */
export const quickWorkOrderFormSchema = z.object({
  plateNumber: licensePlateSchema,
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,22}$/, "phoneInvalid"),
  customerName: z.string().trim().max(80, "nameMaxLength"),
  vehicleLabel: z.string().trim().max(80, "fieldTooLong"),
  mileageKm: z
    .number()
    .int("mileageInvalid")
    .min(0, "mileageInvalid")
    .max(3_000_000, "mileageInvalid")
    .nullable(),
  customerSummary: z
    .string()
    .trim()
    .min(2, "titleRequired")
    .max(600, "fieldTooLong"),
  status: z.enum(WORK_ORDER_STATUSES),
  currency: z.enum(["EUR", "BGN"]),
});

export type QuickWorkOrderFormValues = z.infer<typeof quickWorkOrderFormSchema>;

export const workOrderPatchSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES).optional(),
  vehicleLabel: z.string().trim().min(1).max(80).optional(),
  mileageKm: z.number().int().min(0).max(3_000_000).nullable().optional(),
  customerSummary: z.string().trim().max(2000).nullable().optional(),
  internalNotes: z.string().trim().max(2000).nullable().optional(),
  currency: z.enum(["EUR", "BGN"]).optional(),
  dropOffPhotos: z.array(attachmentItemSchema).max(8).optional(),
  nextServiceDate: z
    .string()
    .nullable()
    .refine((v) => v === null || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "dateRequired",
    })
    .optional(),
  nextServiceMileageKm: z
    .number()
    .int()
    .min(1)
    .max(3_000_000)
    .nullable()
    .optional(),
});

export type WorkOrderPatchValues = z.infer<typeof workOrderPatchSchema>;

export const workOrderItemFormSchema = z.object({
  type: z.enum(["labor", "part"]),
  description: z.string().trim().min(2, "titleRequired").max(160, "fieldTooLong"),
  quantity: z
    .number({ invalid_type_error: "costInvalid" })
    .min(0.1, "costInvalid")
    .max(1000, "costInvalid"),
  unitPrice: z
    .number({ invalid_type_error: "costInvalid" })
    .min(0, "costInvalid")
    .max(200_000, "costInvalid"),
});

export type WorkOrderItemFormValues = z.infer<typeof workOrderItemFormSchema>;

export const garageAppointmentFormSchema = z.object({
  customerName: z.string().trim().min(2, "nameMinLength").max(80, "nameMaxLength"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,22}$/, "phoneInvalid"),
  plateNumber: licensePlateSchema,
  serviceRequested: z
    .string()
    .trim()
    .min(2, "titleRequired")
    .max(240, "fieldTooLong"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateRequired"),
  time: z.string().regex(timeSlotRegex, "dateRequired"),
  durationMinutes: z.number().int().min(15).max(480),
  notes: z.string().trim().max(600, "fieldTooLong").nullable(),
});

export type GarageAppointmentFormValues = z.infer<
  typeof garageAppointmentFormSchema
>;

export const garageAppointmentPatchSchema = z.object({
  status: z
    .enum(["requested", "confirmed", "completed", "cancelled"])
    .optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  notes: z.string().trim().max(600).nullable().optional(),
  convertToWorkOrder: z.boolean().optional(),
});

export const staffInviteSchema = z.object({
  displayName: z.string().trim().min(2, "nameMinLength").max(80, "nameMaxLength"),
  email: z.string().trim().email("emailInvalid"),
  password: z
    .string()
    .min(8, "passwordMinLength")
    .max(100, "passwordMaxLength")
    .regex(/[A-Za-z]/, "passwordNeedsLetter")
    .regex(/[0-9]/, "passwordNeedsNumber"),
  staffRole: z.enum(STAFF_ROLES),
});

export type StaffInviteValues = z.infer<typeof staffInviteSchema>;

export const staffPatchSchema = z.object({
  active: z.boolean().optional(),
  staffRole: z.enum(STAFF_ROLES).optional(),
});

export const tyreSetFormSchema = z.object({
  plateNumber: licensePlateSchema,
  customerName: z.string().trim().min(2, "nameMinLength").max(80, "nameMaxLength"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,22}$/, "phoneInvalid"),
  brandModel: z.string().trim().min(2, "titleRequired").max(80, "fieldTooLong"),
  sizeSpec: z.string().trim().min(3, "titleRequired").max(32, "fieldTooLong"),
  season: z.enum(TYRE_SEASONS),
  quantity: z.number().int().min(1).max(8),
  withRims: z.boolean(),
  treadDepthMm: z.number().min(0).max(20).nullable(),
  shelfLocation: z
    .string()
    .trim()
    .min(1, "shelfRequired")
    .max(32, "fieldTooLong"),
  status: z.enum(TYRE_STORAGE_STATUSES),
  seasonalReminderDate: z
    .string()
    .nullable()
    .refine((v) => v === null || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "dateRequired",
    }),
  notes: z.string().trim().max(500, "fieldTooLong").nullable(),
});

export type TyreSetFormValues = z.infer<typeof tyreSetFormSchema>;

export const tyreSetPatchSchema = tyreSetFormSchema.partial();

export const vehicleLinkRequestSchema = z.object({
  plateNumber: licensePlateSchema,
});

