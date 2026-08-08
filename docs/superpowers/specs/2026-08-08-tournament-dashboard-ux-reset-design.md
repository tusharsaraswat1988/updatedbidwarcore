# Tournament Dashboard UX Reset — Design

**Date:** 2026-08-08  
**Status:** Implemented (soft State B)  
**Depends on:** Mission Control Experience Reset (presenter layer)

## Product rename

Organiser-facing name: **Tournament Dashboard**  
Internal route may remain `/mission-control`.

## Two states

- **Setup:** “Get your tournament ready” + journey  
  Competition → Teams & Players → Fixtures → Schedule → Match Setup  
  One CTA: Continue Setup (Hybrid destinations). No Runtime. No diagnostic wall.
- **Ready (soft):** Match Day overview + Open Scoring + Live Ops deep-link.  
  No today/next-match KPIs in this pass unless already trivial.

## Preserved

ModuleRegistryProvider, ModuleSnapshots, Runtime gating, SportCapabilities, existing sport routes.
