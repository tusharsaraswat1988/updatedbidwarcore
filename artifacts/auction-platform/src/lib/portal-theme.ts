/**
 * Dynamic Portal Theme Resolver
 *
 * Radix portals mount under document.body, so they lose page-level
 * `.bw-organizer-light` or `.lovable-theme` ancestry.
 *
 * This helper dynamically resolves the proper theme class so organiser
 * dialogs, sheets, selects, popovers, and menus inherit crisp light mode,
 * while protected surfaces (OBS, LED, homepage, operator console, scorer live pad)
 * preserve their dark broadcast theme.
 */

export function isOrganizerRoute(pathname?: string): boolean {
  if (typeof window === "undefined") return false;
  const p = pathname ?? window.location.pathname;

  // 1. Explicitly protected routes remain dark:
  if (
    p === "/" ||
    p.startsWith("/bpl") ||
    (p.includes("/auction") && !p.includes("/auction-overview") && !p.includes("/auction-tips")) ||
    p.includes("/obs") ||
    p.includes("/display") ||
    p.includes("/side-display") ||
    p.includes("/score-display") ||
    p.startsWith("/live") ||
    p.startsWith("/fan") ||
    p.startsWith("/fanpage") ||
    p.includes("/register") ||
    p === "/scoring-app/login" ||
    p.includes("/scorer") ||
    (p.includes("/score/") && p.includes("/live"))
  ) {
    return false;
  }

  // 2. Explicitly in-scope organiser routes:
  if (
    p === "/organizer" ||
    p.startsWith("/organizer/") ||
    p === "/tournament/new" ||
    p.startsWith("/scoring-app/tournament/") ||
    /^\/tournament\/\d+(\/|$)/.test(p)
  ) {
    return true;
  }

  // 3. Fallback: check DOM for active organiser surface
  if (typeof document !== "undefined" && document.querySelector('[data-surface="organizer"], .bw-organizer-light')) {
    return true;
  }

  return false;
}

export function getPortalThemeClass(pathname?: string): string {
  return isOrganizerRoute(pathname) ? "bw-organizer-light" : "lovable-theme dark";
}

/**
 * Backward compatibility: dynamically returns the active portal theme class
 * via valueOf / toString coercion, and as a fallback string.
 */
export const PORTAL_THEME_CLASS = {
  toString() {
    return getPortalThemeClass();
  },
  valueOf() {
    return getPortalThemeClass();
  },
  [Symbol.toPrimitive]() {
    return getPortalThemeClass();
  },
} as unknown as string;
