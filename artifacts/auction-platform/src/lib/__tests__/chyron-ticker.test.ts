import { describe, expect, it } from "vitest";
import {
  CHYRON_TICKER_PX_PER_SEC,
  chyronTickerDurationFromWidth,
  chyronTickerContentKey,
} from "./chyron-ticker";

describe("chyronTickerDurationFromWidth", () => {
  it("scales duration with content width for constant px/s", () => {
    expect(chyronTickerDurationFromWidth(1100)).toBeCloseTo(1100 / CHYRON_TICKER_PX_PER_SEC, 5);
    expect(chyronTickerDurationFromWidth(2200)).toBeCloseTo(2200 / CHYRON_TICKER_PX_PER_SEC, 5);
  });

  it("clamps extreme durations", () => {
    expect(chyronTickerDurationFromWidth(100)).toBe(15);
    expect(chyronTickerDurationFromWidth(10000)).toBe(90);
  });
});

describe("chyronTickerContentKey", () => {
  it("changes when sponsor identity changes", () => {
    const a = chyronTickerContentKey([{ name: "BPL", logoUrl: "/a.png", tier: "title" }]);
    const b = chyronTickerContentKey([{ name: "Jio", logoUrl: "/b.png", tier: "normal" }]);
    expect(a).not.toBe(b);
  });
});
