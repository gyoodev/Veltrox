import { NextResponse } from "next/server";
import { computeDayAvailability } from "@/lib/appointments/availability";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { Appointment, Garage } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const garageId = searchParams.get("garageId")?.trim();
  const date = searchParams.get("date")?.trim();
  const durationRaw = searchParams.get("duration");
  const durationMinutes = durationRaw
    ? Math.min(480, Math.max(15, Number.parseInt(durationRaw, 10) || 60))
    : 60;

  if (!garageId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "INVALID_QUERY_PARAMS" },
      { status: 400 }
    );
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const garageSnap = await admin.adminDb
    .collection("garages")
    .doc(garageId)
    .get();
  if (!garageSnap.exists) {
    return NextResponse.json({ error: "GARAGE_NOT_FOUND" }, { status: 404 });
  }

  const garage = garageSnap.data() as Garage;
  if (garage.status !== "approved") {
    return NextResponse.json(
      { error: "GARAGE_NOT_AVAILABLE" },
      { status: 403 }
    );
  }

  const apptsSnap = await admin.adminDb
    .collection("appointments")
    .where("garageId", "==", garageId)
    .get();

  const appointments = apptsSnap.docs.map(
    (d) =>
      d.data() as Pick<
        Appointment,
        "scheduledStart" | "scheduledEnd" | "status"
      >
  );

  const availability = computeDayAvailability({
    garage,
    date,
    durationMinutes,
    appointments,
  });

  return NextResponse.json(availability);
}

