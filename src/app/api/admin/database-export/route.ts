import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function GET(): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DATABASE_NOT_AVAILABLE" }, { status: 500 });
  }

  try {
    const [
      usersSnap,
      garagesSnap,
      vehiclesSnap,
      workOrdersSnap,
      appointmentsSnap,
      remindersSnap,
      platformConfigSnap,
    ] = await Promise.all([
      admin.adminDb.collection("users").get(),
      admin.adminDb.collection("garages").get(),
      admin.adminDb.collection("vehicles").get(),
      admin.adminDb.collection("workOrders").get(),
      admin.adminDb.collection("appointments").get(),
      admin.adminDb.collection("reminders").get(),
      admin.adminDb.collection("platformConfig").get(),
    ]);

    const backup = {
      exportTimestamp: new Date().toISOString(),
      exportedBy: ctx.profile.email,
      platform: "Veltrox Auto Management",
      version: "1.0",
      counts: {
        users: usersSnap.size,
        garages: garagesSnap.size,
        vehicles: vehiclesSnap.size,
        workOrders: workOrdersSnap.size,
        appointments: appointmentsSnap.size,
        reminders: remindersSnap.size,
      },
      data: {
        users: usersSnap.docs.map((d) => {
          const u = d.data();
          return { id: d.id, ...u };
        }),
        garages: garagesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        vehicles: vehiclesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        workOrders: workOrdersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        appointments: appointmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        reminders: remindersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        platformConfig: platformConfigSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      },
    };

    // Log the backup export in auditLogs
    await admin.adminDb.collection("auditLogs").add({
      action: "DATABASE_SNAPSHOT_EXPORTED",
      actorUid: ctx.profile.uid,
      actorRole: "ADMIN",
      targetUid: null,
      targetGarageId: null,
      metadata: {
        usersCount: usersSnap.size,
        garagesCount: garagesSnap.size,
        vehiclesCount: vehiclesSnap.size,
      },
      createdAt: new Date().toISOString(),
    });

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="veltrox-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup export error:", err);
    return NextResponse.json(
      { error: "EXPORT_FAILED", message: "Failed to create database snapshot" },
      { status: 500 }
    );
  }
}
