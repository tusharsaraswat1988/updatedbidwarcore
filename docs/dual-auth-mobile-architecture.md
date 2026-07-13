# Dual Authentication Mobile Architecture

**Date:** 2026-07-13  
**App:** `artifacts/mobile-app` (`/mobile/`)

## Goal

One shared BidWar mobile application with completely independent authentication for Organizer and Team Owner. Auth systems are not merged.

## Shell

- Role selection on first launch (`Welcome to BidWar`)
- Last role remembered in `localStorage` (`bidwar.mobile.lastRole`)
- Subsequent launches open that role’s login screen
- **Switch Role** on every login screen and in Settings

## Isolation model

```
┌──────────────────────────── Mobile App Shell ────────────────────────────┐
│  Branding · Role selection · Role preference                             │
│                                                                          │
│  ┌──────────── Organizer ────────────┐  ┌──────── Team Owner ──────────┐ │
│  │ Google / Email+Password           │  │ Mobile → Tournament → Code   │ │
│  │ APIs: /auth/organizer-account/*   │  │ APIs: owner lookup + verify  │ │
│  │ Cookie: bidwar_auth               │  │ Cookie: bidwar_owner         │ │
│  │ Markers: bidwar.role.organizer.*  │  │ Markers: bidwar.role.team-*  │ │
│  │ Stack: /mobile/organizer/*        │  │ Stack: /mobile/team-owner/*  │ │
│  └───────────────────────────────────┘  └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

Logout of one role never clears the other.

## Extensibility

Register new roles in `src/roles/registry.ts` with their own auth provider, session keys, and routes. Do not share auth providers across roles.

Possible future roles: Operator, Scorer, Umpire, Volunteer, Spectator.

## Backend

No auth API changes. Existing Organizer and Team Owner endpoints are reused as-is.
