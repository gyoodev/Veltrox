import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/lib/data/platform-settings";

const platformSettingsPatchSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(500).optional(),
  allowRegistrations: z.boolean().optional(),
  allowGarageApplications: z.boolean().optional(),
  complianceChecksEnabled: z.boolean().optional(),
  defaultCurrency: z.enum(["BGN", "EUR"]).optional(),
  garageSubscriptionsEnabled: z.boolean().optional(),
  proPlanPriceEur: z.number().finite().min(0).max(100_000).optional(),
  userSubscriptionsEnabled: z.boolean().optional(),
  userProPlanPriceEur: z.number().finite().min(0).max(100_000).optional(),
  systemNotice: z.string().trim().max(500).optional(),
});

export async function GET(): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const settings = await getPlatformSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = platformSettingsPatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updatePlatformSettings(parsed.data, ctx.profile.uid);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error("Error updating platform settings:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update platform settings" },
      { status: 500 }
    );
  }
}

