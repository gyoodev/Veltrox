import { AppointmentsCalendarClient } from "@/components/garage/appointments-calendar-client";
import { requireOnboardedGarage } from "@/lib/auth/server-auth";
import { getGarageWorkspaceBundle } from "@/lib/data/garage";

export default async function GarageAppointmentsPage() {
  const { garage } = await requireOnboardedGarage();
  const bundle = await getGarageWorkspaceBundle(garage.id);

  return (
    <AppointmentsCalendarClient initialAppointments={bundle.appointments} />
  );
}

