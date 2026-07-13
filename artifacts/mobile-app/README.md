# BidWar Mobile App

Shared mobile shell for BidWar with **role-driven, isolated authentication**.

## Entry

- URL: `/mobile/`
- First launch: role selection (`Welcome to BidWar`)
- Later launches: login for the last selected role (`localStorage`: `bidwar.mobile.lastRole`)

## Roles (independent auth)

| Role | Auth | Session |
|------|------|---------|
| **Organizer** | Google + Email/Password via existing `/api/auth/organizer-account/*` and `/api/auth/google` | `bidwar_auth` cookie + `bidwar.role.organizer.*` markers |
| **Team Owner** | Mobile → Tournament → Access Code via existing owner APIs | `bidwar_owner` cookie + owner sessionStorage + `bidwar.role.team-owner.*` markers |

Logging out one role never clears the other.

## Switch Role

Available on every login screen and in each role’s Settings.

## Android (Capacitor)

Native Android shell: see [ANDROID.md](./ANDROID.md).

```bash
pnpm run android:build   # sync + debug APK + release APK/AAB
```

Package: `com.bidwar.app` · Min SDK 29 · Hosts the existing `/mobile` app (auth unchanged).
