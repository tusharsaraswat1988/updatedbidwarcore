# OBS Lab sandbox — design

**Date:** 2026-07-09  
**Status:** Approved (Approach 1 — Lab route)

## Problem

We want to redesign / polish the OBS broadcast overlay without risking the live production Browser Source URL. Iteration must still reflect **real operator-panel auction actions** (same tournament, same socket/API). The brainstorm companion server only serves static HTML and cannot run the React overlay or live auction feed.

## Goals

- Sandbox OBS UI at `/tournament/:id/obs/lab` using the **same live auction data** as production `/obs`.
- Operator changes (bid, player, Top5, team, break, etc.) reflect on **both** lab and production overlays.
- Production `/tournament/:id/obs` stays unchanged until an explicit promote step.
- Optional camera preview for lab: `/tournament/:id/obs/lab/preview`.

## Non-goals

- Separate backend, mock auction feed, or duplicate tournament state
- Changing production OBS visuals in the first cut
- Side LED / center LED redesign
- Replacing the brainstorm static companion as the runtime (it may only link/iframe the lab URL)

## Approach

**Lab route + isolated UI tree**

| Surface | Path | UI tree |
|---------|------|---------|
| Production OBS | `/tournament/:id/obs` | `BroadcastLayout` + `components/broadcast/obs/*` |
| Lab OBS | `/tournament/:id/obs/lab` | `BroadcastLabLayout` + `components/broadcast/obs-lab/*` |
| Lab camera preview | `/tournament/:id/obs/lab/preview` | Same stack as `/obs/preview`, iframe/src → lab overlay |

Shared (not forked): auction hooks, socket, `useBroadcastDirector` / director models, settings resolution, path helpers for URLs.

Lab starts as a copy of production overlay UI so behavior matches day one; polish happens only under `obs-lab/`.

## Promote workflow

1. Iterate on lab URL (browser or OBS Browser Source pointed at `/obs/lab`).
2. When approved, merge lab presentation into production `obs/` + `BroadcastLayout` (or swap imports).
3. Keep or remove lab route afterward as needed.

## Success criteria

- Opening lab and production for the same tournament shows the same live auction moments when the operator acts.
- Editing lab components does not change production `/obs` until promote.
- Lab is discoverable from Links (or equivalent) with a clear “sandbox / not for live stream” label.

## Out of scope reminders

- Brainstorm server as React host
- Auto-promote / feature-flag flip without explicit merge
