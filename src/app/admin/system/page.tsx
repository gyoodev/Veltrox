import { SystemHealthClient } from "@/components/admin/system-health-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminSystemPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  const now = new Date();
  const serverTime = now.toLocaleString("bg-BG", {
    timeZone: "Europe/Sofia",
    dateStyle: "short",
    timeStyle: "medium",
  });

  return (
    <SystemHealthClient
      stats={{
        totalVehicles: bundle.vehicles.length,
        totalUsers: bundle.users.length,
        totalGarages: bundle.garages.length,
        totalReminders: bundle.reminders.length,
        totalWorkOrders: bundle.workOrders.length,
      }}
      serverTime={serverTime}
    />
  );
}
