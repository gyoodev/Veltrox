import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { resolveAdminApiAuth } from "@/lib/auth/server-auth";
import { runScheduledReminderSweep } from "@/lib/notifications/reminder-engine";

function isValidCronSecret(authHeader: string | null): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret || configuredSecret.length < 16 || !authHeader) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${configuredSecret}`, "utf8");
  const actual = Buffer.from(authHeader.trim(), "utf8");
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}

/**
 * GET /api/cron/reminders — Invoked by Vercel Cron (`Authorization: Bearer ${CRON_SECRET}`).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "UNAUTHORIZED_CRON" }, { status: 401 });
  }

  const summary = await runScheduledReminderSweep({
    actorUid: "vercel-cron",
    actorRole: "SYSTEM",
  });

  return NextResponse.json({ ok: true, summary });
}

/**
 * POST /api/cron/reminders — Allows a signed-in ADMIN to run an immediate reminder sweep.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (isValidCronSecret(request.headers.get("authorization"))) {
    const summary = await runScheduledReminderSweep({
      actorUid: "cron-webhook",
      actorRole: "SYSTEM",
    });
    return NextResponse.json({ ok: true, summary });
  }

  const adminAuth = await resolveAdminApiAuth();
  if (!adminAuth.ok) {
    return NextResponse.json(
      { error: adminAuth.error },
      { status: adminAuth.status }
    );
  }

  const summary = await runScheduledReminderSweep({
    actorUid: adminAuth.session.uid,
    actorRole: "ADMIN",
  });

  return NextResponse.json({ ok: true, summary });
}

