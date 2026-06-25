import type { NextFunction, Request, Response } from "express";

/**
 * Global kill-switch for all sport scoring modules (cricket, badminton, future sports).
 * Tournament-level enable/disable (`scoringEnabled` on tournaments) is separate.
 *
 * Set `SCORING=true` on the host (Render, etc.). `ENABLE_BADMINTON=true` is still
 * accepted as a legacy alias when `SCORING` is unset.
 */
export function isScoringFeatureEnabled(): boolean {
  const explicit = process.env.SCORING?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.ENABLE_BADMINTON === "true";
}

export function assertScoringFeatureEnabled(): void {
  if (!isScoringFeatureEnabled()) {
    const err = new Error("Scoring is not enabled on this deployment");
    (err as Error & { status: number; code: string }).status = 404;
    (err as Error & { status: number; code: string }).code = "SCORING_DISABLED";
    throw err;
  }
}

export function scoringFeatureMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isScoringFeatureEnabled()) {
    res.status(404).json({
      error: "Scoring is not enabled on this deployment",
      code: "SCORING_DISABLED",
    });
    return;
  }
  next();
}
