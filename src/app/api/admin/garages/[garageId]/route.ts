import { type NextRequest, NextResponse } from "next/server";
import { resolveAdminApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { Garage } from "@/types/domain";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ garageId: string }> }
): Promise<NextResponse> {
  const auth = await resolveAdminApiAuth();
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

  const { garageId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    status?: "approved" | "pending" | "suspended" | "rejected";
    plan?: "free" | "pro";
  } | null;

  if (!body) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const garageRef = admin.adminDb.collection("garages").doc(garageId);
  const garageSnap = await garageRef.get();

  if (!garageSnap.exists) {
    return NextResponse.json({ error: "GARAGE_NOT_FOUND" }, { status: 404 });
  }

  const currentGarage = garageSnap.data() as Garage;
  const nowIso = new Date().toISOString();
  const updates: Partial<Garage> & { updatedAt: string } = {
    updatedAt: nowIso,
  };

  if (body.status && ["approved", "pending", "suspended", "rejected"].includes(body.status)) {
    updates.status = body.status;
  }

  if (body.plan && ["free", "pro"].includes(body.plan)) {
    updates.plan = body.plan;
  }

  await garageRef.update(updates);

  // If garage status changed, also update the owner user profile if needed
  if (updates.status && currentGarage.ownerUid) {
    try {
      const ownerRef = admin.adminDb.collection("users").doc(currentGarage.ownerUid);
      const ownerSnap = await ownerRef.get();
      if (ownerSnap.exists) {
        await ownerRef.update({
          garageStatus: updates.status,
          updatedAt: nowIso,
        });
      }
    } catch (err) {
      console.warn("Could not sync owner user garageStatus:", err);
    }
  }

  // Audit log entry
  try {
    await admin.adminDb.collection("auditLogs").add({
      actorUid: auth.session.uid,
      actorRole: auth.session.role,
      action: "GARAGE_STATUS_OVERRIDE",
      targetGarageId: garageId,
      metadata: {
        previousStatus: currentGarage.status,
        newStatus: updates.status ?? currentGarage.status,
        previousPlan: currentGarage.plan,
        newPlan: updates.plan ?? currentGarage.plan,
      },
      createdAt: nowIso,
    });
  } catch (err) {
    console.warn("Failed to write audit log:", err);
  }

  return NextResponse.json({
    ok: true,
    garage: {
      ...currentGarage,
      ...updates,
    },
  });
}

