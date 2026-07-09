/** OBS Lab tokens — portrait-first hierarchy + stronger bid pop (sandbox only). */
export const OBS_BID_PANEL = {
  paddingY: 12,
  contentGap: 22,
  /** Larger face for stream readability */
  hexSize: 118,
  dividerHeight: 78,
  statusFont: 10,
  nameFont: 48,
  nameLetterSpacing: "0.02em",
  tagFont: 10,
  metaFont: 12,
  labelFont: 9,
  bidLabelFont: 11,
  valueFont: 13,
  baseLabelFont: 10,
  baseValueFont: 14,
  /** Stronger bid hero */
  bidFont: 72,
  teamFont: 13,
  hintFont: 11,
  teamLogoH: 22,
  countdownSize: 58,
  statusGap: 4,
  tagMt: 5,
  tagPy: 3,
  tagPx: 11,
  metaMt: 4,
  baseMt: 6,
  basePy: 3,
  basePx: 11,
  bidSectionMinW: 248,
  bidLabelMb: 3,
  bidTeamMt: 6,
} as const;

/** Thinner team ticker — more camera room */
export const TEAM_TICKER_HEIGHT_PX = 36;

/** Lab sponsor ribbon height (compact) */
export const LAB_SPONSOR_RIBBON_HEIGHT_PX = 36;

/** Strong bid pop — scale + settle */
export const BID_PULSE_DURATION_MS = 450;

export const OBS_LAB_FONTS = {
  display: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
  label: "'Space Grotesk', 'Segoe UI', sans-serif",
  body: "'Barlow Condensed', 'Segoe UI', sans-serif",
} as const;

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

export const SOLD_ANIMATION_TOTAL_MS =
  SOLD_SEQUENCE.priceDelayMs + SOLD_SEQUENCE.priceDurationMs;

export const SOLD_POST_ANIM_HOLD_MS = 2800;

export const SOLD_SCENE_MIN_HOLD_MS = SOLD_ANIMATION_TOTAL_MS + SOLD_POST_ANIM_HOLD_MS;
