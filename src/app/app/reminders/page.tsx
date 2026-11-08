import { RemindersListClient } from "@/components/car-diary/reminders-list-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";

export default async function RemindersPage() {
  const { profile } = await requireRole(["USER", "ADMIN"]);
  const bundle = await getUserDiaryBundle(profile.uid);

  return (
    <RemindersListClient
      initialReminders={bundle.reminders}
      vehicles={bundle.vehicles}
      documents={bundle.documents}
      showPageHeader
    />
  );
}

