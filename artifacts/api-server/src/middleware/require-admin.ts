import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME } from "../lib/jwt.js";

function adminAuthDiagnostics(req: Request) {
  const hasAuthCookie = Boolean(req.cookies?.[COOKIE_NAME]);
  const claimKeys = Object.keys(req.jwtUser ?? {});
  const hasJwtClaims = claimKeys.length > 0;
  const isAdmin = Boolean(req.jwtUser?.isAdmin);
  const adminLevel = req.jwtUser?.adminLevel ?? null;

  let reason: "missing_auth_cookie" | "invalid_or_expired_auth_cookie" | "authenticated_but_not_admin" | "ok";
  if (!hasAuthCookie) reason = "missing_auth_cookie";
  else if (!hasJwtClaims) reason = "invalid_or_expired_auth_cookie";
  else if (!isAdmin) reason = "authenticated_but_not_admin";
  else reason = "ok";

  return {
    middleware: "requireAdmin" as const,
    hasAuthCookie,
    hasJwtClaims,
    isAdmin,
    adminLevel,
    claimKeys,
    reason,
    host: req.headers.host ?? null,
    path: req.originalUrl,
  };
}

/** Master or data-entry admin JWT required (`bidwar_auth` cookie with isAdmin). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const diag = adminAuthDiagnostics(req);

  if (!diag.isAdmin) {
    req.log.warn(diag, "requireAdmin blocked request — returning 401 Not authorised");
    res.status(401).json({
      error: "Not authorised",
      middleware: "requireAdmin",
      reason: diag.reason,
      hasAuthCookie: diag.hasAuthCookie,
      isAdmin: false,
      adminLevel: null,
      host: diag.host,
      hint:
        diag.reason === "missing_auth_cookie"
          ? "No bidwar_auth cookie on this request. Log in at /admin/login using the SAME host you call the API with (localhost and 127.0.0.1 are different cookie jars)."
          : diag.reason === "invalid_or_expired_auth_cookie"
            ? "bidwar_auth cookie was sent but JWT verify failed (expired or wrong SESSION_SECRET). Log in again at /admin/login."
            : "You have a session cookie but it is not an admin session (organizer-only). Log in at /admin/login.",
      loginPath: "/admin/login",
      sessionCheckPath: "/api/auth/admin/me",
    });
    return;
  }

  req.log.info(
    { middleware: "requireAdmin", path: diag.path, adminLevel: diag.adminLevel, host: diag.host },
    "requireAdmin allowed request",
  );
  next();
}

/** Super Admin (master) only — platform-internal modules such as Communication Center. */
export function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.jwtUser?.isAdmin || req.jwtUser.adminLevel !== "master") {
    req.log.warn(
      {
        middleware: "requireMasterAdmin",
        path: req.originalUrl,
        isAdmin: Boolean(req.jwtUser?.isAdmin),
        adminLevel: req.jwtUser?.adminLevel ?? null,
        host: req.headers.host ?? null,
      },
      "requireMasterAdmin blocked request",
    );
    res.status(403).json({
      error: "Super Admin access required",
      middleware: "requireMasterAdmin",
    });
    return;
  }
  next();
}
