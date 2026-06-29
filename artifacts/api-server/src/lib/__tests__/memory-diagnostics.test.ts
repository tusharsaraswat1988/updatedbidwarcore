import { describe, expect, it } from "vitest";
import { RSS_WARN_MB, resolveMemoryDiagnosticLog } from "../memory-diagnostics.js";

const RSS_WARN_BYTES = RSS_WARN_MB * 1024 * 1024;
const TEN_MINUTES_MS = 10 * 60_000;

describe("resolveMemoryDiagnosticLog", () => {
  it("logs every tick in development", () => {
    const decision = resolveMemoryDiagnosticLog({
      isProduction: false,
      rssBytes: 100 * 1024 * 1024,
      nowMs: 0,
      lastHeartbeatMs: 0,
    });
    expect(decision.shouldLog).toBe(true);
    expect(decision.level).toBe("info");
  });

  it("warns in development when RSS is high", () => {
    const decision = resolveMemoryDiagnosticLog({
      isProduction: false,
      rssBytes: RSS_WARN_BYTES + 1,
      nowMs: 0,
      lastHeartbeatMs: 0,
    });
    expect(decision.shouldLog).toBe(true);
    expect(decision.level).toBe("warn");
  });

  it("does not log every minute in production when RSS is normal", () => {
    const decision = resolveMemoryDiagnosticLog({
      isProduction: true,
      rssBytes: 200 * 1024 * 1024,
      nowMs: 60_000,
      lastHeartbeatMs: 0,
    });
    expect(decision.shouldLog).toBe(false);
  });

  it("warns in production when RSS exceeds threshold", () => {
    const decision = resolveMemoryDiagnosticLog({
      isProduction: true,
      rssBytes: RSS_WARN_BYTES + 1,
      nowMs: 60_000,
      lastHeartbeatMs: 0,
    });
    expect(decision.shouldLog).toBe(true);
    expect(decision.level).toBe("warn");
    expect(decision.message).toContain(String(RSS_WARN_MB));
  });

  it("emits heartbeat every 10 minutes in production", () => {
    const decision = resolveMemoryDiagnosticLog({
      isProduction: true,
      rssBytes: 200 * 1024 * 1024,
      nowMs: TEN_MINUTES_MS,
      lastHeartbeatMs: 0,
    });
    expect(decision.shouldLog).toBe(true);
    expect(decision.level).toBe("info");
    expect(decision.message).toBe("Memory diagnostics heartbeat");
  });
});
