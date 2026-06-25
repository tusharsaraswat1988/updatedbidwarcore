/**
 * Buzz Studio — Registry Types
 *
 * Core type definitions for the template registry layer.
 *
 * Dependency hierarchy (no circular imports):
 *   registry-types → template-types → (nothing)
 *   registry-types → template-categories → (nothing)
 *
 * BuzzTemplateDefinition   — pure metadata, safe to serialise, no React dependency
 * BuzzTemplatePreview      — preview metadata for dashboard display
 * BuzzTemplateRegistryEntry — extends Definition + binds the React component
 *
 * The renderer uses BuzzTemplateRegistryEntry to resolve the component
 * without any switch statement:
 *
 *   const entry = getTemplateById(id);
 *   if (entry?.component) return <entry.component {...contract} />;
 */

import type { ComponentType } from "react";
import type { BuzzTemplateType } from "./template-types";
import type { BuzzTemplateCategory } from "./template-categories";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  BuzzTemplateDefinition                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Pure metadata record for a single Buzz Studio template.
 * No React imports. Safe to use in SSR, edge, and non-browser contexts.
 */
export interface BuzzTemplateDefinition {
  /** Canonical identifier — matches BuzzTemplateType enum. */
  id: BuzzTemplateType;

  /** Human-readable display name used in the dashboard. */
  title: string;

  /**
   * One-sentence description of this template's purpose.
   * Shown in dashboard template picker.
   */
  description: string;

  /** Primary category for filtering and grouping. */
  category: BuzzTemplateCategory;

  /**
   * Whether this template is built and ready for use.
   * Only PLAYER_SPOTLIGHT is currently enabled.
   */
  enabled: boolean;

  /**
   * Present and true for templates planned but not yet built.
   * Dashboard uses this to show a "Coming Soon" badge.
   */
  comingSoon?: boolean;

  /**
   * Supported output aspect ratios.
   * Renderer uses this list to know which canvas sizes to produce.
   * Example values: "1:1", "9:16", "16:9", "4:5"
   */
  aspectRatios: string[];

  /**
   * Name of the contract interface consumed by this template.
   * Used for documentation, dashboard hints, and future codegen.
   * Example: "PlayerSpotlightContract"
   */
  contractName: string;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  BuzzTemplatePreview                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Preview metadata for a template.
 * Currently metadata-only — no image assets.
 * Future: previewImage will hold a static PNG path or data-URL.
 */
export interface BuzzTemplatePreview {
  templateId: BuzzTemplateType;

  /**
   * Optional path to a static preview image.
   * Undefined until the template has a generated preview asset.
   */
  previewImage?: string;

  /**
   * Display title for the preview card.
   * Defaults to the template title if omitted.
   */
  previewTitle?: string;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  BuzzTemplateRegistryEntry                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * A fully-hydrated registry entry: metadata + React component + preview.
 *
 * This is what the renderer and dashboard consume.
 * `component` is null for templates that are not yet built.
 *
 * Renderer pattern (no switch statement needed):
 *
 *   const entry = getTemplateById(BuzzTemplateType.PLAYER_SPOTLIGHT);
 *   if (entry?.component) {
 *     const Template = entry.component;
 *     return <Template {...contract} />;
 *   }
 */
export interface BuzzTemplateRegistryEntry extends BuzzTemplateDefinition {
  /**
   * The React component for this template.
   * null   = template is planned but not yet built (comingSoon: true).
   * Typed as ComponentType<Record<string, unknown>> at the registry boundary;
   * callers narrow the type via the contract before rendering.
   */
  component: ComponentType<Record<string, unknown>> | null;

  /** Preview metadata for dashboard display. */
  preview: BuzzTemplatePreview;
}
