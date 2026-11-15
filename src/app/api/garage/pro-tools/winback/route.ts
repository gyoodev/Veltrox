import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveGarageApiAuth } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { dispatchMultiChannelNotification } from "@/lib/notifications/dispatcher";
import {
  buildProRequiredResponse,
  isGaragePro,
} from "@/lib/subscriptions/entitlements";
import type {
  AppLocale,
  Customer,
  Reminder,
  TyreSet,
  UserProfile,
  WorkOrder,
} from "@/types/domain";

export const runtime = "nodejs";

const winbackSchema = z
  .object({
    customerId: z.string().min(1).max(128).optional(),
    tyreSetId: z.string().min(1).max(128).optional(),
    workOrderId: z.string().min(1).max(128).optional(),
    campaignType: z.enum([
      "seasonal_check",
      "annual_service",
      "tyre_swap",
      "tyre_replacement",
      "quote_followup",
      "seasonal_promo",
      "custom",
    ]),
    customMessage: z.string().trim().max(400).optional(),
    plateNumber: z.string().trim().max(24).optional(),
    vehicleLabel: z.string().trim().max(120).optional(),
  })
  .refine((v) => Boolean(v.customerId || v.tyreSetId || v.workOrderId), {
    message: "TARGET_REQUIRED",
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

  const {
    customerId,
    tyreSetId,
    workOrderId,
    campaignType,
    customMessage,
    plateNumber,
    vehicleLabel,
  } = parsed.data;

  let customer: Customer | null = null;
  let tyreSet: TyreSet | null = null;
  let workOrder: WorkOrder | null = null;

  if (workOrderId) {
    const woSnap = await admin.adminDb
      .collection("workOrders")
      .doc(workOrderId)
      .get();
    if (!woSnap.exists) {
      return NextResponse.json({ error: "WORK_ORDER_NOT_FOUND" }, { status: 404 });
    }
    workOrder = { ...(woSnap.data() as WorkOrder), id: woSnap.id };
    if (workOrder.garageId !== auth.garage.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  if (tyreSetId) {
    const tyreSnap = await admin.adminDb
      .collection("tyreSets")
      .doc(tyreSetId)
      .get();
    if (!tyreSnap.exists) {
      return NextResponse.json({ error: "TYRE_SET_NOT_FOUND" }, { status: 404 });
    }
    tyreSet = { ...(tyreSnap.data() as TyreSet), id: tyreSnap.id };
    if (tyreSet.garageId !== auth.garage.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const effectiveCustomerId =
    customerId ?? tyreSet?.customerId ?? workOrder?.customerId ?? undefined;
  if (effectiveCustomerId) {
    const custSnap = await admin.adminDb
      .collection("customers")
      .doc(effectiveCustomerId)
      .get();
    if (custSnap.exists) {
      const foundCust = { ...(custSnap.data() as Customer), id: custSnap.id };
      if (foundCust.garageId !== auth.garage.id) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      customer = foundCust;
    } else if (customerId) {
      return NextResponse.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
    }
  }

  const recipientName =
    customer?.fullName ??
    workOrder?.customerName ??
    tyreSet?.customerName ??
    "";
  if (!recipientName) {
    return NextResponse.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
  }

  const effectiveOwnerId =
    customer?.linkedOwnerId ?? workOrder?.linkedOwnerId ?? null;
  let ownerProfile: UserProfile | null = null;
  if (effectiveOwnerId) {
    const ownerSnap = await admin.adminDb
      .collection("users")
      .doc(effectiveOwnerId)
      .get();
    if (ownerSnap.exists) {
      ownerProfile = ownerSnap.data() as UserProfile;
    }
  }

  const locale: AppLocale =
    ownerProfile?.language ?? auth.profile.language ?? "bg";
  const toEmail =
    customer?.email || workOrder?.customerEmail || ownerProfile?.email || null;
  const toPhone =
    customer?.phone ||
    workOrder?.customerPhone ||
    tyreSet?.customerPhone ||
    ownerProfile?.phone ||
    null;
  const plate =
    plateNumber ||
    workOrder?.plateNumber ||
    tyreSet?.plateNumber ||
    customer?.plateNumbers[0] ||
    "";
  const vehicleText =
    vehicleLabel ||
    workOrder?.vehicleLabel ||
    tyreSet?.brandModel ||
    plate ||
    (locale === "bg" ? "вашия автомобил" : "your vehicle");
  const nowIso = new Date().toISOString();

  const templateCopy = (() => {
    if (campaignType === "custom" && customMessage) {
      return {
        subject: `${auth.garage.name} — ${locale === "bg" ? "Специална покана за сервиз" : "Workshop Service Invitation"}`,
        body: customMessage,
      };
    }
    if (campaignType === "quote_followup") {
      return locale === "bg"
        ? {
            subject: `${auth.garage.name} — Очаква се одобрение на оферта (${plate || vehicleText})`,
            body: `Здравейте, ${recipientName}! Изпратихме актуализирана оферта за ремонт на ${vehicleText}. Можете да я прегледате и потвърдите с 1 клик от статуса на поръчката.`,
          }
        : {
            subject: `${auth.garage.name} — Repair Estimate Awaiting Approval (${plate || vehicleText})`,
            body: `Hi ${recipientName}, we prepared a repair estimate for ${vehicleText}. Open your live status link to review items and approve in 1 click.`,
          };
    }
    if (campaignType === "seasonal_promo") {
      return locale === "bg"
        ? {
            subject: `${auth.garage.name} — Сезонна преференциална оферта (${vehicleText})`,
            body:
              customMessage ||
              `Здравейте, ${recipientName}! Запазете час през този месец в ${auth.garage.name} с преференциални условия за сезонна профилактика и диагностика на ${vehicleText}.`,
          }
        : {
            subject: `${auth.garage.name} — Seasonal Bay Special Offer (${vehicleText})`,
            body:
              customMessage ||
              `Hi ${recipientName}, book this month with ${auth.garage.name} for our seasonal checkup & priority service offer for ${vehicleText}.`,
          };
    }
    if (campaignType === "tyre_replacement") {
      return locale === "bg"
        ? {
            subject: `${auth.garage.name} — Препоръка за нови гуми (${plate || vehicleText})`,
            body: `Здравейте, ${recipientName}! При съхранение на гумите ви (${tyreSet?.sizeSpec ?? vehicleText}) отчетохме нисък грайфер (${tyreSet?.treadDepthMm ?? "≤3.5"} мм). Изпратете запитване за преференциална оферта за нов комплект в ${auth.garage.name}.`,
          }
        : {
            subject: `${auth.garage.name} — Tread Depth Advisory & Tyre Offer (${plate || vehicleText})`,
            body: `Hi ${recipientName}, your stored tyres (${tyreSet?.sizeSpec ?? vehicleText}) measured low tread depth (${tyreSet?.treadDepthMm ?? "≤3.5"} mm). Reply or book with ${auth.garage.name} for a seasonal replacement quote.`,
          };
    }
    if (campaignType === "tyre_swap") {
      return locale === "bg"
        ? {
            subject: `${auth.garage.name} — Сезонна смяна на гуми (${plate || vehicleText})`,
            body: `Здравейте, ${recipientName}! Време е за сезонна смяна и баланс на гумите за ${vehicleText}. Запазете удобен час в ${auth.garage.name}.`,
          }
        : {
            subject: `${auth.garage.name} — Seasonal Tyre Changeover (${plate || vehicleText})`,
            body: `Hi ${recipientName}, it is time for seasonal tyre mounting & balancing for ${vehicleText}. Book your bay directly with ${auth.garage.name}.`,
          };
    }
    if (campaignType === "annual_service") {
      return locale === "bg"
        ? {
            subject: `${auth.garage.name} — Годишно обслужване и масла`,
            body: `Здравейте, ${recipientName}! Измина време от последното посещение за ${vehicleText}. Очакваме ви в ${auth.garage.name} за смяна на масло, филтри и оглед.`,
          }
        : {
            subject: `${auth.garage.name} — Annual Oil & Filter Checkup`,
            body: `Hi ${recipientName}, it has been a while since ${vehicleText} visited ${auth.garage.name}. Schedule your annual oil, filter, and safety checkup today.`,
          };
    }
    return locale === "bg"
      ? {
          subject: `${auth.garage.name} — Безплатна сезонна диагностика`,
          body: `Здравейте, ${recipientName}! Като ценен клиент на ${auth.garage.name}, каним ви на преференциален сезонен преглед за ${vehicleText}.`,
        }
      : {
          subject: `${auth.garage.name} — Seasonal Inspection Invitation`,
          body: `Hi ${recipientName}, as a valued client of ${auth.garage.name}, we invite ${vehicleText} for a seasonal multipoint inspection & A/C check.`,
        };
  })();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const targetActionPath =
    campaignType === "quote_followup" && workOrder?.publicStatusToken
      ? `/status/${workOrder.publicStatusToken}`
      : `/garages/${auth.garage.slug}`;
  const bookingUrl = `${appUrl}${targetActionPath}`;

  const remRef = admin.adminDb.collection("reminders").doc();
  const channels: Array<"email" | "sms"> = [];
  if (toEmail) channels.push("email");
  if (toPhone) channels.push("sms");
  if (channels.length === 0) channels.push("email");

  const remDoc: Omit<Reminder, "id"> = {
    ownerId: effectiveOwnerId,
    garageId: auth.garage.id,
    vehicleId: workOrder?.vehicleId ?? null,
    workOrderId: workOrder?.id ?? null,
    recipientEmail: toEmail,
    recipientPhone: toPhone,
    recipientName,
    plateNumber: plate,
    type:
      campaignType === "tyre_swap" || campaignType === "tyre_replacement"
        ? "seasonal_tyres"
        : "custom_service",
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

  const deliveryTargetId =
    workOrder?.id ?? customer?.id ?? tyreSet?.id ?? remRef.id;
  const dispatchResult = await dispatchMultiChannelNotification({
    ownerId: effectiveOwnerId,
    garageId: auth.garage.id,
    reminderId: remRef.id,
    deliveryKey: `pro-winback:${deliveryTargetId}:${nowIso.slice(0, 10)}:${campaignType}`,
    channels,
    createInAppRecord: Boolean(effectiveOwnerId),
    consumeGarageQuota: true,
    payload: {
      toEmail,
      toPhone,
      recipientName,
      locale,
      subject: templateCopy.subject,
      textBody: `${templateCopy.body}\n\n${bookingUrl}`,
      htmlBody: `<p>${templateCopy.body}</p><p><a href="${bookingUrl}">${auth.garage.name}</a></p>`,
      actionUrl: targetActionPath,
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

