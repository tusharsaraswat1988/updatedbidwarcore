# Cricket Rules & format — choice chips instead of dropdowns

**Date:** 2026-08-12  
**Status:** Approved direction (choice chips)  
**Scope:** Rules & format page only (`/tournament/:id/score/rules`)

## Problem

Short catalog fields (about 4–6 options) use Radix `Select` dropdowns. That forces open → scan → click for a choice that should be one tap, and has been a recurring irritation on this page.

## Decision

Replace those dropdowns with **choice chips** (tap-to-select buttons). Keep squad numeric fields as text inputs. Do **not** change other BidWar pages in this pass.

## Fields that become chips

| Section | Field |
|---|---|
| 1. Format | Cricket type (variant) |
| 1. Format | Competition type |
| 2. Formation & squad | Player registration |
| 2. Formation & squad | Team formation |
| 3. Playing & display | Playing rules (rule profile) |
| 3. Playing & display | LED / screen look (presentation profile) |

Unchanged: min/max players, substitutes, retentions; Save / Lock / Apply actions; lock/disabled behavior; API payloads.

## UI behavior

- Options render as a wrapping row of chips (label only on the chip).
- Selected chip uses primary border/background (same visual language as badminton `ChoiceChip`).
- Description for the **selected** option shows under the chip group (same as today under the select).
- When locked, chips are disabled (not removable).
- Empty option list still shows the existing “No options available” message.
- No dropdown portal; no empty full-height overlay risk for these fields.

## Implementation sketch

- On `artifacts/auction-platform/src/pages/cricket/rules.tsx`, replace `OptionSelect`’s `Select` usage with an inline chip group (or a tiny local `OptionChips` helper in the same file).
- Reuse styling patterns from `match-format-picker.tsx` `ChoiceChip` (border, primary selected state). Prefer local helper over a new shared package unless reuse is immediate.
- Keep existing `onChange(id, version?)` contract so rule/presentation profile version wiring stays intact.
- No backend or catalog changes.

## Out of scope

- App-wide Select → chips migration
- Changing catalog option counts or labels
- Redesigning RuleProfileCatalogPanel beyond keeping it under Playing rules

## Success criteria

- Organiser can set Cricket type (and other short fields) with one tap.
- Locked rules still prevent edits.
- Save / Lock / Apply continue to work with the same IDs/versions as today.
