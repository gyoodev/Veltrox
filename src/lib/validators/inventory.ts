import { z } from "zod";

export const inventoryPartFormSchema = z.object({
  sku: z.string().trim().min(1, "titleRequired").max(64, "fieldTooLong"),
  name: z.string().trim().min(2, "titleRequired").max(160, "fieldTooLong"),
  brand: z.string().trim().max(80, "fieldTooLong").nullable().optional(),
  category: z.string().trim().max(80, "fieldTooLong").nullable().optional(),
  supplierName: z.string().trim().max(120, "fieldTooLong").nullable().optional(),
  costPrice: z
    .number({ invalid_type_error: "costInvalid" })
    .min(0, "costInvalid")
    .max(200_000, "costInvalid"),
  sellPrice: z
    .number({ invalid_type_error: "costInvalid" })
    .min(0, "costInvalid")
    .max(200_000, "costInvalid"),
  stockQty: z
    .number({ invalid_type_error: "costInvalid" })
    .min(0, "costInvalid")
    .max(100_000, "costInvalid"),
  minStockAlert: z
    .number({ invalid_type_error: "costInvalid" })
    .min(0, "costInvalid")
    .max(100_000, "costInvalid"),
  unit: z.string().trim().min(1).max(20).optional(),
  notes: z.string().trim().max(500, "fieldTooLong").nullable().optional(),
});

export type InventoryPartFormValues = z.infer<typeof inventoryPartFormSchema>;

export const inventoryPartPatchSchema = inventoryPartFormSchema.partial().extend({
  stockDelta: z.number().finite().min(-10000).max(10000).optional(),
});

