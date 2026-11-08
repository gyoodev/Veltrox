# Veltrox

**Dual-Sided Digital Car Diary & Smart Garage Operations Platform**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5_(App_Router)-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7_(Strict)-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%7C_Firestore_%7C_Storage-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![i18n](https://img.shields.io/badge/i18n-BG_(default)_%7C_EN-10B981)](#localization-i18n)
[![License: MIT](https://img.shields.io/badge/License-MIT-3B82F6.svg)](./LICENSE)

Veltrox connects **car owners** and **independent automotive workshops** in one unified workflow—eliminating paper service books, lost receipts, status phone calls, and missed maintenance intervals.

---

## Table of Contents

- [Platform Roles & Capabilities](#platform-roles--capabilities)
- [Roadmap & Phase Status](#roadmap--phase-status)
- [Tech Stack & Design System](#tech-stack--design-system)
- [Architecture & Project Structure](#architecture--project-structure)
- [Security, RBAC & GDPR Posture](#security-rbac--gdpr-posture)
- [Local Development Setup](#local-development-setup)
- [Administrative CLI Scripts](#administrative-cli-scripts)
- [Quality Gates & Verification](#quality-gates--verification)
- [Production Deployment (Vercel + Firebase)](#production-deployment-vercel--firebase)
- [License](#license)

---

## Platform Roles & Capabilities

### 1. Car Owners (`USER` — `/app/*`)
- **Multi-Vehicle Digital Garage**: Track cars by make, model, year, VIN, fuel type, transmission, license plate, current odometer, and cover photo.
- **Chronological Service & Fuel Diary**: Log maintenance, repairs, fuel fill-ups (with automatic `L/100 km` consumption calculation), inspections, tyre swaps, insurance, taxes, and tuning—complete with image/PDF invoice uploads.
- **Expense Analytics**: Interactive Recharts breakdowns by category, monthly spend trends, cost-per-kilometer metrics, and vehicle comparisons in `EUR` / `BGN`.
- **Smart Reminders**: Due-date and target-mileage reminders with visual status badges (`ok`, `upcoming`, `overdue`).
- **Documents Vault**: Store insurance policies, vignettes, technical inspections (GTP), tax receipts, and driving licenses with expiry countdown alerts.
- **Printable PDF Service Book**: Cyrillic-safe, print-optimized vehicle history dossier (`/app/cars/[vehicleId]/service-book`) ready for resale buyers.
- **Public Garage Directory & Online Booking**: Browse verified workshops by city and specialty (`/garages`, `/garages/[slug]`), submit online appointment requests, and receive automatic service diary entries from linked garages.

### 2. Garages & Workshop Staff (`GARAGE_OWNER` — `/garage/*`)
- **Approval-Gated Onboarding Wizard**: Newly registered garages start in `pending` state until verified, then complete a guided setup for business profile, city, services catalog, working hours, logo, and public directory slug.
- **License-Plate-First Customer Lookup**: Instant search by normalized license plate, phone, or customer name with complete cross-visit repair history and car-owner diary opt-in linking.
- **Sub-30-Second Mobile-First Work Orders**: Rapid intake on phone or tablet with live workflow stages (`received` → `diagnosing` → `waiting_parts` → `in_progress` → `ready` → `completed`), itemized parts/labor lines, mechanic assignment, and automatic diary sync upon completion.
- **Zero-Login Public Repair Status Link (`/status/[token]`)**: Shareable status tracker powered by a whitelisted Firestore projection (`workOrderPublicStatus`) with masked license plates (`CB **** AB`) and zero exposed PII.
- **Appointments Calendar**: Day and week schedule views for walk-in bookings and online requests (`requested`, `confirmed`, `completed`, `cancelled`) with 1-click conversion into an active Work Order.
- **Workshop Staff RBAC**: Invite `mechanic` and `receptionist` accounts scoped to the garage via Firebase Custom Claims while restricting billing/settings, staff management, CSV exports, and destructive deletes to the garage owner.
- **Seasonal Tyre Hotel**: Track stored customer tyre sets (`summer`, `winter`, `all_season`) with warehouse/rack/shelf coordinates, tread depth (`mm`), condition notes, and check-in/mounted status.
- **Plan Quotas & CSV Exports**: Built-in monthly reminder quota tracking (`Free`: 50/mo, `Pro`: 500/mo) and UTF-8 CSV exports for work orders and customers.

### 3. Platform Administrators (`ADMIN` — `/admin/*`)
- **Non-Self-Assignable Governance Role**: `ADMIN` cannot be chosen during sign-up under any circumstance; accounts are promoted exclusively via server-side Admin SDK tooling and audited in immutable `auditLogs`.
- **Garage Verification Queue (`/admin/approvals`)**: Review pending workshop applications, approve in 1 click, or reject with an explanatory reason synced to Custom Claims and notifications.
- **Users & Garages Governance (`/admin/users`)**: Search accounts, change roles, suspend/unsuspend abusive accounts (with token revocation), and switch workshops between `Free` (`50/mo`) and `Pro` (`500/mo`) reminder plans.
- **System & Subscription Analytics (`/admin/analytics`)**: Real Firestore counts, 6-month growth charts, `Free` vs. `Pro` MRR/ARR breakdown, reminder telemetry, and 1-click manual Reminder Sweep execution.
- **Live Bilingual CMS (`/admin/content`) & Audit Trail (`/admin/audit-logs`)**: Publish bilingual (`BG`/`EN`) announcement banners and dynamic landing-page FAQs, and inspect filterable immutable security audit logs.

---

## Roadmap & Phase Status

| Phase | Milestone | Status |
| :--- | :--- | :--- |
| **Phase 1** | Foundation, design system, marketing landing page, 3-role Firebase Auth, Edge + Server route guards, GDPR profile & data export/erasure, base Firestore & Storage rules | **Complete** |
| **Phase 2** | **Car Owner (`USER`)** — vehicles CRUD, chronological diary & receipts, Recharts expense analytics, documents vault, reminders, printable PDF service book, public garage directory & booking | **Complete** |
| **Phase 3** | **Garage (`GARAGE_OWNER` & Staff)** — onboarding wizard, plate lookup & customer CRM, sub-30s work orders, `/status/[token]` public tracker, calendar, staff RBAC, Tyre Hotel, CSV exports | **Complete** |
| **Phase 4** | **Reminder Engine & Notifications** — Firebase Cloud Functions v2 daily scheduler (`functions/`) + Vercel Cron (`/api/cron/reminders`), provider abstraction (Email live via Resend HTTP + SMS/Viber mock providers), and workspace Notification Bell | **Complete** |
| **Phase 5** | **Analytics Dashboards** — `GARAGE_OWNER` (`/garage/analytics` revenue, status breakdown, avg ticket, retention, top services, 1-click overdue outreach, reminder conversion rate) + `ADMIN` (`/admin/analytics`) | **Complete** |
| **Phase 6** | **Admin Panel, CMS & Polish** — `/admin/approvals`, `/admin/users`, `/admin/content` (bilingual banner & dynamic FAQs + `FAQPage` JSON-LD), `/admin/audit-logs`, WCAG AA skip-links & ARIA polish | **Complete** |

---

## Tech Stack & Design System

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js `15.5` (App Router, React 19, Server Components + Route Handlers) |
| **Language** | TypeScript `5.7` (`strict: true`, `noUncheckedIndexedAccess: true`) |
| **Styling & UI** | Tailwind CSS `3.4`, `shadcn/ui`, Radix UI Primitives, `lucide-react`, `next-themes` |
| **Motion & Charts** | Framer Motion `12` (`reducedMotion="user"`), Recharts `2.15` |
| **Forms & Schemas** | `react-hook-form` + `@hookform/resolvers` + shared client/server `Zod` validators |
| **Backend & Auth** | Firebase Auth (Email/Password + Google), Cloud Firestore, Firebase Storage, `firebase-admin` |
| **Localization (`i18n`)** | `next-intl` — Bulgarian (`bg`, default) & English (`en`) with full key parity |

### Visual Tokens
- **Theme**: Precision automotive dark-mode default (`#0A0E1A` canvas, `#111827` elevated surfaces, `#3B82F6` cobalt primary, `#10B981` emerald status, `#F59E0B` amber warning, `#EF4444` danger) with full light-mode parity.
- **Typography**: `Plus Jakarta Sans` (headings), `Inter` (body, full Cyrillic + Latin coverage), and `JetBrains Mono` with `tabular-nums` for license plates, VINs, odometers, and currency amounts.

---

## Architecture & Project Structure

```text
Veltrox/
├── functions/                     # Firebase Cloud Functions v2 daily reminder scheduler
│   ├── src/index.ts               # onSchedule("every day 07:00", Europe/Sofia) sweep
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   ├── approve-garage.ts          # CLI: Approve a pending GARAGE_OWNER + sync claims & audit log
│   ├── import-service-account.mjs # CLI: Safely import Firebase Admin JSON into Git-ignored .env.local
│   └── set-admin.ts               # CLI: Bootstrap or promote an existing user to ADMIN
├── src/
│   ├── app/
│   │   ├── (auth)/                # /login, /register, /forgot-password, /verify-email
│   │   ├── (legal)/               # /privacy, /terms (GDPR & platform terms)
│   │   ├── admin/                 # ADMIN governance (/approvals, /users, /analytics, /content, /audit-logs)
│   │   ├── api/                   # REST Route Handlers (auth, user, diary, garage, admin, notifications, cron)
│   │   ├── app/                   # Car Owner workspace (/app/cars, /expenses, /reminders, /documents)
│   │   ├── garage/                # Garage & Staff workspace (/work-orders, /customers, /tyres, /analytics...)
│   │   ├── garages/               # Public SEO garage directory (/garages, /garages/[slug])
│   │   └── status/[token]/        # Public zero-login repair status tracker (noindex, whitelisted fields)
│   ├── components/
│   │   ├── admin/                 # Approvals queue, user governance, analytics, CMS editor, audit viewer
│   │   ├── car-diary/             # Vehicle cards, timeline dialogs, Recharts analytics, service book print
│   │   ├── garage/                # Onboarding wizard, quick work order modal, Kanban/board, analytics, Tyre Hotel
│   │   ├── layout/                # Role-aware DashboardShell & mobile navigation
│   │   ├── marketing/             # Landing page sections, navbar, interactive Demo-labeled preview
│   │   ├── profile/               # Profile settings, notification prefs, GDPR export & account deletion
│   │   ├── shared/                # Logo, NotificationBell, AnnouncementBanner, BG/EN switcher, GDPR consent
│   │   └── ui/                    # Reusable shadcn/ui & Radix primitives
│   ├── i18n/                      # next-intl locale config & server request resolver
│   ├── lib/
│   │   ├── auth/                  # Edge HMAC session signer (edge-session.ts) & Admin guards (server-auth.ts)
│   │   ├── data/                  # Server Firestore loaders (user-diary.ts, garage.ts, admin.ts, platform-cms.ts)
│   │   ├── firebase/              # Client SDK (consent-gated analytics) & Admin SDK singleton
│   │   ├── notifications/         # Provider abstraction (Email live + SMS/Viber mocks), templates, sweep engine
│   │   ├── validators/            # Shared Zod schemas (auth, profile, car-diary, garage, admin, entities)
│   │   ├── analytics-metrics.ts   # Garage revenue/retention/conversion & Admin platform analytics engine
│   │   ├── diary-metrics.ts       # Fuel L/100km, cost/km, category totals & reminder urgency helpers
│   │   └── garage-utils.ts        # Plate normalization/masking, slugifier, token generator, CSV serializer
│   ├── messages/                  # bg.json (default) & en.json translation catalogs
│   ├── types/domain.ts            # Strict TypeScript interfaces for all Firestore collections
│   └── middleware.ts              # Edge route protection & role/status redirects
├── firebase.json                  # Firebase CLI config (Firestore, Storage, Cloud Functions v2)
├── firestore.indexes.json         # Production composite indexes for multi-tenant queries
├── firestore.rules                # Default-deny RBAC & field-whitelisted Firestore security rules
├── storage.rules                  # Path-scoped MIME & size-limited Storage security rules
└── vercel.json                    # Daily Vercel Cron schedule -> /api/cron/reminders
```

### Dual-Cookie Session & RBAC Flow
1. User authenticates on the client with Firebase Auth (`Email/Password` or `Google`).
2. `POST /api/auth/session` verifies the Firebase ID token via `firebase-admin`, syncs Firestore profile + Custom Claims (`role`, `garageStatus`, `garageId`, `isStaff`, `staffRole`), and issues two `HttpOnly`, `SameSite=Lax` cookies:
   - `FB_SESSION_COOKIE`: Verified by Node Server Components and API Route Handlers via `adminAuth.verifySessionCookie(...)`.
   - `EDGE_SESSION_COOKIE`: HMAC-SHA256 signed payload verified in Web-Crypto-compatible `src/middleware.ts` for zero-latency Edge routing:
     - `/app/*` → `USER` only
     - `/garage/*` → `GARAGE_OWNER` (redirects `pending`/`rejected` owners to approval status view, and approved un-onboarded owners to `/garage/onboarding`)
     - `/admin/*` → `ADMIN` only

### Firestore Collections
| Collection | Purpose |
| :--- | :--- |
| `users` | Account profile, role (`USER`, `GARAGE_OWNER`, `ADMIN`), `garageStatus`, notification preferences |
| `garages` | Public & operational workshop profile, slug, city, working hours, plan (`free`/`pro`), reminder quota |
| `garageStaff` | Workshop staff memberships (`mechanic`, `receptionist`) mapped to `garageId` |
| `vehicles` | Car owner vehicles, VIN, plate, odometer, fuel type |
| `diaryEntries` | Maintenance, repair, fuel, inspection, and expense entries (including garage-synced records) |
| `documents` | Vehicle & driver document metadata, Storage attachment paths, and expiry dates |
| `reminders` | Date/mileage reminders created by car owners or scheduled by garages |
| `customers` | Garage-scoped customer & vehicle plate CRM records with optional linked `vehicleId` |
| `workOrders` | Workshop repair orders, internal mechanic notes, totals, and status lifecycle |
| `workOrderItems` | Itemized labor and parts lines associated with a `WorkOrder` |
| `workOrderPublicStatus` | **GDPR-safe public projection** keyed by unguessable `publicToken` (masked plate, status, line items—no PII) |
| `appointments` | Workshop calendar bookings and car-owner online appointment requests |
| `tyreSets` | Seasonal Tyre Hotel sets, rack/shelf locations, tread depth, and storage status |
| `notifications` | Multi-channel & in-app notification records (`email`, `sms`, `viber`, `in_app`) |
| `platformConfig` | Public bilingual CMS config (`platformConfig/public` — announcement banner & dynamic FAQs) |
| `auditLogs` | Append-only, immutable security and administrative audit records |

---

## Security, RBAC & GDPR Posture

- **Zero Hardcoded Secrets**: All keys live in Git-ignored `.env.local` or deployment environment secrets.
- **Defense-in-Depth Authorization**: Enforced across Next.js Edge Middleware, server-side API guards (`resolveGarageApiAuth`, `requireRole`), `firestore.rules`, and `storage.rules`.
- **PII Protection for License Plates & Phones**: Public tracking links (`/status/[token]`) carry `robots: noindex, nofollow`, disallow crawling in `robots.ts`, mask license plates (`CB **** AB`), and never read the private `workOrders` document directly.
- **Consent-Gated Analytics**: Firebase Analytics initializes only after explicit opt-in via the GDPR cookie banner (`src/components/shared/cookie-consent.tsx`).
- **Right to Data Portability & Erasure**: Every user can download a full machine-readable JSON archive (`GET /api/user/export`) or permanently erase their account, Storage files, vehicles, and owned garage records (`DELETE /api/user/account`).
- **Strict Upload Limits**: Client validators and `storage.rules` enforce image/PDF MIME whitelists and size caps (`<= 5 MB` for avatars, `<= 10 MB` for vehicle documents and garage assets).

---

## Local Development Setup

### Prerequisites
- **Node.js** `>= 20.x` and **npm** `>= 10.x`
- A **Firebase project** (configured by default in `.firebaserc` for `veltrox-gkdev`, or point to your own project) with:
  - **Authentication**: `Email/Password` and `Google` providers enabled
  - **Cloud Firestore**: Database created in production mode
  - **Storage**: Default bucket initialized

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create `.env.local` from the template:
```bash
cp .env.example .env.local
```
Populate your Firebase Web SDK values (`NEXT_PUBLIC_FIREBASE_*`) and generate a random `SESSION_SECRET` (at least 32 characters, e.g. `openssl rand -hex 32`).

To populate the **Firebase Admin SDK** credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) without manual newline escaping errors, run the built-in importer against your downloaded Service Account JSON key:
```bash
npm run import-admin-key -- "C:\path\to\your-firebase-adminsdk.json"
```
*(Keep the JSON key outside the repository or ensure it matches `.gitignore`—never commit service account keys.)*

### 3. Deploy Firestore Rules, Indexes & Storage Rules
```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

### 4. Start the Development Server
```bash
npm run dev
```
Open `http://localhost:3000`.

---

## Administrative CLI Scripts

Because privileged transitions are intentionally blocked from public self-registration, Veltrox includes dedicated Admin SDK scripts in `scripts/`:

| Command | Description |
| :--- | :--- |
| `npm run import-admin-key -- "<path-to-json>"` | Safely formats and writes `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` into `.env.local`. |
| `npm run set-admin -- <email-or-uid>` | Promotes an existing user to `ADMIN`, updates Firebase Custom Claims + `users/{uid}`, and writes a `USER_ROLE_PROMOTED_TO_ADMIN` audit log. |
| `npm run approve-garage -- <email-or-uid>` | Approves a pending `GARAGE_OWNER` account (`garageStatus: "approved"`), syncs Custom Claims, and writes a `GARAGE_APPROVED` audit log so the owner can enter `/garage/onboarding`. |

> **Note**: After running `set-admin` or `approve-garage`, sign out and sign back in inside the browser so your session cookies pick up the updated Firebase Custom Claims immediately.

---

## Quality Gates & Verification

Run the full verification suite before committing or deploying:

```bash
# Strict TypeScript compiler check (strict + noUncheckedIndexedAccess)
npm run typecheck

# Next.js & ESLint static analysis
npm run lint

# Production App Router build check
npm run build
```

### Localization (`i18n`)
All user-facing copy lives in `src/messages/bg.json` (Bulgarian default) and `src/messages/en.json` (English). When adding new UI strings, always add matching keys to **both** message catalogs to preserve 100% translation parity.

---

## Production Deployment (Vercel + Firebase)

1. **Deploy Firebase Security, Indexes & Scheduled Functions**:
   ```bash
   npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
   # Optional (Blaze plan): deploy Cloud Functions v2 daily reminder scheduler
   cd functions && npm install && npm run build && cd ..
   npx firebase-tools deploy --only functions
   ```
2. **Import Project into Vercel**:
   - Connect the GitHub repository in Vercel (`vercel.json` automatically registers the daily `/api/cron/reminders` job).
   - Add every variable from `.env.example` under **Project Settings → Environment Variables**:
     - `NEXT_PUBLIC_APP_URL` = your production `https://...` URL
     - `NEXT_PUBLIC_FIREBASE_*` = Firebase Web App config
     - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` = Firebase Service Account credentials
     - `SESSION_SECRET` = strong 32+ byte random secret
     - `CRON_SECRET` = random secret (`>= 16` chars) used to authenticate Vercel Cron requests
     - `RESEND_API_KEY` & `NOTIFICATION_FROM_EMAIL` = live transactional email delivery credentials
3. **Authorize Production Domain in Firebase**:
   - Go to **Firebase Console → Authentication → Settings → Authorized domains** and add your Vercel production domain.

---

## License

Distributed under the **MIT License**. See [LICENSE](./LICENSE) for full details.

Copyright © 2026 Gyuray (`GyooDev`).
