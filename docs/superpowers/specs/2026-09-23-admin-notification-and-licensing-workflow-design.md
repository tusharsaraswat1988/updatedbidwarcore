# BidWar Admin Notification & Licensing Workflow Design

- **Date:** 2026-09-23
- **Status:** Approved by User
- **Target Audience:** BidWar Super Admin & Tournament Organizers

---

## 1. Problem Statement & Executive Summary

The existing Admin Notification system in BidWar was passive and low-value:
- Stored static logs for only 3 events (`NEW_ORGANISER_REGISTERED`, `NEW_TOURNAMENT_CREATED`, `CONTACT_FORM_SUBMISSION`).
- Provided no interactive actions or resolution tracking. 2–3 month old informational logs remained stuck in the notification bell as unread items forever.
- No commercial or operational workflow existed for tournament organizers wanting to move from Free Trial to Live Auction / Scoring, nor was there a mechanism to verify manual payment before activating licenses.
- Super Admin had no dedicated triage separating actionable alerts (license requests, payment verifications, inquiries) from informational logs.

This design transforms the Admin Notification System into an **Action-Oriented Operations & Licensing Command Hub**:
1. **Organizers** can freely register and run trial tournaments. On tournament cards, they get a **"Need License"** button with a module-selection modal (*Auction*, *Scoring*, or *Both*).
2. **Super Admin** receives an immediate high-priority actionable notification.
3. Instead of direct auto-granting, Admin uses a **Controlled Payment Verification Flow**: Admin can 1-click WhatsApp the organizer with payment details, then open a **"Verify Payment & Grant License" modal** to record amount, UTR/payment mode, and confirm receipt before the tournament is activated for live use.
4. The Admin Notification Bell and Inbox gain **Resolution State Tracking** (`pending`, `resolved`, `dismissed`) and a 2-tab view (**Action Required** vs **Activity Feed**), ensuring stale logs never clutter the unread badge.
5. Home page inquiries and registrations gain direct communication links (WhatsApp/Email) and review/resolution states.

---

## 2. Architecture & Data Model

### 2.1 `admin_notifications` Table Schema Updates
We extend `admin_notifications` in `lib/db/src/schema/admin_notifications.ts`:

```typescript
// Additions to adminNotificationsTable:
resolutionStatus: text("resolution_status").notNull().default("pending"), // 'pending' | 'resolved' | 'dismissed'
resolvedAt: timestamp("resolved_at", { withTimezone: true }),
resolvedBy: text("resolved_by"), // Admin user email or identifier
actionMetadata: jsonb("action_metadata").$type<{
  licenseRequestId?: number;
  tournamentId?: number;
  organizerId?: number;
  organizerMobile?: string;
  organizerName?: string;
  tournamentName?: string;
  requestedModules?: "auction" | "scoring" | "both";
  paymentAmount?: number;
  paymentMode?: string;
  paymentRef?: string;
  inquiryEmail?: string;
  inquiryPhone?: string;
}>(),
```

### 2.2 `tournament_license_requests` Table
A dedicated table to track licensing requests and audit payment verification:

