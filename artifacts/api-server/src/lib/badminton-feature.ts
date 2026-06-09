/** Global kill-switch for badminton APIs. Tournament sport guards still apply per request. */
export function isBadmintonFeatureEnabled(): boolean {
  return process.env.ENABLE_BADMINTON === "true";
}

export function assertBadmintonFeatureEnabled(): void {
  if (!isBadmintonFeatureEnabled()) {
    const err = new Error("Badminton is not enabled on this deployment");
    (err as Error & { status: number; code: string }).status = 404;
    (err as Error & { status: number; code: string }).code = "BADMINTON_DISABLED";
    throw err;
  }
}
