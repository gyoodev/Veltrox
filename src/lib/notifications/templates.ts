import type { AppLocale, ReminderType, VehicleDocumentType } from "@/types/domain";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapVeltroxHtml(params: {
  locale: AppLocale;
  badge: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): string {
  const safeBadge = escapeHtml(params.badge);
  const safeHeading = escapeHtml(params.heading);
  const bodyHtml = params.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#CBD5E1;font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`
    )
    .join("");

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<div style="margin:24px 0 8px;">
           <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#6366F1);color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;">
             ${escapeHtml(params.ctaLabel)}
           </a>
         </div>`
      : "";

  const footerNote =
    params.locale === "bg"
      ? "Изпратено от Veltrox — Дигитален автомобилен дневник и сервизна платформа."
      : "Sent by Veltrox — Digital Car Diary & Smart Garage Platform.";

  return `<!DOCTYPE html>
<html lang="${params.locale}">
  <body style="margin:0;padding:24px;background-color:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background-color:#111827;border:1px solid #1E293B;border-radius:16px;padding:28px;">
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:rgba(59,130,246,0.16);color:#60A5FA;font-size:12px;font-weight:600;margin-bottom:16px;">
        ${safeBadge}
      </div>
      <h1 style="margin:0 0 16px;color:#F8FAFC;font-size:20px;line-height:1.35;">
        ${safeHeading}
      </h1>
      ${bodyHtml}
      ${ctaHtml}
      <hr style="border:none;border-top:1px solid #1E293B;margin:24px 0 14px;" />
      <p style="margin:0;color:#64748B;font-size:12px;line-height:1.5;">
        ${escapeHtml(footerNote)}
      </p>
    </div>
  </body>
</html>`;
}

const REMINDER_TYPE_LABELS: Record<AppLocale, Record<ReminderType, string>> = {
  bg: {
    technical_inspection: "Годишен технически преглед (ГТП)",
    liability_insurance: "Гражданска отговорност",
    vignette: "Винетка",
    oil_change: "Смяна на масло и филтри",
    seasonal_tyres: "Сезонна смяна на гуми",
    custom_service: "Сервизно обслужване",
  },
  en: {
    technical_inspection: "Technical Inspection (MOT/GTP)",
    liability_insurance: "Liability Insurance",
    vignette: "Road Vignette",
    oil_change: "Oil & Filter Change",
    seasonal_tyres: "Seasonal Tyre Swap",
    custom_service: "Scheduled Service",
  },
};

const DOC_TYPE_LABELS: Record<AppLocale, Record<VehicleDocumentType, string>> = {
  bg: {
    insurance: "Застрахователна полица",
    registration: "Свидетелство за регистрация",
    vignette: "Електронна винетка",
    inspection: "Протокол за ГТП",
    invoice: "Сервизна фактура",
    other: "Автомобилен документ",
  },
  en: {
    insurance: "Insurance Policy",
    registration: "Registration Certificate",
    vignette: "Road Vignette",
    inspection: "Inspection Certificate",
    invoice: "Service Invoice",
    other: "Vehicle Document",
  },
};

export interface BuiltNotificationContent {
  subject: string;
  textBody: string;
  htmlBody: string;
}

export function buildReminderTemplate(params: {
  locale: AppLocale;
  recipientName?: string | null;
  title: string;
  type: ReminderType;
  plateNumber?: string | null;
  dueDate?: string | null;
  dueMileageKm?: number | null;
  garageName?: string | null;
  actionUrl: string;
}): BuiltNotificationContent {
  const { locale } = params;
  const typeLabel = REMINDER_TYPE_LABELS[locale][params.type];
  const platePart = params.plateNumber ? ` (${params.plateNumber})` : "";

  if (locale === "bg") {
    const greeting = params.recipientName
      ? `Здравейте, ${params.recipientName},`
      : "Здравейте,";
    const dueParts: string[] = [];
    if (params.dueDate) dueParts.push(`падеж: ${params.dueDate}`);
    if (params.dueMileageKm !== null && params.dueMileageKm !== undefined) {
      dueParts.push(`пробег: ${params.dueMileageKm.toLocaleString("bg-BG")} км`);
    }
    const dueLine =
      dueParts.length > 0
        ? `Напомняме Ви за предстоящо събитие (${dueParts.join(" • ")}).`
        : "Напомняме Ви за предстоящо сервизно обслужване.";
    const senderLine = params.garageName
      ? `Напомнянето е насрочено от сервиз „${params.garageName}“.`
      : "Напомнянето е активно във Вашия дигитален автомобилен дневник Veltrox.";

    const subject = `Напомняне${platePart}: ${params.title}`;
    const paragraphs = [greeting, `${typeLabel}: ${params.title}${platePart}`, dueLine, senderLine];

    return {
      subject,
      textBody: `${paragraphs.join("\n\n")}\n\nПреглед: ${params.actionUrl}`,
      htmlBody: wrapVeltroxHtml({
        locale,
        badge: typeLabel,
        heading: `${params.title}${platePart}`,
        paragraphs,
        ctaLabel: "Отвори във Veltrox",
        ctaUrl: params.actionUrl,
      }),
    };
  }

  const greeting = params.recipientName
    ? `Hello ${params.recipientName},`
    : "Hello,";
  const dueParts: string[] = [];
  if (params.dueDate) dueParts.push(`due date: ${params.dueDate}`);
  if (params.dueMileageKm !== null && params.dueMileageKm !== undefined) {
    dueParts.push(`target odometer: ${params.dueMileageKm.toLocaleString("en-US")} km`);
  }
  const dueLine =
    dueParts.length > 0
      ? `Your vehicle has an upcoming maintenance milestone (${dueParts.join(" • ")}).`
      : "Your vehicle has an upcoming scheduled maintenance reminder.";
  const senderLine = params.garageName
    ? `Scheduled by workshop "${params.garageName}".`
    : "Active in your Veltrox Digital Car Diary.";

  const subject = `Service Reminder${platePart}: ${params.title}`;
  const paragraphs = [greeting, `${typeLabel}: ${params.title}${platePart}`, dueLine, senderLine];

  return {
    subject,
    textBody: `${paragraphs.join("\n\n")}\n\nOpen Veltrox: ${params.actionUrl}`,
    htmlBody: wrapVeltroxHtml({
      locale,
      badge: typeLabel,
      heading: `${params.title}${platePart}`,
      paragraphs,
      ctaLabel: "Open in Veltrox",
      ctaUrl: params.actionUrl,
    }),
  };
}

export function buildDocumentExpiryTemplate(params: {
  locale: AppLocale;
  recipientName?: string | null;
  docTitle: string;
  docType: VehicleDocumentType;
  plateNumber?: string | null;
  expiryDate: string;
  daysRemaining: number;
  actionUrl: string;
}): BuiltNotificationContent {
  const { locale } = params;
  const docLabel = DOC_TYPE_LABELS[locale][params.docType];
  const platePart = params.plateNumber ? ` (${params.plateNumber})` : "";

  if (locale === "bg") {
    const timing =
      params.daysRemaining < 0
        ? `Документът е изтекъл на ${params.expiryDate}.`
        : params.daysRemaining === 0
          ? `Документът изтича днес (${params.expiryDate}).`
          : `Документът изтича след ${params.daysRemaining} дни (${params.expiryDate}).`;
    const subject = `Изтичащ документ${platePart}: ${params.docTitle}`;
    const paragraphs = [
      params.recipientName ? `Здравейте, ${params.recipientName},` : "Здравейте,",
      `${docLabel}: „${params.docTitle}“${platePart}`,
      timing,
    ];
    return {
      subject,
      textBody: `${paragraphs.join("\n\n")}\n\nДокументи: ${params.actionUrl}`,
      htmlBody: wrapVeltroxHtml({
        locale,
        badge: "Документен сейф",
        heading: `${params.docTitle}${platePart}`,
        paragraphs,
        ctaLabel: "Преглед на документите",
        ctaUrl: params.actionUrl,
      }),
    };
  }

  const timing =
    params.daysRemaining < 0
      ? `This document expired on ${params.expiryDate}.`
      : params.daysRemaining === 0
        ? `This document expires today (${params.expiryDate}).`
        : `This document expires in ${params.daysRemaining} day(s) (${params.expiryDate}).`;
  const subject = `Expiring Document${platePart}: ${params.docTitle}`;
  const paragraphs = [
    params.recipientName ? `Hello ${params.recipientName},` : "Hello,",
    `${docLabel}: "${params.docTitle}"${platePart}`,
    timing,
  ];
  return {
    subject,
    textBody: `${paragraphs.join("\n\n")}\n\nDocuments Vault: ${params.actionUrl}`,
    htmlBody: wrapVeltroxHtml({
      locale,
      badge: "Documents Vault",
      heading: `${params.docTitle}${platePart}`,
      paragraphs,
      ctaLabel: "Open Documents Vault",
      ctaUrl: params.actionUrl,
    }),
  };
}

export function buildGarageDecisionTemplate(params: {
  locale: AppLocale;
  recipientName?: string | null;
  decision: "approved" | "rejected";
  reason?: string | null;
  actionUrl: string;
}): BuiltNotificationContent {
  const { locale, decision } = params;

  if (locale === "bg") {
    if (decision === "approved") {
      const subject = "Вашият сервизен профил във Veltrox е одобрен";
      const paragraphs = [
        params.recipientName ? `Здравейте, ${params.recipientName},` : "Здравейте,",
        "Вашата регистрация като сервиз във Veltrox беше прегледана и одобрена.",
        "Вече можете да завършите настройката на сервиза си и да приемате работни поръчки.",
      ];
      return {
        subject,
        textBody: `${paragraphs.join("\n\n")}\n\nВход: ${params.actionUrl}`,
        htmlBody: wrapVeltroxHtml({
          locale,
          badge: "Одобрен сервиз",
          heading: subject,
          paragraphs,
          ctaLabel: "Отвори сервизния панел",
          ctaUrl: params.actionUrl,
        }),
      };
    }

    const subject = "Актуализация по заявката Ви за сервиз във Veltrox";
    const paragraphs = [
      params.recipientName ? `Здравейте, ${params.recipientName},` : "Здравейте,",
      "Заявката Ви за сервизен профил не беше одобрена на този етап.",
      ...(params.reason ? [`Причина: ${params.reason}`] : []),
    ];
    return {
      subject,
      textBody: `${paragraphs.join("\n\n")}\n\nПреглед: ${params.actionUrl}`,
      htmlBody: wrapVeltroxHtml({
        locale,
        badge: "Статус на заявка",
        heading: subject,
        paragraphs,
        ctaLabel: "Преглед на профила",
        ctaUrl: params.actionUrl,
      }),
    };
  }

  if (decision === "approved") {
    const subject = "Your Veltrox Garage Account is Approved";
    const paragraphs = [
      params.recipientName ? `Hello ${params.recipientName},` : "Hello,",
      "Your workshop registration on Veltrox has been verified and approved.",
      "You can now complete onboarding and start managing work orders by license plate.",
    ];
    return {
      subject,
      textBody: `${paragraphs.join("\n\n")}\n\nOpen workspace: ${params.actionUrl}`,
      htmlBody: wrapVeltroxHtml({
        locale,
        badge: "Approved Workshop",
        heading: subject,
        paragraphs,
        ctaLabel: "Launch Garage Workspace",
        ctaUrl: params.actionUrl,
      }),
    };
  }

  const subject = "Update on Your Veltrox Garage Application";
  const paragraphs = [
    params.recipientName ? `Hello ${params.recipientName},` : "Hello,",
    "Your workshop application was not approved at this stage.",
    ...(params.reason ? [`Reason: ${params.reason}`] : []),
  ];
  return {
    subject,
    textBody: `${paragraphs.join("\n\n")}\n\nView status: ${params.actionUrl}`,
    htmlBody: wrapVeltroxHtml({
      locale,
      badge: "Application Update",
      heading: subject,
      paragraphs,
      ctaLabel: "View Account Status",
      ctaUrl: params.actionUrl,
    }),
  };
}

