/**
 * Centralized tag theme system.
 * All tag colours, glows, labels live here.
 * GPU-safe: only opacity animations — no blur/shadow/transform animations.
 */

export type TagTheme = {
  color:  string;  // primary text/border colour
  glow:   string;  // rgba for box-shadow glow
  bg:     string;  // badge background (rgba, low opacity)
  border: string;  // badge border (rgba)
  label:  string;  // full display label, uppercase
  abbrev: string;  // compact abbreviation for tight UI spaces
};

const TAG_MAP: Record<string, TagTheme> = {
  icon: {
    color:  "#fbbf24",
    glow:   "rgba(251,191,36,0.45)",
    bg:     "rgba(251,191,36,0.14)",
    border: "rgba(251,191,36,0.40)",
    label:  "ICON",
    abbrev: "ICON",
  },
  star_player: {
    color:  "#a855f7",
    glow:   "rgba(168,85,247,0.40)",
    bg:     "rgba(168,85,247,0.14)",
    border: "rgba(168,85,247,0.40)",
    label:  "STAR PLAYER",
    abbrev: "STAR",
  },
  captain: {
    color:  "#22c55e",
    glow:   "rgba(34,197,94,0.35)",
    bg:     "rgba(34,197,94,0.14)",
    border: "rgba(34,197,94,0.35)",
    label:  "CAPTAIN",
    abbrev: "CAPT",
  },
  vice_captain: {
    color:  "#06b6d4",
    glow:   "rgba(6,182,212,0.35)",
    bg:     "rgba(6,182,212,0.14)",
    border: "rgba(6,182,212,0.35)",
    label:  "VICE CAPTAIN",
    abbrev: "VC",
  },
  booster: {
    color:  "#ef4444",
    glow:   "rgba(239,68,68,0.35)",
    bg:     "rgba(239,68,68,0.14)",
    border: "rgba(239,68,68,0.35)",
    label:  "BOOSTER",
    abbrev: "BSTR",
  },
  owner: {
    color:  "#3b82f6",
    glow:   "rgba(59,130,246,0.35)",
    bg:     "rgba(59,130,246,0.14)",
    border: "rgba(59,130,246,0.35)",
    label:  "OWNER",
    abbrev: "OWN",
  },
  co_owner: {
    color:  "#f97316",
    glow:   "rgba(249,115,22,0.35)",
    bg:     "rgba(249,115,22,0.14)",
    border: "rgba(249,115,22,0.35)",
    label:  "CO-OWNER",
    abbrev: "CO-OWN",
  },
};

const FALLBACK: TagTheme = {
  color:  "#eab308",
  glow:   "rgba(234,179,8,0.35)",
  bg:     "rgba(234,179,8,0.14)",
  border: "rgba(234,179,8,0.35)",
  label:  "TAGGED",
  abbrev: "TAG",
};

/** Returns the tag theme for a given tag key, or null when no tag. */
export function getTagTheme(tag: string | null | undefined): TagTheme | null {
  if (!tag) return null;
  return TAG_MAP[tag] ?? FALLBACK;
}

/**
 * CSS `animation` value for the soft opacity pulse (GPU-safe).
 * Apply to the badge element only — never to blur/shadow/transform.
 * Requires TAG_PULSE_KEYFRAMES to be injected once in the same document.
 */
export const TAG_PULSE_ANIMATION = "softPulse 4s ease-in-out infinite";

/** Inject once per page to enable the pulse animation. */
export const TAG_PULSE_KEYFRAMES = `
@keyframes softPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.92; }
}
`;
