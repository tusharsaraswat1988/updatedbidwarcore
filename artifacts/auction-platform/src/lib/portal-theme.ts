/**
 * Radix portals mount under document.body, so they lose page-level
 * `.lovable-theme` / `.lovable-home` ancestry. Apply this class on portal
 * content roots so product dialogs, sheets, and menus inherit BidWar tokens.
 *
 * Page chrome (stage gradient + min-height: 100vh) is intentionally NOT applied
 * to portaled nodes — see `lovable-homepage.css` portal overrides. Without that
 * split, Select/Dropdown menus stretch to the full viewport.
 */
export const PORTAL_THEME_CLASS = "lovable-theme dark";
