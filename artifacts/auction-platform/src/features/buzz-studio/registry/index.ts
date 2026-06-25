/**
 * Buzz Studio — Registry Module
 *
 * Public API for the template registry layer.
 * Import from here, never from individual registry files.
 *
 * Usage examples:
 *
 *   import {
 *     buzzTemplateRegistry,
 *     getTemplateById,
 *     getEnabledTemplates,
 *     BuzzTemplateType,
 *     BuzzTemplateCategory,
 *   } from "@/features/buzz-studio/registry";
 */

/* ─── Enums ──────────────────────────────────────────────────────────────── */
export { BuzzTemplateType } from "./template-types";
export { BuzzTemplateCategory } from "./template-categories";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type {
  BuzzTemplateDefinition,
  BuzzTemplatePreview,
  BuzzTemplateRegistryEntry,
} from "./registry-types";

/* ─── Metadata ───────────────────────────────────────────────────────────── */
export {
  ALL_TEMPLATE_METADATA,
  PLAYER_SPOTLIGHT_META,
  SOLD_PLAYER_META,
  TOP_BUYS_META,
  TEAM_REVEAL_META,
  AUCTION_SUMMARY_META,
  MVP_CARD_META,
  TOURNAMENT_LAUNCH_META,
} from "./template-metadata";

/* ─── Previews ───────────────────────────────────────────────────────────── */
export { TEMPLATE_PREVIEWS } from "./template-previews";

/* ─── Registry & Helpers ─────────────────────────────────────────────────── */
export {
  buzzTemplateRegistry,
  getTemplateById,
  getTemplatesByCategory,
  getEnabledTemplates,
  getComingSoonTemplates,
  templateExists,
} from "./template-registry";
