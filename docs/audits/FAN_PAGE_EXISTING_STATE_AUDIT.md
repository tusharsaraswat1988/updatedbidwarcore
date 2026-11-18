# BIDWAR FAN PAGE — EXISTING STATE AUDIT

## 1. Executive Summary

The Fan Page / Public Viewer experience is fragmented across multiple entry points and relies on both internal (`AuctionFanRenderer`, `LiveViewer`) and external/redirected (`RedirectToScoringApp`) components. While the foundational routing for a "Unified Fan Page" exists in `UnifiedFanPage.tsx`, many sports-specific views are currently redirects to an external scoring application.

## 2. Route Inventory

| Route | Component | Purpose | Status |
|---|---|---|---|
| `/live/:id` | `LiveViewer` | Real-time auction viewer | COMPLETE |
| `/tournament/:id/fan` | `UnifiedFanPage` | Main entry point for fans | COMPLETE |
| `/tournament/:id/display` | `DisplayView` | OBS-style display | COMPLETE |
| `/tournament/:id/obs/v2` | `ObsV2Overlay` | OBS Overlay | COMPLETE |
| `/cricket/:matchId/score` | Redirect | External scoring app | MOCKED/REDIRECTED |

## 3. Feature Inventory

| Feature | Status | Evidence |
|---|---|---|
| Auction Live Viewer | COMPLETE | `LiveViewer` |
| Fan Page Shell | COMPLETE | `UnifiedFanPage` |
| Cricket Scoring | REDIRECTED | `RedirectToScoringApp` |
| Badminton Scoring | REDIRECTED | `RedirectToScoringApp` |

## 4. Component and File Inventory

- `artifacts/auction-platform/src/pages/liveviewer.tsx`
- `artifacts/auction-platform/src/pages/unified-fan-page.tsx`
- `artifacts/auction-platform/src/components/fan/auction-fan-renderer.tsx`
- `artifacts/auction-platform/src/components/fan/cricket-fan-renderer.tsx`
- `artifacts/auction-platform/src/components/fan/badminton-fan-renderer.tsx`

## 5. Technical Architecture Map

The architecture uses a unified router that determines whether to render internal components (`AuctionFanRenderer`, `LiveViewer`) or redirect to an external scoring application (`RedirectToScoringApp`).

## 6. API and Database Dependency Map

Relies heavily on `@workspace/api-client-react` for tournament, auction state, team purses, and player data.

## 7. Browser Screenshots and Observations

*Needs verification via browser.*

## 8. Functional Test Results

*Needs verification via browser.*

## 9. UI/UX Issues

Fragmented navigation between auction-specific and scoring-specific views.

## 10. Missing Features

Unified scoring experience within the main platform (currently relies on external redirects).

## 11. Preserve / Rework / Replace Recommendations

- **Preserve**: `UnifiedFanPage` structure.
- **Rework**: Scoring app integration to be more seamless or fully internal.
- **Replace**: External redirects for scoring (if a fully integrated experience is desired).

## 12. Critical Risks

High reliance on external scoring app redirects which may break if the scoring app interface changes.

## 13. Evidence and File References

- `artifacts/auction-platform/src/App.tsx`
- `artifacts/auction-platform/src/platform-app.tsx`
