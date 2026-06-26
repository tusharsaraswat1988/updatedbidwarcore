export class ScoringPlatformError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ScoringPlatformError";
  }
}
