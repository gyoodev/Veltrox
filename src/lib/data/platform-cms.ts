import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { PlatformContentConfig } from "@/types/domain";

export function getDefaultPlatformContent(): PlatformContentConfig {
  return {
    banner: {
      enabled: false,
      variant: "info",
      messageBg: "",
      messageEn: "",
      linkUrl: null,
      linkLabelBg: null,
      linkLabelEn: null,
    },
    faqs: [],
    updatedAt: new Date(0).toISOString(),
    updatedByUid: null,
  };
}

export async function getPublicPlatformCms(): Promise<PlatformContentConfig> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return getDefaultPlatformContent();
  }

  try {
    const snap = await admin.adminDb
      .collection("platformConfig")
      .doc("public")
      .get();

    if (!snap.exists) {
      return getDefaultPlatformContent();
    }

    const raw = snap.data() as Partial<PlatformContentConfig>;
    return {
      banner: {
        enabled: Boolean(raw.banner?.enabled),
        variant: raw.banner?.variant ?? "info",
        messageBg: raw.banner?.messageBg ?? "",
        messageEn: raw.banner?.messageEn ?? "",
        linkUrl: raw.banner?.linkUrl ?? null,
        linkLabelBg: raw.banner?.linkLabelBg ?? null,
        linkLabelEn: raw.banner?.linkLabelEn ?? null,
      },
      faqs: Array.isArray(raw.faqs)
        ? [...raw.faqs].sort((a, b) => a.order - b.order)
        : [],
      updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
      updatedByUid: raw.updatedByUid ?? null,
    };
  } catch {
    return getDefaultPlatformContent();
  }
}

