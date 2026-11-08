/**
 * Core Multi-Tenant Domain Types for Veltrox
 *
 * Tenant Isolation Invariants:
 * - Every user-owned document carries `ownerId: string`.
 * - Every garage-owned document carries `garageId: string`.
 * - Role & garage approval state live in Firebase Custom Claims AND are mirrored
 *   in `users/{uid}` for instant UI hydration and admin querying.
 */

export const USER_ROLES = ["USER", "GARAGE_OWNER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const REGISTRABLE_ROLES = ["USER", "GARAGE_OWNER"] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

export const GARAGE_APPROVAL_STATUSES = [
  "none",
  "pending",
  "approved",
  "rejected",
] as const;
export type GarageApprovalStatus = (typeof GARAGE_APPROVAL_STATUSES)[number];

export const STAFF_ROLES = ["mechanic", "receptionist"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const APP_LOCALES = ["bg", "en"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export interface NotificationPreferences {
  emailReminders: boolean;
  serviceUpdates: boolean;
  documentExpiryAlerts: boolean;
  marketingEmails: boolean;
  /** Ready for Phase 4 SMS/Viber provider abstraction */
  preferredChannel: "email" | "sms" | "viber";
}

/** Collection: `users/{uid}` */
export interface UserProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  /** Treated as GDPR personal data */
  phone: string | null;
  avatarUrl: string | null;
  avatarStoragePath: string | null;
  role: UserRole;
  garageStatus: GarageApprovalStatus;
  garageRejectionReason?: string | null;
  garageId?: string | null;
  /** True when this account is a limited-permission staff member under `garageId` */
  isStaff?: boolean;
  staffRole?: StaffRole | null;
  language: AppLocale;
  notificationPreferences: NotificationPreferences;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Signed Edge + Server Session Claims */
export interface SessionPayload {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  garageStatus: GarageApprovalStatus;
  garageId: string | null;
  exp: number;
}

export const DAYS_OF_WEEK = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export type WorkingHoursMap = Record<
  DayOfWeek,
  { open: string; close: string; closed: boolean }
>;

/** Collection: `garages/{garageId}` */
export interface Garage {
  id: string;
  ownerUid: string;
  name: string;
  slug: string;
  description?: string | null;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  logoStoragePath?: string | null;
  workingHours: WorkingHoursMap;
  servicesOffered: string[];
  plan: "free" | "pro";
  monthlyReminderQuota: number;
  monthlyRemindersUsed: number;
  quotaResetMonth?: string; // YYYY-MM
  status: "pending" | "approved" | "rejected" | "suspended";
  createdAt: string;
  updatedAt: string;
}

/** Collection: `garageStaff/{garageId_staffUid}` */
export interface GarageStaff {
  id: string;
  garageId: string;
  uid: string;
  email: string;
  displayName: string;
  staffRole: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const FUEL_TYPES = [
  "petrol",
  "diesel",
  "hybrid",
  "plug_in_hybrid",
  "electric",
  "lpg",
] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export interface PendingGarageLink {
  garageId: string;
  garageName: string;
  requestedAt: string;
}

export interface AttachmentItem {
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
}

/** Collection: `vehicles/{vehicleId}` — User-owned (`ownerId`) */
export interface Vehicle {
  id: string;
  ownerId: string;
  make: string;
  model: string;
  year: number;
  /** Treated as GDPR personal data */
  plateNumber: string;
  plateNormalized: string;
  vin: string | null;
  fuelType: FuelType;
  currentMileageKm: number;
  photoUrl: string | null;
  photoStoragePath: string | null;
  linkedGarageIds: string[];
  linkedGarageNames?: Record<string, string>;
  pendingGarageLinks?: PendingGarageLink[];
  createdAt: string;
  updatedAt: string;
}

export const DIARY_CATEGORIES = [
  "service",
  "repair",
  "fuel",
  "tyres",
  "inspection",
  "insurance",
  "note",
] as const;
export type DiaryCategory = (typeof DIARY_CATEGORIES)[number];

/** Collection: `diaryEntries/{entryId}` — User-owned (`ownerId`) */
export interface DiaryEntry {
  id: string;
  ownerId: string;
  vehicleId: string;
  garageId: string | null;
  garageName?: string | null;
  workOrderId: string | null;
  category: DiaryCategory;
  title: string;
  notes: string | null;
  date: string;
  mileageKm: number;
  costAmount: number;
  currency: "EUR" | "BGN";
  attachmentUrls: string[];
  attachments?: AttachmentItem[];
  createdAt: string;
  updatedAt?: string;
}

export const WORK_ORDER_STATUSES = [
  "received",
  "diagnosing",
  "waiting_parts",
  "in_progress",
  "ready",
  "completed",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

/** Collection: `workOrders/{workOrderId}` — Garage-owned (`garageId`) */
export interface WorkOrder {
  id: string;
  garageId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  linkedOwnerId: string | null;
  vehicleId: string | null;
  plateNumber: string;
  plateNormalized: string;
  vehicleLabel: string;
  mileageKm: number | null;
  status: WorkOrderStatus;
  publicStatusToken: string;
  dropOffPhotoUrls: string[];
  dropOffPhotos?: AttachmentItem[];
  internalNotes: string | null;
  customerSummary: string | null;
  totalLaborAmount: number;
  totalPartsAmount: number;
  totalAmount: number;
  currency: "EUR" | "BGN";
  nextServiceDate: string | null;
  nextServiceMileageKm: number | null;
  reminderId?: string | null;
  syncedDiaryEntryId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Collection: `workOrderPublicStatus/{publicToken}`
 * Strictly whitelisted public projection (no login).
 * NEVER contains customer name, phone, email, VIN, raw plate, or internal mechanic notes.
 */
export interface WorkOrderPublicStatus {
  token: string;
  workOrderId: string;
  garageName: string;
  garageSlug: string;
  garagePhone: string;
  garageAddress: string;
  garageCity: string;
  garageLogoUrl: string | null;
  maskedPlate: string;
  vehicleLabel: string;
  mileageKm: number | null;
  status: WorkOrderStatus;
  customerSummary: string | null;
  lineItems: Array<{
    id: string;
    type: "labor" | "part";
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalLaborAmount: number;
  totalPartsAmount: number;
  totalAmount: number;
  currency: "EUR" | "BGN";
  dropOffPhotoUrls: string[];
  nextServiceDate: string | null;
  nextServiceMileageKm: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Collection: `workOrderItems/{itemId}` — Garage-owned (`garageId`) */
export interface WorkOrderItem {
  id: string;
  garageId: string;
  workOrderId: string;
  linkedOwnerId: string | null;
  type: "labor" | "part";
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt?: string;
}

/** Collection: `customers/{customerId}` — Garage-owned (`garageId`) */
export interface Customer {
  id: string;
  garageId: string;
  linkedOwnerId: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  plateNumbers: string[];
  platesNormalized?: string[];
  notes: string | null;
  lastVisitAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const TYRE_SEASONS = ["winter", "summer", "all_season"] as const;
export type TyreSeason = (typeof TYRE_SEASONS)[number];

export const TYRE_STORAGE_STATUSES = [
  "stored",
  "mounted_on_car",
  "returned",
] as const;
export type TyreStorageStatus = (typeof TYRE_STORAGE_STATUSES)[number];

/** Collection: `tyreSets/{tyreSetId}` — Garage-owned (`garageId`) */
export interface TyreSet {
  id: string;
  garageId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  plateNumber: string;
  plateNormalized: string;
  brandModel: string;
  sizeSpec: string;
  season: TyreSeason;
  quantity: number;
  withRims: boolean;
  treadDepthMm: number | null;
  shelfLocation: string;
  status: TyreStorageStatus;
  seasonalReminderDate: string | null;
  reminderId?: string | null;
  notes: string | null;
  storedAt: string;
  updatedAt: string;
}

export const COMPLIANCE_REMINDER_TYPES = [
  "liability_insurance",
  "vignette",
  "technical_inspection",
  "casco",
  "fire_extinguisher",
  "vehicle_tax",
] as const;
export type ComplianceReminderType = (typeof COMPLIANCE_REMINDER_TYPES)[number];

export const REMINDER_TYPES = [
  "liability_insurance",
  "vignette",
  "technical_inspection",
  "casco",
  "fire_extinguisher",
  "vehicle_tax",
  "oil_change",
  "seasonal_tyres",
  "custom_service",
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

/** Collection: `reminders/{reminderId}` — Carries `ownerId` and/or `garageId` */
export interface Reminder {
  id: string;
  ownerId: string | null;
  garageId: string | null;
  vehicleId: string | null;
  workOrderId: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  plateNumber?: string | null;
  type: ReminderType;
  title: string;
  notes?: string | null;
  dueDate: string | null;
  dueMileageKm: number | null;
  channels: Array<"email" | "sms" | "viber">;
  status: "scheduled" | "sent" | "completed" | "cancelled";
  sentAt?: string | null;
  lastError?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** Collection: `appointments/{appointmentId}` — Carries `garageId` + optional `ownerId` */
export interface Appointment {
  id: string;
  garageId: string;
  garageName?: string;
  ownerId: string | null;
  vehicleId?: string | null;
  workOrderId?: string | null;
  customerName: string;
  customerPhone: string;
  plateNumber: string;
  serviceRequested: string;
  notes?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
  updatedAt?: string;
}

export const DOCUMENT_TYPES = [
  "insurance",
  "casco",
  "vignette",
  "inspection",
  "fire_extinguisher",
  "vehicle_tax",
  "registration",
  "invoice",
  "other",
] as const;
export type VehicleDocumentType = (typeof DOCUMENT_TYPES)[number];

/** Collection: `documents/{documentId}` — User-owned (`ownerId`) */
export interface VehicleDocument {
  id: string;
  ownerId: string;
  vehicleId: string;
  docType: VehicleDocumentType;
  title: string;
  fileName?: string;
  contentType?: string;
  fileUrl: string;
  storagePath: string;
  expiryDate: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** Collection: `notifications/{notificationId}` */
export interface AppNotification {
  id: string;
  ownerId: string | null;
  garageId: string | null;
  reminderId?: string | null;
  documentId?: string | null;
  actionUrl?: string | null;
  channel: "email" | "sms" | "viber" | "in_app";
  subject: string;
  body: string;
  status: "queued" | "sent" | "failed" | "read";
  deliveryKey?: string | null;
  provider?: string | null;
  simulated?: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PlatformFaqItem {
  id: string;
  questionBg: string;
  answerBg: string;
  questionEn: string;
  answerEn: string;
  order: number;
}

export interface AnnouncementBanner {
  enabled: boolean;
  variant: "info" | "warning" | "success";
  messageBg: string;
  messageEn: string;
  linkUrl: string | null;
  linkLabelBg: string | null;
  linkLabelEn: string | null;
}

/** Collection: `platformConfig/public` */
export interface PlatformContentConfig {
  banner: AnnouncementBanner;
  faqs: PlatformFaqItem[];
  updatedAt: string;
  updatedByUid: string | null;
}

export const AUDIT_LOG_ACTIONS = [
  "USER_REGISTERED",
  "USER_ROLE_CHANGED",
  "USER_ROLE_PROMOTED_TO_ADMIN",
  "GARAGE_ONBOARDED",
  "GARAGE_APPROVED",
  "GARAGE_REJECTED",
  "GARAGE_PLAN_UPDATED",
  "GARAGE_STAFF_ADDED",
  "GARAGE_STAFF_REMOVED",
  "USER_SUSPENDED",
  "USER_UNSUSPENDED",
  "CONTENT_UPDATED",
  "REMINDER_ENGINE_RUN",
  "GDPR_ACCOUNT_DELETED",
  "GDPR_DATA_EXPORTED",
] as const;
export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[number];

/** Collection: `auditLogs/{logId}` — Admin-readable immutable log */
export interface AuditLog {
  id: string;
  action: AuditLogAction;
  actorUid: string;
  actorRole: UserRole | "SYSTEM";
  targetUid: string | null;
  targetGarageId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}
