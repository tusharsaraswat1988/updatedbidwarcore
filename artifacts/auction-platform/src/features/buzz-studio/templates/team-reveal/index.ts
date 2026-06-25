/**
 * Buzz Studio — Team Reveal Template
 *
 * Public API for the team-reveal template module.
 * Import from this barrel; never import from sibling files directly.
 *
 * @example
 * import { TeamReveal, TeamRevealContract, formatTeamSpend } from "./templates/team-reveal";
 */

/* ── Component ─────────────────────────────────────────────────────────── */
export { TeamReveal } from "./TeamReveal";

/* ── Types ─────────────────────────────────────────────────────────────── */
export type { TeamRevealContract } from "./TeamReveal.types";

/* ── Utils ─────────────────────────────────────────────────────────────── */
export { formatTeamSpend, formatPlayerCount } from "./TeamReveal.utils";

/* ── Demo data (dev only — not for production use) ─────────────────────── */
export {
  demoFullCricket,
  demoNoLogo,
  demoNoCaptain,
  demoCricketHighBudget,
  demoBadminton,
  demoFootballNoSpend,
  ALL_DEMO_SCENARIOS,
  DEMO_SCENARIO_LABELS,
} from "./demo-data";
