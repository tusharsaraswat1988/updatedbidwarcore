# BidWar Mobile — Phase 2 Native Android (Capacitor)

**Date:** 2026-07-13  
**Status:** Approved via Phase 2 requirements (implement)  
**Package:** `com.bidwar.app`  
**App name:** BidWar  

## Goal

Wrap the existing dual-auth mobile web app (`artifacts/mobile-app` → `/mobile/`) in a Capacitor Android shell. **Do not rewrite** the React app or change Organizer / Team Owner / Google authentication logic.

## Approach (chosen)

**Remote WebView host** — Capacitor loads the deployed mobile shell:

- Staging default: `https://bidwar-staging.onrender.com/mobile/`
- Production override via `CAPACITOR_SERVER_URL` / `bidwar.in`

### Why not bundling-only local assets?

Google OAuth, session cookies (`bidwar_auth`), and Team Owner flows require same-origin navigation to `/api/*` and OAuth callbacks. A local `capacitor://` origin would break cookies and redirect URIs without rewriting auth. Remote URL preserves production behaviour unchanged.

`webDir` still points at `dist/public` (required by Capacitor sync / offline shell fallback). `server.url` is what the WebView opens at runtime.

## Native shell scope

| Item | Plan |
|------|------|
| App ID | `com.bidwar.app` |
| Min SDK | 29 (Android 10) |
| Target / compile SDK | 35 |
| Adaptive icon | From `attached_assets/bidwar_app_icon.png` |
| Splash | Dark `#09090b` + BidWar mark |
| Status bar | Dark / light-content; edge-to-edge |
| Safe area | Existing `viewport-fit=cover` + CSS `env(safe-area-inset-*)` |
| Back button | `@capacitor/app` → `history.back()` / exit on root |
| Orientation | Default portrait; allow landscape only on live auction routes if needed later (default unlock all for Phase 2; lock portrait at activity level for auth UX) |
| FCM | Add Firebase BOM + `google-services` plugin + `@capacitor/push-notifications` registration stub — **no** business notification logic |
| Permissions | Internet only by default; POST_NOTIFICATIONS only when FCM init is enabled |

## Auth & deep links (unchanged)

- Organizer email/password + Google OAuth continue via existing APIs
- Team Owner mobile → tournament → access code unchanged
- Android App Links / deep links: intent filters for `/mobile/*` on staging + production hosts
- Live auction continues to open owner-app URLs in WebView allowlist

## Build artifacts

| Artifact | Path |
|----------|------|
| Debug APK | `artifacts/mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `artifacts/mobile-app/android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `artifacts/mobile-app/android/app/build/outputs/bundle/release/app-release.aab` |

Release signing uses a repo-local **upload keystore** under `artifacts/mobile-app/android/keystore/` (gitignored secrets; committed example + CI docs). For Play Store, replace with org-managed key.

## Out of scope (Phase 2)

- iOS
- Push notification business logic / topics
- Rewriting mobile React screens
- Changing OAuth / login-guard / owner onboarding APIs
