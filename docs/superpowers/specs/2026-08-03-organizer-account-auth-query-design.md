# Organizer Account Auth — Shared React Query Source of Truth

**Date:** 2026-08-03  
**Status:** Approved  
**Scope:** Unify Organizer account session detection across homepage, marketing chrome, and Organizer portal

## Problem

An authenticated Organizer session works on `/organizer` (cookie + `checkOrganizerAccountAuth()`), but the public homepage and marketing navbar always hardcode “Sign In” / “Get Started”. Auth state lived only inside `OrganizerPortal` local React state. Public chrome never consulted the session.

## Goals

- Exactly one source of truth for Organizer **account** auth: React Query key `["organizer-account-auth"]`.
- Reuse existing cookie/JWT and `checkOrganizerAccountAuth()` — no backend changes.
- `/` redirects authenticated Organizers to `/organizer` (replace) without mounting the Landing page or flashing Sign In.
- Marketing pages stay public; chrome shows a single **Dashboard** CTA when logged in.
- No flash of anonymous or authenticated UI before the auth query resolves.
- Preserve server-error semantics: 401/403 = logged out; 5xx/network ≠ logout.

## Non-goals

- Account/avatar menu, notifications.
- Changing mid-page marketing CTAs (“Start Free Trial”, etc.).
- Admin auth or per-tournament auth (`useOrganizerAuth`) redesign.
- Zustand / Context-only auth store.

## Architecture

### Shared query

| Piece | Detail |
|--------|--------|
| Query key | `["organizer-account-auth"]` |
| queryFn | `checkOrganizerAccountAuth()` (canonical API) |
| Hook | `useOrganizerAccountAuth()` |
| Read API | `{ organizer, tournaments, isLoggedIn, isLoading, isServerError, refresh }` |

### Cache actions (write path)

Dedicated helpers own all mutations of the shared cache (not exposed as arbitrary setters on the hook):

- `setOrganizerAccountAuthData(queryClient, { organizer, tournaments })` — after login/signup/Google/profile payloads
- `clearOrganizerAccountAuth(queryClient)` — after logout / inactivity
- `syncOrganizerAccountAuth(queryClient)` — `fetchQuery` / invalidate+refetch when a fresh `/me` is required

### App startup

Mount a subscriber under the existing `QueryClientProvider` so the query initializes once at boot. Every surface consumes the same cached query.

### Consumers (must not call `checkOrganizerAccountAuth()` directly)

- Homepage route gate
- `PublicAuthCta` / public navbar / homepage header / footers
- Organizer portal
- Organizer guard, layout sidebar, sports shell, organizer profile

## Routing

| Route | Behavior |
|--------|----------|
| `/` | Until auth settled → boot UI. If logged in → `navigate("/organizer", { replace: true })` **without** mounting Landing. Else → Landing. |
| Marketing | No auto-redirect. Auth-aware chrome only. |
| `/organizer` | Session from shared query; no portal-local duplicate auth state. |

## Public chrome

Single component `PublicAuthCta`:

- **Loading:** no Sign In / Get Started / Dashboard
- **Anonymous:** Sign In + Get Started
- **Authenticated:** Dashboard → `/organizer`

Used by `PublicNavbar` (desktop + mobile), homepage header/drawer, and footer Sign In slots.

## Session lifecycle

- Login / signup / Google / password-reset sign-in / profile update → update shared cache via cache actions.
- Logout / inactivity → API logout + `clearOrganizerAccountAuth`.
- Refetch: `refetchOnWindowFocus`, `refetchOnReconnect`, explicit `refresh()`. Avoid fixed 30s polling unless a surface truly needs live validation.

## Server errors

`queryFn` must not replace a previously authenticated cache entry with anonymous state on `serverError`. Keep last known good session and surface `isServerError`.

## Loading / no-flash

- No Sign In flash, no homepage flash for authenticated users, no Dashboard flash before resolution.
- `isLoading = isPending && data === undefined` (warm cache must not blank UI).
