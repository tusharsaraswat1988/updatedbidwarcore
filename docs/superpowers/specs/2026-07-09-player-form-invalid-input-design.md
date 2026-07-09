# Player 1-by-1 form Invalid input (HTTP 400) — design

**Date:** 2026-07-09  
**Status:** Approved (recommended approach)

## Problem

Organizers adding a player via the one-by-one form see a generic **Invalid input / HTTP 400** on save. This appeared during live auction / after recent deploys; sold players are not required to reproduce. Retained players in the tournament are unrelated.

## Root cause

Commit `61dcf65` changed the player form payload so non-retained saves always send:

- `retainedPrice: null`
- `teamId: null`

`POST /tournaments/:id/players` validates with Zod `retainedPrice: z.number().int().optional()`, which rejects `null`. The UI also reads `err.response.data` instead of `ApiError.data`, so organizers only see the prefixed HTTP message.

## Approach (approved)

1. **Form payload:** For non-retained status, omit `retainedPrice` and `teamId` (`undefined`) instead of sending `null`. When status is `retained`, keep sending concrete values. Matches pre-regression create behavior; PATCH already clears roster fields when leaving retained/sold.
2. **Error UX:** Read API error body from `err.data` (and keep `response.data` fallback) so field errors and server messages surface clearly.

## Out of scope

- Broad create-schema nullability changes
- Redesign of retained-player UX
