import { NextResponse } from "next/server";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { garageSettingsPatchSchema } from "@/lib/validators/garage";
import type { Garage } from "@/types/domain";

export const runtime = "nodejs";

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await resolveGarageApiAuth({ requireManager: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = garageSettingsPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const existing = auth.garage;

  if (
    data.logoStoragePath &&
    !data.logoStoragePath.startsWith(`garages/${existing.id}/`) &&
    !data.logoStoragePath.startsWith("imgbb:") &&
    !data.logoStoragePath.startsWith("public/uploads/") &&
    !data.logoStoragePath.startsWith("http://") &&
    !data.logoStoragePath.startsWith("https://")
  ) {
    return NextResponse.json(
      { error: "FORBIDDEN_STORAGE_PATH" },
      { status: 403 }
    );
  }

  if (
    data.logoStoragePath !== undefined &&
    existing.logoStoragePath &&
    existing.logoStoragePath !== data.logoStoragePath &&
    existing.logoStoragePath.startsWith(`garages/${existing.id}/`)
  ) {
    try {
      await admin.adminStorage
        .bucket()
        .file(existing.logoStoragePath)
        .delete({ ignoreNotFound: true });
    } catch {
      // Non-fatal storage cleanup
    }
  }

  const nextPlan = data.plan ?? existing.plan;
  const nextQuota =
    data.plan !== undefined
      ? data.plan === "pro"
        ? 500
        : 50
      : existing.monthlyReminderQuota;

  const updated: Garage = {
    ...existing,
    name: data.name ?? existing.name,
    description:
      data.description !== undefined
        ? data.description && data.description.trim().length > 0
          ? data.description.trim()
          : null
        : existing.description ?? null,
    city: data.city ?? existing.city,
    address: data.address ?? existing.address,
    phone: data.phone ?? existing.phone,
    email: data.email ?? existing.email,
    workingHours: data.workingHours ?? existing.workingHours,
    servicesOffered: data.servicesOffered
      ? Array.from(new Set(data.servicesOffered))
      : existing.servicesOffered,
    logoUrl: data.logoUrl !== undefined ? data.logoUrl : existing.logoUrl,
    logoStoragePath:
      data.logoStoragePath !== undefined
        ? data.logoStoragePath
        : existing.logoStoragePath ?? null,
    plan: nextPlan,
    monthlyReminderQuota: nextQuota,
    updatedAt: new Date().toISOString(),
  };

  await admin.adminDb.collection("garages").doc(existing.id).set(updated);

  return NextResponse.json({ garage: updated });
}

