import { describe, expect, it } from "vitest";
import {
  correctStagingPublicOriginMismatch,
  isProductionBidwarHost,
  isStagingLikeHost,
  resolveRenderExternalOrigin,
  resolveTrustedRequestOrigin,
  stagingProductionUrlConflictError,
} from "../public-origin-guard.js";

describe("isStagingLikeHost", () => {
  it("detects staging hostnames", () => {
    expect(isStagingLikeHost("bidwar-staging.onrender.com")).toBe(true);
    expect(isStagingLikeHost("staging.bidwar.in")).toBe(true);
  });

  it("rejects production hosts", () => {
    expect(isStagingLikeHost("bidwar.in")).toBe(false);
    expect(isStagingLikeHost("www.bidwar.in")).toBe(false);
  });
});

describe("isProductionBidwarHost", () => {
  it("matches apex and www only", () => {
    expect(isProductionBidwarHost("bidwar.in")).toBe(true);
    expect(isProductionBidwarHost("www.bidwar.in")).toBe(true);
    expect(isProductionBidwarHost("bidwar-staging.onrender.com")).toBe(false);
  });
});

describe("resolveRenderExternalOrigin", () => {
  it("prefers RENDER_EXTERNAL_URL", () => {
    expect(
      resolveRenderExternalOrigin({
        RENDER_EXTERNAL_URL: "https://bidwar-staging.onrender.com/",
        RENDER_EXTERNAL_HOSTNAME: "ignored.onrender.com",
      }),
    ).toBe("https://bidwar-staging.onrender.com");
  });

  it("falls back to RENDER_EXTERNAL_HOSTNAME", () => {
    expect(
      resolveRenderExternalOrigin({
        RENDER_EXTERNAL_HOSTNAME: "bidwar-staging.onrender.com",
      }),
    ).toBe("https://bidwar-staging.onrender.com");
  });
});

describe("correctStagingPublicOriginMismatch", () => {
  it("overrides production APP_URL when Render host is staging", () => {
    const result = correctStagingPublicOriginMismatch({
      appUrlOrigin: "https://bidwar.in",
      appHosts: ["bidwar.in", "www.bidwar.in"],
      renderExternalOrigin: "https://bidwar-staging.onrender.com",
    });

    expect(result.publicOrigin).toBe("https://bidwar-staging.onrender.com");
    expect(result.appHosts).toEqual(["bidwar-staging.onrender.com"]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toContain("APP_URL");
  });

  it("overrides production APP_URL when BIDWAR_ENV=staging", () => {
    const result = correctStagingPublicOriginMismatch({
      bidwarEnv: "staging",
      appUrlOrigin: "https://bidwar.in",
      appHosts: ["bidwar.in"],
      renderExternalOrigin: "https://bidwar-staging.onrender.com",
    });

    expect(result.publicOrigin).toBe("https://bidwar-staging.onrender.com");
    expect(result.appHosts).toEqual(["bidwar-staging.onrender.com"]);
  });

  it("does not change a correctly configured staging service", () => {
    const result = correctStagingPublicOriginMismatch({
      bidwarEnv: "staging",
      appUrlOrigin: "https://bidwar-staging.onrender.com",
      appHosts: ["bidwar-staging.onrender.com"],
      renderExternalOrigin: "https://bidwar-staging.onrender.com",
    });

    expect(result.publicOrigin).toBeNull();
    expect(result.appHosts).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("does not override production Render custom domains", () => {
    const result = correctStagingPublicOriginMismatch({
      bidwarEnv: "production",
      appUrlOrigin: "https://bidwar.in",
      appHosts: ["bidwar.in", "www.bidwar.in"],
      // Production services often still have an onrender.com external URL
      renderExternalOrigin: "https://updatedbidwarcore.onrender.com",
    });

    expect(result.publicOrigin).toBeNull();
    expect(result.appHosts).toBeNull();
  });
});

describe("stagingProductionUrlConflictError", () => {
  it("errors when staging still points at bidwar.in", () => {
    expect(
      stagingProductionUrlConflictError({
        bidwarEnv: "staging",
        publicOrigin: "https://bidwar.in",
        appHosts: ["bidwar.in"],
      }),
    ).toMatch(/bidwar\.in/);
  });

  it("returns null for correct staging config", () => {
    expect(
      stagingProductionUrlConflictError({
        bidwarEnv: "staging",
        publicOrigin: "https://bidwar-staging.onrender.com",
        appHosts: ["bidwar-staging.onrender.com"],
      }),
    ).toBeNull();
  });
});

describe("resolveTrustedRequestOrigin", () => {
  it("uses request host when listed in APP_DOMAIN", () => {
    expect(
      resolveTrustedRequestOrigin({
        requestHost: "bidwar-staging.onrender.com",
        appHosts: ["bidwar-staging.onrender.com"],
        publicScheme: "https",
        publicOrigin: "https://bidwar.in",
      }),
    ).toBe("https://bidwar-staging.onrender.com");
  });

  it("falls back to canonical origin for untrusted hosts", () => {
    expect(
      resolveTrustedRequestOrigin({
        requestHost: "evil.example",
        appHosts: ["bidwar-staging.onrender.com"],
        publicScheme: "https",
        publicOrigin: "https://bidwar-staging.onrender.com",
      }),
    ).toBe("https://bidwar-staging.onrender.com");
  });
});
