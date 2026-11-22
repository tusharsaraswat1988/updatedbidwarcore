# BidWar Notification Engine

Centralized notification service for Email, SMS, and WhatsApp with full audit history.

## Architecture

```
Business routes (auth, tournaments, …)
        │
        ▼ notifyAsync()  — fire-and-forget, never throws
NotificationService
        ├── EmailProvider    → Resend API
        ├── SMSProvider      → existing comm-sender (BulkSMS)
        └── WhatsAppProvider → existing comm-sender (Twilio)
        │
        ▼
notification_logs table (dedup + audit)
```

### Key files

| Layer | Path |
|-------|------|
| Schema | `lib/db/src/schema/notifications.ts` |
| Service | `artifacts/api-server/src/lib/notifications/notification-service.ts` |
| Email provider | `artifacts/api-server/src/lib/notifications/providers/email-provider.ts` |
| SMS provider | `artifacts/api-server/src/lib/notifications/providers/sms-provider.ts` |
| WhatsApp provider | `artifacts/api-server/src/lib/notifications/providers/whatsapp-provider.ts` |
| Email templates | `artifacts/api-server/src/lib/notifications/templates/` |
| API routes | `artifacts/api-server/src/routes/notifications.ts` |
| Admin UI | `artifacts/auction-platform/src/pages/admin-notification-center.tsx` |

### Event types

| Event | Channels (current) | Trigger |
|-------|-------------------|---------|
| `ORGANISER_REGISTERED` | Email | Organizer signup (email, OTP, Google) |
| `TOURNAMENT_CREATED` | Email | `POST /api/tournaments`, `POST /api/auth/admin/tournaments` |

Reserved for future wiring (types defined, no channel map yet):

`TOURNAMENT_APPROVED`, `TEAM_OWNER_REGISTERED`, `OWNER_CREDENTIALS_SENT`, `OWNER_CREDENTIALS_RESET`, `AUCTION_STARTED`, `AUCTION_COMPLETED`, `POST_AUCTION_REPORT`

### Adding a new email template

1. Create `artifacts/api-server/src/lib/notifications/templates/my-event.ts` using `wrapEmailLayout()`.
2. Register it in `templates/registry.ts`.
3. Add the event to `EVENT_CHANNEL_MAP` in `notification-service.ts`.
4. Call `notifyAsync("MY_EVENT", payload)` from the business route.

No changes to providers or API routes are required.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_ENABLED` | No | Set `true` to send real emails. Default: stub mode (logged only). |
| `RESEND_API_KEY` | When email enabled | Resend API key from [resend.com](https://resend.com) |
| `MAIL_FROM` | When email enabled | Verified sender, e.g. `BidWar <notifications@bidwar.in>` |
| `APP_URL` | No | Base URL for email CTA links. Defaults to `APP_PUBLIC_SCHEME` + `APP_DOMAIN`. |

Existing SMS/WhatsApp env vars are unchanged (`BULKSMS_*`, `TWILIO_*`).

## Deployment

### 1. Apply database schema

```bash
pnpm --filter @workspace/db push
```

This creates the `notification_logs` table with indexes and a unique `dedup_key` constraint.

### 2. Configure Resend

1. Create a Resend account and verify your sending domain.
2. Add DNS records (SPF, DKIM) as instructed by Resend.
3. Set environment variables on your host:

```
EMAIL_ENABLED=true
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM=BidWar <notifications@yourdomain.com>
APP_URL=https://bidwar.in
```

### 3. Build and deploy

```bash
pnpm install --frozen-lockfile
pnpm run build
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

On Render, set the env vars in the dashboard and redeploy. No new services are required — notifications run in-process asynchronously.

### 4. Verify admin UI

Open `/admin/settings/notifications` after logging in as Super Admin.

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/admin/notifications` | Admin | List logs with filters (`eventType`, `channel`, `status`, `tournamentId`, `limit`, `offset`) |
| `GET` | `/api/auth/admin/notifications/meta` | Admin | Filter option metadata |
| `POST` | `/api/auth/admin/notifications/:id/resend` | Admin | Resend a notification (creates new audit entry) |

## Duplicate prevention

Each automatic send uses a dedup key: `{EVENT}:{entity}:{channel}` (e.g. `ORGANISER_REGISTERED:organizer:42:email`).

If the same event fires twice, the second attempt is skipped and logged at debug level. Admin **Resend** bypasses dedup and creates a separate audit entry.

## Testing

### Local development (stub mode)

Without `EMAIL_ENABLED`, emails are logged as sent with `stub: true` in `provider_response`. No Resend account needed.

```bash
# Terminal 1 — API
pnpm --filter @workspace/api-server dev

# Terminal 2 — Frontend
pnpm --filter @workspace/auction-platform dev
```

### Manual test: organiser welcome email

1. Register a new organiser with a real email address.
2. Open `/admin/settings/notifications`.
3. Confirm a `ORGANISER_REGISTERED` / `email` / `sent` entry appears.

### Manual test: tournament created email

1. Create a tournament with an organiser email set.
2. Check Notification Center for `TOURNAMENT_CREATED` entry.

### Manual test: duplicate prevention

1. Re-trigger the same signup path for an existing organiser (should 409).
2. Or call `notifyAsync` twice in a test — only one log row per dedup key.

### Manual test: resend

1. Find a notification in the admin UI.
2. Click **Resend**.
3. A new log entry appears with a `resend:` dedup key prefix.

### With real email (staging)

```env
EMAIL_ENABLED=true
RESEND_API_KEY=re_...
MAIL_FROM=BidWar <onboarding@resend.dev>   # Resend sandbox sender for testing
APP_URL=http://localhost:3000
```

Use Resend's test domain sender for development before your production domain is verified.

### Unit tests

```bash
pnpm --filter @workspace/api-server test
```

Tests cover email template rendering and dedup key generation.

## Error handling

- Notification failures **never** break business workflows (`notifyAsync` swallows errors).
- All attempts are persisted in `notification_logs` with `status`, `error_message`, and `provider_response`.
- SMS and WhatsApp continue to use their existing `comm-sender.ts` implementations unchanged; the notification engine wraps them for future unified dispatch.
