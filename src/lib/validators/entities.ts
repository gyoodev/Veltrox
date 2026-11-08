import { z } from "zod";

/**
 * Foundational Multi-Tenant Entity Schemas (Shared Client + Server)
 *
 * Enforces `ownerId` on user-owned entities and `garageId` on garage-owned entities,
 * plus normalized license plate handling (treated as personal data under GDPR).
 */

export function normalizeLicensePlate(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

export const licensePlateSchema = z
  .string()
  .trim()
  .min(4, "plateInvalid")
  .max(15, "plateInvalid")
  .regex(/^[A-Za-zА-Яа-я0-9\s-]+$/, "plateInvalid");

export const vehicleBaseSchema = z.object({
  ownerId: z.string().min(1),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
  plateNumber: licensePlateSchema,
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "vinInvalid")
    .nullable()
    .optional(),
  fuelType: z.enum([
    "petrol",
    "diesel",
    "hybrid",
    "plug_in_hybrid",
    "electric",
    "lpg",
  ]),
  currentMileageKm: z.number().int().min(0).max(3_000_000),
});

export const workOrderQuickCreateSchema = z.object({
  garageId: z.string().min(1),
  plateNumber: licensePlateSchema,
  customerPhone: z.string().trim().min(7).max(24),
  customerName: z.string().trim().min(2).max(80).optional(),
  serviceSummary: z.string().trim().min(2).max(240),
  status: z
    .enum([
      "received",
      "diagnosing",
      "waiting_parts",
      "in_progress",
      "ready",
      "completed",
    ])
    .default("received"),
});

