# Mission Control Experience Reset — Design

**Date:** 2026-08-08  
**Status:** Approved (Approach 1 — Presenter Layer)  
**Depends on:** Phase 1 product ownership; Phase 2 sport-boundary / SportCapabilities

## Problem

Tournament Mission Control exposed internal orchestration machinery (blockers wall, Runtime, lock dependencies, profile/snapshot jargon) as the primary organiser experience. The underlying pipeline is correct; the presentation is wrong.

## Approach

**Presenter layer** over the existing Module Registry. Engines, APIs, lock/prepare flows, and Runtime gating stay authoritative. Mission Control becomes an experience translator: snapshots → journey + one Next Step + Hybrid Continue.

## Primary hierarchy

1. Tournament Identity  
2. Next Step (one clear action)  
3. Compact journey: Competition → Teams → Fixtures → Schedule → Matches → Live  
4. Match Day / Live Ops  
5. View setup details (secondary)

## What stays underneath

- `ModuleRegistryProvider` + seven modules (including Runtime) remain active and authoritative  
- Existing readiness / lock / Runtime behaviour unchanged  
- SportCapabilities Phase 2 behaviour unchanged  
- Auction / Sports ownership unchanged  

## What leaves the primary view

- Attention Center / blockers–warnings–recommendations as hero  
- Tournament Health diagnostic wall as primary  
- Seven large diagnostic cards as main scroll  
- Runtime as a visible journey step  
- Snapshot / Rule / Presentation / config jargon on the primary surface  

## Presenter rules

- Input: ModuleSnapshots + Runtime readiness signals already published  
- Output: journey states + exactly one Next Step + Continue destination  
- Completeness: use existing `locked` / `readiness` / `lockedCount` vs `entityCount` — never “empty blockers ⇒ complete”  
- Loading: Competition = Next; rest = Upcoming  
- Runtime invisible; maps into Matches / Match Day prep / Live availability  
- Hybrid Continue: management → existing sport destinations via capabilities; focused setup → one focused module workspace  
- No new APIs, Key Numbers requirement, or engine rewrites  

## Testing

- Unit tests for presenter mapping (loading, step order, Runtime invisible, Live gating, hybrid kinds)  
- Keep sport-capabilities / live-ops path tests green  
- Manual verify Badminton + Cricket capability-driven Continue / Live Ops  
