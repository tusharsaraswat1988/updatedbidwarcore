# BPL Kids — standalone Railway registration service

This directory is an independent React/Vite static service inside `tusharsaraswat1988/updatedbidwarcore`. It has no runtime dependency on the main BidWar service, PostgreSQL/Neon, BidWar APIs, authentication, cookies, schemas, or deployment configuration. Its only BidWar relationship is public branding and the `bpl.bidwar.in` domain.

## Railway deployment

Create a **new Railway service** from the same GitHub repository. In the service settings use:

| Railway setting | Exact value |
| --- | --- |
| Root Directory | `standalone/bpl-kids-registration` |
| Build Command | `pnpm build` |
| Start Command | `pnpm start` |
| Healthcheck Path | `/health` |
| Custom Domain | `bpl.bidwar.in` |

`railway.toml` records the same contract. `pnpm start` runs the included dependency-free static server; it serves Vite's `dist/` output, listens on Railway's `PORT`, provides `/health`, and returns `index.html` for non-asset paths. The app currently has no client-side routes, but this fallback makes a direct refresh safe without adding a router.

Do **not** use the repository root as this service's root directory, and do not use root build/start commands. This service does not require any root BidWar environment variable.

### Railway environment variables

Set these **at build time and runtime** in the BPL Railway service only:

```dotenv
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=bpl_kids_public
VITE_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

All `VITE_*` values are public browser configuration. Never set Cloudinary API secrets, Google service-account/OAuth credentials, database URLs/passwords, SMTP credentials, or any other private value in this service.

## Frontend configuration

Update `src/config.ts` before building to control tournament name/slug/dates/organiser, categories/classes, player and mentor counts, pricing, payment QR/link, sponsors, WhatsApp URL, Cloudinary folder, role fields, and public registration window. This remains configuration-driven; no Admin UI or BidWar integration is involved.

## Cloudinary setup

Create a dedicated **unsigned, restricted** preset (for example `bpl_kids_public`) in Cloudinary:

- restrict to JPG, PNG, and WebP; maximum 5 MB;
- restrict uploads to `bpl-kids-2026` and child folders `associations`, `players`, `mentors`, and `payments`;
- enable any appropriate Cloudinary moderation/rate-limit controls;
- do not expose a Cloudinary API secret.

The browser uploads association, player, mentor, and payment images straight to Cloudinary. Apps Script accepts only Cloudinary secure URLs/public IDs within the configured folder. No Google Drive API is used.

## Automatic Google Sheet and Apps Script setup

1. Create a **new standalone Apps Script project** at [script.google.com](https://script.google.com). Do not bind it to, or reuse, a BidWar spreadsheet.
2. Add `apps-script/Code.gs` and `apps-script/appsscript.json` from this directory.
3. In the editor, select and run `setupBplRegistration()` once, then approve the requested Spreadsheet and MailApp permissions.
4. The setup creates **exactly one** dedicated spreadsheet named **BPL Kids Registration 2026**, saves its ID internally as `SPREADSHEET_ID`, creates all seven tabs (including **SETTINGS**) and their headers, removes the untouched default tab, and logs/returns its URL. Run it again safely whenever schema checks are needed.
5. Deploy as a Web App: **Execute as Me**, access **Anyone**, then set the resulting `/exec` URL as Railway's `VITE_GOOGLE_APPS_SCRIPT_URL`.

There is no manual spreadsheet ID, tab, column, or header setup. The web app will also self-initialize if authorization permits and `SPREADSHEET_ID` has not yet been created. For safety, a spreadsheet is used only when both `SPREADSHEET_ID` and the internal `BPL_OWNED_SPREADSHEET_ID` marker match; the public frontend can never provide a spreadsheet ID.

### SETTINGS is the operational source of truth

`setupBplRegistration()` populates the **SETTINGS** tab with non-secret BPL defaults, including disabled registration, eight players, categories/classes, ₹8,000 registration fee, ₹5,000 branding fee, `bpl-kids-2026`, payment fields, sponsor JSON, and tournament copy. Edit SETTINGS directly in the authorized Google Sheet; no code deployment is required for operational changes. Script Properties are used only as a one-time migration fallback for an existing pre-SETTINGS deployment.

To change the registration closing date: open the BPL Google Sheet → **SETTINGS** → change `REGISTRATION_END` → save. For example: `2026-10-02T23:59:59+05:30`. The Apps Script backend reads this value on every registration request and independently rejects requests outside the enabled window.

Before launch, set or update these non-secret SETTINGS values as needed:

| Property | Production value |
| --- | --- |
| `REGISTRATION_ENABLED` | Set to `true` only when ready to accept registrations |
| `REGISTRATION_START` / `REGISTRATION_END` | Approved ISO registration window |
| `WHATSAPP_LINK` / `PAYMENT_LINK` | Approved public production URLs |
| `ADMIN_EMAILS` | Optional comma-separated notification recipients |
| `TOURNAMENT_INFORMATION`, `TOURNAMENT_INCLUSIONS`, `IMPORTANT_INSTRUCTIONS` | Approved email copy |
| `CATEGORY_CLASSES_JSON`, `ROLE_REQUIRED_FIELDS_JSON` | Change only when changing the matching frontend configuration |
| Other defaults | Name, dates, fees, folder, prefix, payload limit, QR, payment instructions, and sponsor JSON are initialized in SETTINGS and can be edited there. |

The spreadsheet owns `REGISTRATIONS`, `PLAYERS`, `MENTORS`, `PAYMENTS`, `FILES`, `AUDIT_LOG`, and `SETTINGS`. Existing tabs/data are never deleted: missing required headers are appended, and rows are written by header name to avoid corrupting an existing initialized sheet. Registration uses server-side open/close validation, payload/category/class/fee/file checks, LockService-protected team-code allocation, and a six-hour idempotency cache. An email error is audited as `EMAIL_FAILED` but does not undo a saved registration.

## DNS and final launch verification

In Railway, add `bpl.bidwar.in` as the custom domain. In the DNS provider for `bidwar.in`, create the CNAME record Railway supplies for host `bpl`; wait for Railway TLS/domain validation.

Before opening registrations, verify on the deployed domain:

1. `/health` returns `{"ok":true}` and `/` loads after a refresh.
2. Cloudinary accepts all 11 required image uploads, reports failures cleanly, and stores secure URLs/public IDs.
3. Category 1/no-branding produces ₹8,000; Category 2/branding produces ₹13,000.
4. Apps Script writes all registration tabs and uses SETTINGS, returns a unique `BPL-2026-*` registration ID and four-digit team code, and rejects closed/invalid/duplicate requests.
5. The confirmation email reaches association, mentor, parent, and configured admin recipients; inspect `AUDIT_LOG` for failed email delivery.
6. The payment QR/link, sponsor logos, WhatsApp link, dates, venue/inclusions, and all placeholders are replaced with approved production values.
7. Check the form on 360px, 390px, 412px, and desktop devices.

## Local commands

```bash
pnpm install
pnpm build
PORT=3000 pnpm start
curl http://127.0.0.1:3000/health
```
