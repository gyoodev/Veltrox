import "server-only";

import { sendNotification, setVapidDetails } from "web-push";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { PushSubscriptionRecord } from "@/types/domain";

export function getPublicVapidKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    null
  );
}

export function isWebPushConfigured(): boolean {
  return Boolean(getPublicVapidKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

/**
 * Sends a browser Web Push notification to all active push subscriptions for `uid`.
 * Automatically prunes expired (`404` / `410`) endpoints.
 */
export async function sendWebPushToUser(params: {
  uid: string;
  title: string;
  body: string;
  actionUrl?: string | null;
}): Promise<{ sent: number; failed: number; configured: boolean }> {
  const publicKey = getPublicVapidKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    return { sent: 0, failed: 0, configured: false };
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return { sent: 0, failed: 0, configured: true };
  }

  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:support@veltrox.bg";
  setVapidDetails(subject, publicKey, privateKey);

  const snap = await admin.adminDb
    .collection("pushSubscriptions")
    .where("uid", "==", params.uid)
    .get();

  if (snap.empty) {
    return { sent: 0, failed: 0, configured: true };
  }

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    url: params.actionUrl || "/app",
    icon: "/icon.svg",
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    snap.docs.map(async (doc) => {
      const sub = doc.data() as PushSubscriptionRecord;
      try {
        await sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await doc.ref.delete().catch(() => {});
        }
      }
    })
  );

  return { sent, failed, configured: true };
}

