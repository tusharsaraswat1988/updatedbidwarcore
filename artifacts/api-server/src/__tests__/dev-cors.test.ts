import { describe, expect, it } from "vitest";
import {
  isCorsOriginAllowed,
  isDevLocalhostOrigin,
} from "@workspace/api-base/dev-cors";

describe("isDevLocalhostOrigin", () => {
  it("accepts localhost and 127.0.0.1 on any port", () => {
    expect(isDevLocalhostOrigin("http://localhost:3000")).toBe(true);
    expect(isDevLocalhostOrigin("http://localhost:24755")).toBe(true);
    expect(isDevLocalhostOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(isDevLocalhostOrigin("http://localhost")).toBe(true);
  });

  it("rejects non-loopback and https", () => {
    expect(isDevLocalhostOrigin("https://localhost:3000")).toBe(false);
    expect(isDevLocalhostOrigin("http://evil.localhost:3000")).toBe(false);
    expect(isDevLocalhostOrigin("http://192.168.1.1:3000")).toBe(false);
  });
});

describe("isCorsOriginAllowed", () => {
  const allowlist = ["https://bidwar.in"];

  it("allows dev loopback only when not production", () => {
    expect(
      isCorsOriginAllowed("http://localhost:24755", allowlist, {
        isProduction: false,
      }),
    ).toBe(true);
    expect(
      isCorsOriginAllowed("http://localhost:24755", allowlist, {
        isProduction: true,
      }),
    ).toBe(false);
  });

  it("allows explicit production origins", () => {
    expect(
      isCorsOriginAllowed("https://bidwar.in", allowlist, {
        isProduction: true,
      }),
    ).toBe(true);
  });
});
