import { DocumentsVaultClient } from "@/components/car-diary/documents-vault-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";

export default async function DocumentsVaultPage() {
  const { profile } = await requireRole(["USER", "ADMIN"]);
  const bundle = await getUserDiaryBundle(profile.uid);

  return (
    <DocumentsVaultClient
      ownerUid={profile.uid}
      initialDocuments={bundle.documents}
      vehicles={bundle.vehicles}
      showPageHeader
    />
  );
}

