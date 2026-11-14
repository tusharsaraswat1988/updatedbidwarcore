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
  let p = pathname ?? window.location.pathname;
  if (p.startsWith("/scoring-app")) {
    p = p.slice("/scoring-app".length) || "/";
  }

  // 1. Explicitly protected surfaces & public marketing pages remain dark:
  if (
    p === "" ||
    p === "/" ||
    p === "/pricing" ||
    p === "/contact" ||
    p === "/legal" ||
    p.startsWith("/legal/") ||
    p === "/auction-tips" ||
    p === "/upcoming-auctions" ||
    p === "/academy" ||
    p.startsWith("/academy/") ||
    p === "/blog" ||
    p.startsWith("/blog/") ||
    p.endsWith("-software") ||
    p.endsWith("-platform") ||
    p.endsWith("-system") ||
    p.endsWith("-bidding") ||
    p.endsWith("-auction") ||
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
    p === "/login" ||
    p === "/scoring-app/login" ||
    p.includes("/scorer") ||
    (p.includes("/score/") && p.includes("/live")) ||
    p.includes("/overlay") ||
    p === "/admin" ||
    p.startsWith("/admin/")
  ) {
    return false;
  }

  // 2. Explicitly in-scope organiser routes:
  if (
    p === "/organizer" ||
    p.startsWith("/organizer/") ||
    p === "/tournament/new" ||
    /^\/tournament\/\d+(\/|$)/.test(p) ||
    /^\/cricket\/\d+(\/|$)/.test(p) ||
    /^\/badminton\/\d+(\/|$)/.test(p)
  ) {
    return true;
  }

  // 3. Fallback: check DOM content inside #root for active organiser surface
  // (strictly inside #root so it never matches html or body itself)
  if (typeof document !== "undefined" && document.querySelector('#root [data-surface="organizer"], #root .bw-organizer-light')) {
    return true;
  }

  return false;
}

export function isAdminRoute(pathname?: string): boolean {
  if (typeof window === "undefined") return false;
  let p = pathname ?? window.location.pathname;
  if (p === "/admin/login") return false; // Admin Login is isolated luxury canvas
  return p === "/admin" || p.startsWith("/admin/");
}

export function syncDocumentSurfaceTheme(pathname?: string): void {
  if (typeof document === "undefined") return;
  const isOrg = isOrganizerRoute(pathname);
  const isAdmin = isAdminRoute(pathname);

  if (isOrg) {
    document.documentElement.classList.add("bw-organizer-light");
    document.documentElement.setAttribute("data-surface", "organizer");
    document.body.classList.add("bw-organizer-light");
    document.body.setAttribute("data-surface", "organizer");

    document.documentElement.classList.remove("bw-admin-dark");
    document.body.classList.remove("bw-admin-dark");
  } else if (isAdmin) {
    document.documentElement.classList.remove("bw-organizer-light");
    document.body.classList.remove("bw-organizer-light");

    document.documentElement.classList.add("bw-admin-dark", "dark");
    document.documentElement.setAttribute("data-surface", "admin");
    document.body.classList.add("bw-admin-dark", "dark");
    document.body.setAttribute("data-surface", "admin");
  } else {
    document.documentElement.classList.remove("bw-organizer-light", "bw-admin-dark");
    document.documentElement.removeAttribute("data-surface");
    document.body.classList.remove("bw-organizer-light", "bw-admin-dark");
    document.body.removeAttribute("data-surface");
  }
}

export function getPortalThemeClass(pathname?: string): string {
  if (isOrganizerRoute(pathname)) return "bw-organizer-light";
  if (isAdminRoute(pathname)) return "bw-admin-dark dark";
  return "lovable-theme dark";
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
