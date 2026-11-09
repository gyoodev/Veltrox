import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AppNotification } from "@/types/domain";

const broadcastSchema = z.object({
  target: z.enum(["everyone", "all_users", "all_garages", "specific_email"]),
  specificEmail: z.string().email().optional().or(z.literal("")),
  subject: z.string().min(2).max(120),
  body: z.string().min(2).max(1000),
  actionUrl: z.string().max(256).optional().or(z.literal("")),
  priority: z.enum(["normal", "important", "critical"]).default("normal"),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Database not connected" },
      { status: 500 }
    );
  }

  try {
    const raw = await request.json();
    const parsed = broadcastSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { target, specificEmail, subject, body, actionUrl } = parsed.data;

    let targetUids: string[] = [];

    if (target === "specific_email") {
      if (!specificEmail) {
        return NextResponse.json(
          { error: "VALIDATION_FAILED", message: "Имейлът е задължителен" },
          { status: 400 }
        );
      }
      const uSnap = await admin.adminDb
        .collection("users")
        .where("email", "==", specificEmail.toLowerCase().trim())
        .limit(1)
        .get();

      const targetDoc = uSnap.docs[0];
      if (uSnap.empty || !targetDoc) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "Потребителят с този имейл не е намерен" },
          { status: 404 }
        );
      }
      targetUids = [targetDoc.id];
    } else {
      let query: FirebaseFirestore.Query = admin.adminDb.collection("users");
      if (target === "all_users") {
        query = query.where("role", "==", "USER");
      } else if (target === "all_garages") {
        query = query.where("role", "==", "GARAGE_OWNER");
      }
      const snap = await query.get();
      targetUids = snap.docs.map((d) => d.id);
    }

    if (targetUids.length === 0) {
      return NextResponse.json({
        ok: true,
        sentCount: 0,
        message: "Няма намерени потребители за тази целева група",
      });
    }

    const nowIso = new Date().toISOString();
    const notificationsCol = admin.adminDb.collection("notifications");

    // Chunk into batches of 450 (Firestore batch max is 500 ops)
    const chunkSize = 400;
    for (let i = 0; i < targetUids.length; i += chunkSize) {
      const chunk = targetUids.slice(i, i + chunkSize);
      const batch = admin.adminDb.batch();

      for (const uid of chunk) {
        const docRef = notificationsCol.doc();
        const notification: Omit<AppNotification, "id"> = {
          ownerId: uid,
          garageId: null,
          channel: "in_app",
          subject,
          body,
          actionUrl: actionUrl || null,
          status: "sent",
          readAt: null,
          createdAt: nowIso,
        };
        batch.set(docRef, notification);
      }

      await batch.commit();
    }

    // Write audit log entry
    await admin.adminDb.collection("auditLogs").add({
      action: "BROADCAST_NOTIFICATION_SENT",
      actorUid: ctx.profile.uid,
      actorRole: "ADMIN",
      targetUid: target === "specific_email" ? targetUids[0] : null,
      targetGarageId: null,
      metadata: {
        target,
        recipientsCount: targetUids.length,
        subject,
      },
      createdAt: nowIso,
    });

    return NextResponse.json({
      ok: true,
      sentCount: targetUids.length,
      message: `Успешно изпратено известие до ${targetUids.length} потребители`,
    });
  } catch (err) {
    console.error("Broadcast notification error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Неуспешно изпращане на известие" },
      { status: 500 }
    );
  }
}
