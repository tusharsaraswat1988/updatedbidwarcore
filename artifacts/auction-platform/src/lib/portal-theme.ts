/**
 * Radix portals mount under document.body, so they lose page-level
 * `.lovable-theme` / `.lovable-home` ancestry. Apply this class on portal
 * content roots so product dialogs, sheets, and menus inherit BidWar tokens.
 */
export const PORTAL_THEME_CLASS = "lovable-theme dark";
