# BIDWAR FAN ARENA — REDESIGN & STABILIZATION MANIFESTO

## Objective
Establish a unified, high-performance spectator experience across all BidWar Fan Arena surfaces. Eliminate fragmented shells, inconsistent navigation, and layout fragility.

## 1. Audit Findings
*   **Branding:** Text-based branding in shell headers was failing to leverage the unified asset library (`bidwar-primary-logo-official.png`).
*   **Navigation:** Mixed use of `wouter` `<Link>` and raw `<a>` tags caused full-page reloads, breaking the SPA experience and losing state.
*   **Responsiveness:** Components like `LiveMiniScoreboard` relied on fixed `min-w` CSS, forcing horizontal overflow on mobile viewports.
*   **Theme:** Theme synchronization was inconsistent; protected surfaces sometimes reverted to default styles instead of the approved dark-themed spectator palette.

## 2. Architecture Stabilization
*   **FanArenaShell:** Created a consolidated, unified shell wrapper for all modules (Auction/Scoring/Public).
*   **Routing:** Standardized on `wouter` internal routing; enforced the complete removal of hard navigation reloads (e.g., `window.location.reload`).
*   **Responsiveness:** Implemented shared responsive wrapper components, enabling horizontal scrolling/flexing only where appropriate and preserving vital scoring density on mobile.

## 3. Verification Results
*   **Logo Rendering:** Verified consistent rendering of official logo on all breakpoints.
*   **Navigation:** Tab switching verified as SPA-native; no full reloads observed in testing (1440px/768px/390px).
*   **Theme:** Dark mode verified as consistent across the entire Fan Arena surface.
*   **Responsiveness:** No horizontal clipping observed on 360px viewport; all scoreboard controls remain accessible.

## 4. Status
*   **P0/P1 Status:** Complete.
*   **Regression Check:** Passed (no regressions in auction logic or scoring calculations).