```typescript
export const tournamentLicenseRequestsTable = pgTable("tournament_license_requests", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournamentsTable.id, { onDelete: "cascade" }),
  organizerId: integer("organizer_id").notNull().references(() => organizersTable.id, { onDelete: "cascade" }),
  requestedModules: text("requested_modules").notNull().default("auction"), // 'auction' | 'scoring' | 'both'
  status: text("status").notNull().default("pending"), // 'pending' | 'granted' | 'rejected'
  organizerMobile: text("organizer_mobile"),
  notes: text("notes"),
  
  // Payment verification audit fields
  paymentVerified: boolean("payment_verified").notNull().default(false),
  paymentAmount: integer("payment_amount"),
  paymentMode: text("payment_mode"), // 'upi' | 'bank_transfer' | 'cash' | 'waiver' | 'other'
  paymentRef: text("payment_ref"), // UTR / Transaction reference
  verifiedBy: text("verified_by"), // Admin email / name
  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

---

## 3. Workflow & Interactions

### 3.1 Organizer Side: "Need License" Flow
1. **Discovery**: On the Organizer Portal (`/organizer-portal`), each tournament on Free Trial displays a **`[⚡ Need License / Go Live]`** button.
2. **If Already Requested**: The button switches to **`[⏳ License Requested · Awaiting Payment Verification]`** (disabled, preventing duplicate requests).
3. **Modal**: Clicking "Need License" opens the modal:
   - **Header**: Tournament Name, Sport Badge.
   - **Selection**:
     - 🔨 Auction License (Player auction purse, bidding, big screen LED)
     - 🎯 Sports Scoring License (Live match scoring, scorecards, fixtures)
     - ⚡ Both (Auction + Sports Scoring)
   - **Contact Phone**: Pre-filled with organizer's mobile, editable if they prefer another WhatsApp number.
   - **Optional Notes**: e.g., expected date, team count, custom query.
   - **Submission**: Sends `POST /api/tournaments/:id/license-request`.
   - **Feedback**: Immediate success toast with explanation that BidWar team will reach out via WhatsApp/Call for verification.

### 3.2 Super Admin Side: Notification & Controlled Payment Grant
1. **Trigger**: Backend generates a high-priority notification:
   - Event: `LICENSE_REQUESTED`
   - Category: `License`
   - Priority: `warning` (high-visibility amber/gold)
   - `resolutionStatus`: `pending`
   - Broadcasted instantly via SSE to active Super Admin sessions.
2. **Notification Bell Dropdown**:
   - **Tab 1: Action Required**: Shows pending License Requests and unhandled Contact Queries.
   - **Tab 2: Activity Feed**: Shows all registrations, tournaments, and resolved history.
3. **Actionable License Card**:
   - Displays Organizer Name, Phone, Tournament Name, Sport, and Requested Modules.
   - **Action 1: `[💬 WhatsApp Organiser]`**: Opens WhatsApp Web / App with a pre-filled message:
     ```
     Hi [Name], we received your license request for [Tournament Name] ([Sport]) on BidWar. Please share your payment screenshot or UTR here so we can activate your live license immediately.
     ```
   - **Action 2: `[Verify & Grant License]`**: Opens the **Payment Verification Modal**:
     - Shows Tournament & Organizer summary.
     - Toggle/Checkbox: *"I confirm that manual payment has been received & verified."*
     - Payment Mode dropdown: UPI / Bank Transfer / Cash / Admin Waiver / Other.
     - Amount (₹) input.
     - Transaction / UTR Ref input.
     - Primary Button: `[Confirm Payment & Activate License]`.
   - **Action 3: `[Decline / Dismiss]`**: Rejects request with optional reason.
4. **On Payment Confirmation**:
   - Updates `tournament_license_requests` status to `granted` with payment audit details.
   - Upgrades tournament license:
     - Sets tournament `licenseStatus` to `active` (Live Auction ready).
     - If `scoring` or `both` was requested, sets `scoringEnabled = true`.
   - Updates notification `resolutionStatus` to `resolved` and `actionMetadata.paymentRef`.
   - Card updates inline to a green badge: `License Granted & Verified ✓`.

### 3.3 Contact Inquiries & Informational Events
- **Homepage Contact Inquiries**:
  - Appears in "Action Required" tab.
  - Card shows Full Name, Email, Phone, Subject, and message preview.
  - Buttons: `[💬 WhatsApp]` (if phone provided), `[✉️ Email Reply]`, `[Mark Resolved]`.
- **New Organiser Registered & New Tournament Created**:
  - Informational cards with `[View Details]` and `[Mark Reviewed]`.
  - When marked reviewed, they leave the pending badge counter without being deleted from history.

---

## 4. API Endpoints Specification

### 4.1 Organizer Endpoints
- `GET /api/tournaments/:id/license-request`:
  - Returns current license request status for this tournament (`null` if none, or `{ id, requestedModules, status, createdAt }`).
- `POST /api/tournaments/:id/license-request`:
  - Body: `{ requestedModules: "auction" | "scoring" | "both", organizerMobile?: string, notes?: string }`.
  - Validates tournament belongs to organizer (or user is admin).
  - Inserts `tournament_license_requests` row.
  - Calls `sendAdminNotificationAsync("LICENSE_REQUESTED", payload)`.

### 4.2 Admin Endpoints
- `GET /api/auth/admin/admin-notifications`:
  - Query params: `page`, `limit`, `tab` (`action_required` | `activity`), `resolutionStatus` (`all` | `pending` | `resolved`), `type`, `search`.
  - Returns items, pendingCount, totalCount.
- `PATCH /api/auth/admin/admin-notifications/:id/resolve`:
  - Marks notification as `resolved` (records `resolvedAt`, `resolvedBy`).
- `POST /api/auth/admin/tournaments/:id/verify-and-grant-license`:
  - Body: `{ requestId: number, paymentAmount?: number, paymentMode: string, paymentRef?: string, notes?: string }`.
  - Verifies admin role.
  - In a DB transaction:
    1. Updates `tournament_license_requests` -> `status: 'granted'`, `paymentVerified: true`, audit fields.
    2. Updates `tournaments`: sets `licenseStatus = 'active'`, and `scoringEnabled = true` if applicable.
    3. Updates associated `admin_notifications` to `resolutionStatus: 'resolved'`.
    4. Emits live SSE update to sync admin dashboard.

---

## 5. UI/UX Specifications

### 5.1 Organizer Portal Card
- In `organizer-portal.tsx`, tournament cards in `trial` mode display:
  - If no pending request: A gradient button `[⚡ Need License]` with hover state.
  - If pending: A subtle badge `[⏳ License Requested · Pending Verification]`.
- Dialog `RequestTournamentLicenseModal`:
  - Clean dark theme matching BidWar styling.
  - Radio cards with icons for Auction, Scoring, and Both.
  - Phone confirmation input.
  - Optional note textarea.

### 5.2 Super Admin Notification Bell Dropdown
- **Header**:
  - Two segmented tabs: **Action Required (N)** | **Activity Feed**.
  - Quick action: "Mark all reviewed".
- **Cards**:
  - High-priority amber styling for pending license requests.
  - Direct action buttons (WhatsApp, Verify & Grant, Resolve).
- **Payment Verification Dialog**:
  - Admin modal with clear confirmation checklist before updating DB state.

### 5.3 Full Admin Notifications Page (`/admin/notifications`)
- Search and multi-criteria filtering (Resolution status, Event type, Date range).
- Bulk selection with batch "Mark Resolved" and "Delete".

---

## 6. Testing & Verification Plan

1. **Organizer Request Flow**:
   - Log in as Organizer, view a trial tournament.
   - Click "Need License", select "Both (Auction + Scoring)", fill note, submit.
   - Verify card switches to "License Requested · Pending Verification".
2. **Admin Notification Receipt**:
   - Check Admin header bell: Unread count increases, item appears in "Action Required" tab.
   - Verify WhatsApp button generates accurate `https://wa.me/` URI.
3. **Payment Verification & Controlled Grant**:
   - Click "Verify & Grant License" in Admin.
   - Fill in amount, mode (UPI), and transaction ref.
   - Confirm submission.
   - Verify tournament status updates to Active/Live in DB and UI.
   - Verify notification status becomes "Resolved" and unread count decrements.
4. **Contact Query Flow**:
   - Submit contact form from website.
   - Verify it appears in Admin "Action Required" with reply and resolve buttons.
