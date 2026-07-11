export type UnlockReason = "finally" | "timeout" | "success" | "watchdog";

export type TimelineKind =
  | "bid_attempt"
  | "bid_blocked"
  | "http_ack"
  | "http_409"
  | "sse_bid"
  | "stale_http_rejected"
  | "bidGateLocked"
  | "canBid"
  | "isLeading"
  | "owner_phase"
  | "unlock"
  | "permanent_lock"
  | "invariant";

export type TimelineEvent = {
  t: number;
  kind: TimelineKind;
  teamId?: number;
  detail?: string;
  eventVersion?: number;
  httpAckAt?: number;
  sseAt?: number;
  value?: boolean | string | number | null;
  unlockReason?: UnlockReason;
};

export class Timeline {
  readonly events: TimelineEvent[] = [];
  firstPermanentLock: TimelineEvent | null = null;

  record(event: TimelineEvent): void {
    this.events.push(event);
    if (event.kind === "permanent_lock" && !this.firstPermanentLock) {
      this.firstPermanentLock = event;
    }
  }

  sliceAround(t: number, windowMs = 2_000): TimelineEvent[] {
    return this.events.filter((e) => Math.abs(e.t - t) <= windowMs);
  }

  toMarkdown(): string {
    const lines = [
      "| t (ms) | kind | team | version | value | detail |",
      "|-------:|------|-----:|--------:|-------|--------|",
    ];
    for (const e of this.events) {
      lines.push(
        `| ${e.t} | ${e.kind} | ${e.teamId ?? ""} | ${e.eventVersion ?? ""} | ${
          e.value ?? e.unlockReason ?? ""
        } | ${(e.detail ?? "").replace(/\|/g, "/")} |`,
      );
    }
    return lines.join("\n");
  }
}
