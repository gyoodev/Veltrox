import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * GET /api/user/export
 * GDPR Right to Data Portability (Article 20):
 * Exports all personal and vehicle records owned by the authenticated user
 * across Veltrox's multi-tenant Firestore collections.
 */
export async function GET(): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const uid = ctx.session.uid;
  const ownerCollections = [
    "vehicles",
    "diaryEntries",
    "reminders",
    "documents",
    "appointments",
    "notifications",
  ] as const;

  const exportedCollections: Record<string, unknown[]> = {};

  await Promise.all(
    ownerCollections.map(async (colName) => {
      const snap = await admin.adminDb
        .collection(colName)
        .where("ownerId", "==", uid)
        .get();
      exportedCollections[colName] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    })
  );

  const nowIso = new Date().toISOString();

  await admin.adminDb.collection("auditLogs").add({
    action: "GDPR_DATA_EXPORTED",
    actorUid: uid,
    actorRole: ctx.profile.role,
    targetUid: uid,
    targetGarageId: ctx.profile.garageId ?? null,
    metadata: {
      collectionsExported: ownerCollections.length,
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  const payload = {
    schemaVersion: "1.0",
    exportedAt: nowIso,
    platform: "Veltrox",
    gdprNotice:
      "Personal data archive generated under EU GDPR Article 20 (Right to Data Portability).",
    profile: ctx.profile,
    collections: exportedCollections,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="veltrox-gdpr-export-${uid.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

