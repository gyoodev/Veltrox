import { CmsEditorClient } from "@/components/admin/cms-editor-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getPublicPlatformCms } from "@/lib/data/platform-cms";

export default async function AdminContentCmsPage() {
  await requireRole(["ADMIN"]);
  const content = await getPublicPlatformCms();

  return <CmsEditorClient initialContent={content} />;
}

