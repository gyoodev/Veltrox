import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { dispatchMultiChannelNotification } from "@/lib/notifications/dispatcher";
import {
  buildProRequiredResponse,
  isGaragePro,
} from "@/lib/subscriptions/entitlements";
import type { AppLocale, Customer, Reminder, UserProfile } from "@/types/domain";

export const runtime = "nodejs";

const winbackSchema = z.object({
  customerId: z.string().min(1).max(128),
  campaignType: z.enum(["seasonal_check", "annual_service", "tyre_swap", "custom"]),
  customMessage: z.string().trim().max(400).optional(),
  plateNumber: z.string().trim().max(24).optional(),
  vehicleLabel: z.string().trim().max(120).optional(),
});

/**
 * POST /api/garage/pro-tools/winback
 * Garage Pro-only customer win-back outreach tool.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await resolveGarageApiAuth({ requireManager: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isGaragePro(auth.garage)) {
    return buildProRequiredResponse("/garage/subscription", "garage_pro");
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = winbackSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { customerId, campaignType, customMessage, plateNumber, vehicleLabel } =
    parsed.data;

  const custSnap = await admin.adminDb
    .collection("customers")
    .doc(customerId)
    .get();
  if (!custSnap.exists) {
    return NextResponse.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
  }
  const customer = { ...(custSnap.data() as Customer), id: custSnap.id };
  if (customer.garageId !== auth.garage.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let ownerProfile: UserProfile | null = null;
  if (customer.linkedOwnerId) {
    const ownerSnap = await admin.adminDb
      .collection("users")
      .doc(customer.linkedOwnerId)
      .get();
    if (ownerSnap.exists) {
      ownerProfile = ownerSnap.data() as UserProfile;
    }
  }

  const locale: AppLocale =
    ownerProfile?.language ?? auth.profile.language ?? "bg";
  const toEmail = customer.email || ownerProfile?.email || null;
  const toPhone = customer.phone || ownerProfile?.phone || null;
  const plate = plateNumber || customer.plateNumbers[0] || "";
  const vehicleText = vehicleLabel || plate || (locale === "bg" ? "вашия автомобил" : "your vehicle");
  const nowIso = new Date().toISOString();

  const templateCopy = (() => {
    if (campaignType === "custom" && customMessage) {
      return {
        subject: `${auth.garage.name} — ${locale === "bg" ? "Специална покана за сервиз" : "Workshop Service Invitation"}`,
        body: customMessage,
      };
    }
    if (campaignType === "tyre_swap") {
      return locale === "bg"
        ? {
            subject: `${auth.garage.name} — Сезонна смяна на гуми (${plate || vehicleText})`,
            body: `Здравейте, ${customer.fullName}! Време е за сезонна смяна и баланс на гумите за ${vehicleText}. Запазете удобен час в ${auth.garage.name}.`,
          }
        : {
            subject: `${auth.garage.name} — Seasonal Tyre Changeover (${plate || vehicleText})`,
            body: `Hi ${customer.fullName}, it is time for seasonal tyre mounting & balancing for ${vehicleText}. Book your bay directly with ${auth.garage.name}.`,
          };
    }
    if (campaignType === "annual_service") {
      return locale === "bg"
        ? {
            subject: `${auth.garage.name} — Годишно обслужване и масла`,
            body: `Здравейте, ${customer.fullName}! Измина време от последното посещение за ${vehicleText}. Очакваме ви в ${auth.garage.name} за смяна на масло, филтри и оглед.`,
          }
        : {
            subject: `${auth.garage.name} — Annual Oil & Filter Checkup`,
            body: `Hi ${customer.fullName}, it has been a while since ${vehicleText} visited ${auth.garage.name}. Schedule your annual oil, filter, and safety checkup today.`,
          };
    }
    return locale === "bg"
      ? {
          subject: `${auth.garage.name} — Безплатна сезонна диагностика`,
          body: `Здравейте, ${customer.fullName}! Като ценен клиент на ${auth.garage.name}, каним ви на преференциален сезонен преглед за ${vehicleText}.`,
        }
      : {
          subject: `${auth.garage.name} — Seasonal Inspection Invitation`,
          body: `Hi ${customer.fullName}, as a valued client of ${auth.garage.name}, we invite ${vehicleText} for a seasonal multipoint inspection & A/C check.`,
        };
  })();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const bookingUrl = `${appUrl}/garages/${auth.garage.slug}`;

  const remRef = admin.adminDb.collection("reminders").doc();
  const channels: Array<"email" | "sms"> = ["email"];
  if (toPhone) channels.push("sms");

  const remDoc: Omit<Reminder, "id"> = {
    ownerId: customer.linkedOwnerId ?? null,
    garageId: auth.garage.id,
    vehicleId: null,
    workOrderId: null,
    recipientEmail: toEmail,
    recipientPhone: toPhone,
    recipientName: customer.fullName,
    plateNumber: plate,
    type: campaignType === "tyre_swap" ? "seasonal_tyres" : "custom_service",
    title: templateCopy.subject,
    notes: templateCopy.body,
    dueDate: nowIso.slice(0, 10),
    dueMileageKm: null,
    channels,
    status: "scheduled",
    sentAt: null,
    lastError: null,
    completedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await remRef.set(remDoc);

  const dispatchResult = await dispatchMultiChannelNotification({
    ownerId: customer.linkedOwnerId ?? null,
    garageId: auth.garage.id,
    reminderId: remRef.id,
    deliveryKey: `pro-winback:${customer.id}:${nowIso.slice(0, 10)}:${campaignType}`,
    channels,
    createInAppRecord: Boolean(customer.linkedOwnerId),
    consumeGarageQuota: true,
    payload: {
      toEmail,
      toPhone,
      recipientName: customer.fullName,
      locale,
      subject: templateCopy.subject,
      textBody: `${templateCopy.body}\n\n${bookingUrl}`,
      htmlBody: `<p>${templateCopy.body}</p><p><a href="${bookingUrl}">${auth.garage.name}</a></p>`,
      actionUrl: `/garages/${auth.garage.slug}`,
    },
  });

  if (dispatchResult.quotaExceeded) {
    return NextResponse.json({ error: "QUOTA_EXCEEDED" }, { status: 429 });
  }

  await remRef.update({
    status: "sent",
    sentAt: nowIso,
    updatedAt: nowIso,
  });

  return NextResponse.json({
    ok: true,
    reminderId: remRef.id,
    results: dispatchResult.results,
  });
}

