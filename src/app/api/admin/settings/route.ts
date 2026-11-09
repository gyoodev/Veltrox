import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/lib/data/platform-settings";
import type { PlatformSettingsConfig } from "@/types/domain";

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
    const body = (await request.json()) as Partial<PlatformSettingsConfig>;
    const updated = await updatePlatformSettings(body, ctx.profile.uid);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error("Error updating platform settings:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update platform settings" },
      { status: 500 }
    );
  }
}

