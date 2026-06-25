/**
 * Buzz Studio — Template Registry
 *
 * Single source of truth for all Buzz Studio templates.
 *
 * What lives here:
 *   - buzzTemplateRegistry  canonical readonly list of BuzzTemplateRegistryEntry
 *   - getTemplateById()     O(n) lookup by BuzzTemplateType (7 items, negligible)
 *   - getTemplatesByCategory()
 *   - getEnabledTemplates()
 *   - getComingSoonTemplates()
 *   - templateExists()      type guard — string → BuzzTemplateType
 *
 * Component registration rules:
 *   - ONLY built templates receive a non-null component.
 *   - Currently PLAYER_SPOTLIGHT, SOLD_PLAYER, TOP_BUYS, and TEAM_REVEAL are registered.
 *   - Future templates: import the component, set component: TheComponent.
 *   - NEVER add a switch statement in consumer code — use getTemplateById().
 *
 * Adding a new template:
 *   1. Add its BuzzTemplateType enum value (template-types.ts).
 *   2. Add its BuzzTemplateDefinition (template-metadata.ts).
 *   3. Add its BuzzTemplatePreview (template-previews.ts).
 *   4. Import the component here and set `component` in its entry below.
 *   5. Set `enabled: true` in its metadata.
 *   That is all — dashboard and renderer pick it up automatically.
 */

import type { ComponentType } from "react";
import { BuzzTemplateType } from "./template-types";
import { BuzzTemplateCategory } from "./template-categories";
import type { BuzzTemplateRegistryEntry } from "./registry-types";
import { ALL_TEMPLATE_METADATA } from "./template-metadata";
import { TEMPLATE_PREVIEWS } from "./template-previews";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Component Registrations                                                    */
/*                                                                             */
/*  Only import components for BUILT templates.                               */
/*  Everything else stays null.                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

import { PlayerSpotlight } from "../templates/player-spotlight/PlayerSpotlight";
import { SoldPlayer } from "../templates/sold-player/SoldPlayer";
import { TopBuys } from "../templates/top-buys/TopBuys";
import { TeamReveal } from "../templates/team-reveal/TeamReveal";

/**
 * Maps each BuzzTemplateType to its React component.
 * null = planned but not yet built.
 */
const COMPONENT_MAP: Readonly<Record<BuzzTemplateType, ComponentType<Record<string, unknown>> | null>> = {
  [BuzzTemplateType.PLAYER_SPOTLIGHT]: PlayerSpotlight as unknown as ComponentType<Record<string, unknown>>,
  [BuzzTemplateType.SOLD_PLAYER]: SoldPlayer as unknown as ComponentType<Record<string, unknown>>,
  [BuzzTemplateType.TOP_BUYS]: TopBuys as unknown as ComponentType<Record<string, unknown>>,
  [BuzzTemplateType.TEAM_REVEAL]: TeamReveal as unknown as ComponentType<Record<string, unknown>>,
  [BuzzTemplateType.AUCTION_SUMMARY]: null,
  [BuzzTemplateType.MVP_CARD]: null,
  [BuzzTemplateType.TOURNAMENT_LAUNCH]: null,
} as const;

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Registry Construction                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Canonical Buzz Studio template registry.
 *
 * Each entry is a BuzzTemplateRegistryEntry containing:
 *   - Full metadata (id, title, description, category, enabled, …)
 *   - React component (or null for unbuilt templates)
 *   - Preview metadata
 *
 * Dashboard usage:
 *   const enabled = getEnabledTemplates();
 *
 * Renderer usage:
 *   const entry = getTemplateById(BuzzTemplateType.PLAYER_SPOTLIGHT);
 *   if (entry?.component) {
 *     const Template = entry.component;
 *     return <Template {...contract} />;
 *   }
 */
export const buzzTemplateRegistry: readonly BuzzTemplateRegistryEntry[] =
  ALL_TEMPLATE_METADATA.map((meta) => ({
    ...meta,
    component: COMPONENT_MAP[meta.id],
    preview: TEMPLATE_PREVIEWS[meta.id],
  }));

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper Functions                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Retrieve a single registry entry by its BuzzTemplateType id.
 * Returns undefined if the id is not found (should never happen with
 * the enum, but protects against dynamic string lookups).
 *
 * Renderer pattern:
 *   const entry = getTemplateById(id);
 *   const Template = entry?.component ?? null;
 */
export function getTemplateById(
  id: BuzzTemplateType
): BuzzTemplateRegistryEntry | undefined {
  return buzzTemplateRegistry.find((t) => t.id === id);
}

/**
 * Retrieve all registry entries belonging to a given category.
 * Useful for dashboard section grouping.
 *
 *   const playerTemplates = getTemplatesByCategory(BuzzTemplateCategory.PLAYER);
 */
export function getTemplatesByCategory(
  category: BuzzTemplateCategory
): BuzzTemplateRegistryEntry[] {
  return buzzTemplateRegistry.filter((t) => t.category === category);
}

/**
 * Retrieve all templates that are currently enabled (built and ready to use).
 *
 *   const templates = getEnabledTemplates(); // Dashboard listing
 */
export function getEnabledTemplates(): BuzzTemplateRegistryEntry[] {
  return buzzTemplateRegistry.filter((t) => t.enabled);
}

/**
 * Retrieve all templates that are planned but not yet built.
 *
 *   const soon = getComingSoonTemplates(); // Dashboard "Coming Soon" section
 */
export function getComingSoonTemplates(): BuzzTemplateRegistryEntry[] {
  return buzzTemplateRegistry.filter((t) => t.comingSoon === true);
}

/**
 * Type guard: tests whether an arbitrary string is a valid BuzzTemplateType.
 * Useful for validating query params, API payloads, and route segments.
 *
 *   if (templateExists(queryParam)) {
 *     const entry = getTemplateById(queryParam); // queryParam narrowed
 *   }
 */
export function templateExists(id: string): id is BuzzTemplateType {
  return buzzTemplateRegistry.some((t) => t.id === id);
}
