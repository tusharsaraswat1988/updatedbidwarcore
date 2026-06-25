import type { Request, Response, NextFunction } from "express";

/** Master or data-entry admin JWT required. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.jwtUser?.isAdmin) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }
  next();
}
