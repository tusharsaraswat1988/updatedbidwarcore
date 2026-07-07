/** Fixed lower-third sizing — layout structure unchanged; typography polish only. */
export const OBS_BID_PANEL = {
  paddingY: 14,
  contentGap: 26,
  /** +15% photo — fits within existing row via alignItems center */
  hexSize: 101,
  dividerHeight: 72,
  statusFont: 9,
  nameFont: 43,
  /** Tighter tracking for player name balance */
  nameLetterSpacing: "0.02em",
  tagFont: 10,
  metaFont: 11,
  labelFont: 9,
  bidLabelFont: 10,
  valueFont: 13,
  baseLabelFont: 10,
  baseValueFont: 13,
  /** +20% bid emphasis — typography only */
  bidFont: 61,
  teamFont: 12,
  hintFont: 10,
  teamLogoH: 19,
  countdownSize: 54,
  statusGap: 4,
  tagMt: 6,
  tagPy: 3,
  tagPx: 11,
  metaMt: 4,
  baseMt: 8,
  basePy: 3,
  basePx: 11,
  bidSectionMinW: 224,
  bidLabelMb: 2,
  bidTeamMt: 5,
} as const;

export const TEAM_TICKER_HEIGHT_PX = 46;

/** Bid value pulse — 100% → 105% → 100% */
export const BID_PULSE_DURATION_MS = 200;

/** Sold lower-third staged reveal (~3.2s animation + hold after) */
export const SOLD_SEQUENCE = {
  goldPulseMs: 700,
  stampDelayMs: 500,
  stampDurationMs: 600,
  teamDelayMs: 1200,
  teamDurationMs: 700,
  priceDelayMs: 2000,
  priceDurationMs: 800,
} as const;

/** When price reveal finishes — used for minimum scene hold. */
export const SOLD_ANIMATION_TOTAL_MS =
  SOLD_SEQUENCE.priceDelayMs + SOLD_SEQUENCE.priceDurationMs;

/** Readable hold after animation completes (ms). */
export const SOLD_POST_ANIM_HOLD_MS = 2800;

/** Minimum sold lower-third visibility — animation + read time. */
export const SOLD_SCENE_MIN_HOLD_MS = SOLD_ANIMATION_TOTAL_MS + SOLD_POST_ANIM_HOLD_MS;
