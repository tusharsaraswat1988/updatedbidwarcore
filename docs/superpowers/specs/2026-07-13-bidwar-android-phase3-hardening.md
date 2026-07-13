# BidWar Android — Phase 3 Production Hardening

**Date:** 2026-07-13  
**App:** `com.bidwar.app` v1.1.0  

## Architecture summary

Capacitor WebView hosts the existing `/mobile` SPA:

| Build | Shell URL |
|-------|-----------|
| Debug | `https://bidwar-staging.onrender.com/mobile/` |
| Release | `https://bidwar.in/mobile/` |

Gradle rewrites `capacitor.config.json` after asset merge; `MainActivity` also loads `BuildConfig.MOBILE_SHELL_URL` as a hard guarantee.

Offline / updates / crashes are handled in the native shell + thin React overlays without changing Organizer or Team Owner auth.

## Remaining blockers before Play Store

1. Replace placeholder `google-services.json` with a real Firebase Android app (Analytics/Crashlytics/FCM).
2. Replace the local upload keystore with org-managed Play App Signing credentials.
3. Host Digital Asset Links (`/.well-known/assetlinks.json`) on `bidwar.in` for verified App Links.
4. Deploy the mobile web build that includes Capacitor JS bootstrap to production so plugin bridge (status bar helpers, network listeners) is fully active inside the hosted shell.
5. Manual device QA on the **release** APK against production (Organizer, Google, Team Owner, live auction, offline, deep links).
6. Store listing, privacy policy, Data safety form.
