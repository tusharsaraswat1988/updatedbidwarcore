# BidWar Mobile — Android (Capacitor)

Native Android shell for the existing dual-auth web app at `/mobile/`.

**Does not rewrite authentication.** The WebView hosts the deployed mobile shell so Organizer, Google, and Team Owner flows stay identical to the browser.

| | |
|--|--|
| App name | BidWar |
| Package | `com.bidwar.app` |
| Min SDK | 29 (Android 10) |
| Target / compile SDK | 36 |
| Version | 1.1.0 (versionCode 2) |

## Architecture (Phase 3)

```
Android WebView (Capacitor)
  ├─ Debug build  → https://bidwar-staging.onrender.com/mobile/
  └─ Release build → https://bidwar.in/mobile/   (never staging)
       │
       ├─ Offline: native offline.html + in-app OfflineBanner
       ├─ Updates: soft UpdatePrompt (skipped on live auction routes)
       ├─ Crash: AppErrorBoundary + WebView renderer recovery
       └─ Firebase: Messaging + Analytics + Crashlytics (infra only)
```

Gradle rewrites `capacitor.config.json` `server.url` per variant during `merge*Assets`.

## Build commands

```bash
export ANDROID_HOME=~/android-sdk
cd artifacts/mobile-app

# Ensure keystore.properties exists for signed release
# cp android/keystore/keystore.properties.example android/keystore/keystore.properties

pnpm run android:build
```

| Artifact | Path |
|----------|------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |

## Install

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Security (release)

- `minifyEnabled` + `shrinkResources` (R8)
- `WebView.setWebContentsDebuggingEnabled(false)`
- `debuggable false`
- HTTPS only / cleartext denied (`network_security_config`)
- Signed with upload keystore when `keystore.properties` present

## Firebase

Replace `android/app/google-services.json` with a real Firebase Android app for `com.bidwar.app` before production push/analytics.

### Google Sign-In (Android)

Google blocks OAuth inside the WebView (`403 disallowed_useragent`). The shell opens
`/api/auth/google?native_app=android` in Chrome Custom Tabs and returns via
`bidwar://oauth-complete?handoff=…`, which the WebView exchanges for a session cookie.

Requires the API + mobile web build that includes the native handoff routes.

## Production checklist

- [x] Release URL = `https://bidwar.in/mobile/`
- [x] Debug URL = staging
- [x] Offline page + retry (no stock WebView errors)
- [x] Update prompt (not during live auction)
- [x] Back / splash / status bar / safe-area / keyboard hooks
- [x] Deep links + external browser for foreign hosts
- [x] Error boundary + WebView crash recovery
- [x] Analytics + Crashlytics dependencies (infra)
- [x] R8 + no WebView debug in release
- [ ] Real Firebase project config
- [ ] Org Play App Signing key
- [ ] `assetlinks.json` on bidwar.in
- [ ] Device QA on release APK against production
- [ ] Deploy mobile web with Capacitor JS bootstrap for full plugin bridge

## Known limitations

- Capacitor JS plugins fully activate after the **hosted** `/mobile` build includes `@capacitor/*` (this repo has the bootstrap — deploy to production).
- Placeholder Firebase config until Console credentials are added.
- Portrait locked app-wide.
