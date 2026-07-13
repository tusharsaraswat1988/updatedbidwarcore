# BidWar Mobile — Android (Capacitor Phase 2)

Native Android shell for the existing dual-auth web app at `/mobile/`.

**Does not rewrite authentication.** The WebView loads the deployed mobile shell so Organizer, Google, and Team Owner flows stay identical to the browser.

| | |
|--|--|
| App name | BidWar |
| Package | `com.bidwar.app` |
| Min SDK | 29 (Android 10) |
| Target / compile SDK | 36 |

## Architecture

- Capacitor 8 Android project under `android/`
- Runtime URL (default staging): `https://bidwar-staging.onrender.com/mobile/`
- Override: `CAPACITOR_SERVER_URL=https://bidwar.in/mobile/`
- Native: adaptive icon, splash, edge-to-edge status bar, hardware back, App Links for `/mobile`
- FCM: Firebase Messaging service + `google-services.json` **placeholder** (no notification product logic)

## Build commands

```bash
export ANDROID_HOME=~/android-sdk   # or your SDK path
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

cd artifacts/mobile-app

# Sync web build into Android project
pnpm run android:sync

# Debug APK
pnpm run android:assemble:debug

# Signed release APK + Play Store AAB
pnpm run android:assemble:release

# Or all-in-one
pnpm run android:build
```

Create `android/local.properties`:

```properties
sdk.dir=/absolute/path/to/android-sdk
```

Release signing: copy `android/keystore/keystore.properties.example` → `keystore.properties` and point at your upload keystore (or use the generated local keystore for CI/debug releases only).

## Artifact locations

After a successful Gradle build:

| Artifact | Path |
|----------|------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| Copied deliverables | `dist/android/BidWar-debug.apk`, `BidWar-release.apk`, `BidWar-release.aab` |

## Install (debug)

```bash
adb install -r dist/android/BidWar-debug.apk
```

Or open `android/` in Android Studio → Run.

## Firebase / FCM

1. Create a Firebase Android app for `com.bidwar.app`
2. Replace `android/app/google-services.json` (see `.example`)
3. Notification **business logic is intentionally not implemented** in Phase 2

## Deep links

Intent filters (App Links) for:

- `https://bidwar-staging.onrender.com/mobile…`
- `https://bidwar.in/mobile…`
- `https://www.bidwar.in/mobile…`

Host `assetlinks.json` on each domain for verified App Links.

## Known limitations

- WebView loads the **remote** `/mobile` shell; Capacitor JS plugins activate fully only after that shell includes `@capacitor/*` (this branch adds the bootstrap — deploy web to staging/prod for full JS bridge features). Hardware back / splash / status bar still work natively.
- Portrait locked at activity level; landscape for live auction LED can be added later per-route.
- Placeholder Firebase config does not deliver real push tokens to a backend.
- Upload keystore in this environment is for build verification — replace before Play production.

## Play Store readiness checklist

- [ ] Replace upload keystore with org-managed Play App Signing key
- [ ] Replace `google-services.json` with production Firebase project
- [ ] Set `CAPACITOR_SERVER_URL=https://bidwar.in/mobile/` for store builds
- [ ] Host Digital Asset Links for App Links verification
- [ ] Privacy policy + Data safety form (auth, optional notifications)
- [ ] Store listing graphics / screenshots
- [ ] Manual QA: Organizer login, Google login, Team Owner flow, Switch Role, live auction, offline reconnect, back, rotation/resume, deep links
- [ ] Target API policy compliance (currently targetSdk 36)
