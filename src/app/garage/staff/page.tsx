import { StaffManagementClient } from "@/components/garage/staff-management-client";
import { requireGarageManagerPage } from "@/lib/auth/server-auth";
import { getGarageWorkspaceBundle } from "@/lib/data/garage";

export default async function GarageStaffPage() {
  const { garage } = await requireGarageManagerPage();
  const bundle = await getGarageWorkspaceBundle(garage.id);

  return <StaffManagementClient initialStaff={bundle.staff} />;
}

