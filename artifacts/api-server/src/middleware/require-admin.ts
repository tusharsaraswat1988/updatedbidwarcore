import type { Request, Response, NextFunction } from "express";

/** Master or data-entry admin JWT required. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.jwtUser?.isAdmin) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }
  next();
}

/** Super Admin (master) only — platform-internal modules such as Communication Center. */
export function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.jwtUser?.isAdmin || req.jwtUser.adminLevel !== "master") {
    res.status(403).json({ error: "Super Admin access required" });
    return;
  }
  next();
}
