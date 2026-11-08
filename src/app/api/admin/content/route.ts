import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import { resolveAdminApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { platformContentSchema } from "@/lib/validators/admin";
import type { PlatformContentConfig } from "@/types/domain";

export async function PUT(request: NextRequest): Promise<NextResponse> {
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

  const rawBody = await request.json().catch(() => null);
  const parsed = platformContentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const sortedFaqs = [...parsed.data.faqs]
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({
      ...item,
      order: idx,
    }));

  const docData: PlatformContentConfig = {
    banner: {
      enabled: parsed.data.banner.enabled,
      variant: parsed.data.banner.variant,
      messageBg: parsed.data.banner.messageBg,
      messageEn: parsed.data.banner.messageEn,
      linkUrl: parsed.data.banner.linkUrl || null,
      linkLabelBg: parsed.data.banner.linkLabelBg || null,
      linkLabelEn: parsed.data.banner.linkLabelEn || null,
    },
    faqs: sortedFaqs,
    updatedAt: nowIso,
    updatedByUid: auth.session.uid,
  };

  await admin.adminDb.collection("platformConfig").doc("public").set(docData);

  await admin.adminDb.collection("auditLogs").add({
    action: "CONTENT_UPDATED",
    actorUid: auth.session.uid,
    actorRole: "ADMIN",
    targetUid: null,
    targetGarageId: null,
    metadata: {
      bannerEnabled: docData.banner.enabled,
      faqCount: docData.faqs.length,
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, content: docData });
}

