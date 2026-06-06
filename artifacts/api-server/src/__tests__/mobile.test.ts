import { describe, expect, it } from "vitest";
import { parseIndianMobile, sanitizeMobileInput, mobilesMatch } from "@workspace/api-base/mobile";

describe("parseIndianMobile", () => {
  it("rejects letters", () => {
    expect(parseIndianMobile("98abc7654321").ok).toBe(false);
    expect(parseIndianMobile("abcdefghij").ok).toBe(false);
  });

  it("accepts valid 10-digit numbers", () => {
    const r = parseIndianMobile("9876543210");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe("9876543210");
  });

  it("normalizes +91 prefix", () => {
    const r = parseIndianMobile("+91 9876543210");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe("9876543210");
  });

  it("rejects invalid starting digit", () => {
    expect(parseIndianMobile("5876543210").ok).toBe(false);
  });
});

describe("mobilesMatch", () => {
  it("matches equivalent formats", () => {
    expect(mobilesMatch("9876543210", "+91 9876543210")).toBe(true);
    expect(mobilesMatch("9876543210", "9876543211")).toBe(false);
  });
});

describe("sanitizeMobileInput", () => {
  it("strips non-digits", () => {
    expect(sanitizeMobileInput("98ab76-54 32")).toBe("98765432");
  });
});
