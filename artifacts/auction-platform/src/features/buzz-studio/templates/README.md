# Buzz Studio — Templates

**Status: Reserved for Phase 2**

This directory will contain all Buzz Studio creative templates.
Each template is a self-contained React component that composes
`BidwarCanvas` with tournament, player, or team data.

## Planned template categories

- Player card (auction sold / unsold / highlight)
- Team roster card
- Tournament bracket snapshot
- Bid war result card
- Champion announcement card
- Social story (9:16) format

## Conventions (Phase 2)

- Every template must accept a `BuzzTheme` prop
- Every template must be renderable without a browser DOM (for server-side PNG export)
- No template may import auction business logic directly

## Dependencies (Phase 2)

No implementation exists here yet.
Do not add templates until the Template Engine phase is initiated.
