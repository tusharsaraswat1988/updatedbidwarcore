# BidWar Android — Google OAuth outside WebView

**Date:** 2026-07-13  
**Status:** Implemented  
**Trigger:** `Error 403: disallowed_useragent` when tapping Continue with Google in the Capacitor APK

## Problem

Google blocks OAuth inside embedded Android WebViews. The BidWar shell previously kept `accounts.google.com` inside the WebView via `allowNavigation`, which produced the policy error.

Chrome Custom Tabs (or the system browser) cannot share the `bidwar_auth` cookie jar with the Capacitor WebView, so a plain “open Google externally” approach leaves the app logged out after a successful Google sign-in.

## Approach

1. **Start OAuth in Chrome Custom Tabs** (never in the WebView).
2. Pass `native_app=android` so the API knows to return via a custom scheme.
3. On success, redirect to `bidwar://oauth-complete?handoff=<short-lived JWT>`.
4. The Android activity loads `/mobile/organizer/login?google_handoff=…` in the WebView.
5. The WebView POSTs `/api/auth/google/native-handoff` and receives a normal `bidwar_auth` cookie.

Defense in depth in `MainActivity`:

- Intercept `/api/auth/google` on BidWar hosts → Custom Tabs with `native_app=android`
- Intercept any Google OAuth host → Custom Tabs
- Remove Google hosts from Capacitor `allowNavigation`

## Out of scope

- First-time Google users who still need `/complete-profile` (native returns `needs_profile` and asks them to finish once on the website)
- Verified Digital Asset Links (helpful later; custom scheme does not require them)
