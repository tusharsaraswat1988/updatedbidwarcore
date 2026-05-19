import { describe, it, expect } from "vitest";
import { validateExportToken } from "../lib/export-token";

const VALID_TOKEN = "a".repeat(64);
const FUTURE_EXPIRY = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now
const PAST_EXPIRY = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago (past drift window)
const EDGE_EXPIRY = new Date(Date.now() - 4 * 60 * 1000); // 4 min ago (within 5-min drift)

describe("validateExportToken", () => {
  describe("missing token", () => {
    it("returns 401 when header is undefined", () => {
      const result = validateExportToken(undefined, VALID_TOKEN, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 401, reason: "missing_token" });
    });

    it("returns 401 when header is an empty string", () => {
      const result = validateExportToken("", VALID_TOKEN, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 401, reason: "missing_token" });
    });

    it("returns 401 when header is an array (duplicate headers)", () => {
      const result = validateExportToken(["a", "b"], VALID_TOKEN, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 401, reason: "missing_token" });
    });
  });

  describe("no token configured on tournament", () => {
    it("returns 403 when storedToken is null", () => {
      const result = validateExportToken(VALID_TOKEN, null, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 403, reason: "no_token_configured" });
    });

    it("returns 403 when storedToken is undefined", () => {
      const result = validateExportToken(VALID_TOKEN, undefined, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 403, reason: "no_token_configured" });
    });
  });

  describe("invalid token", () => {
    it("returns 403 when tokens do not match", () => {
      const result = validateExportToken("wrong" + "x".repeat(59), VALID_TOKEN, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 403, reason: "invalid_token" });
    });

    it("returns 403 when provided token is shorter than stored", () => {
      const result = validateExportToken("short", VALID_TOKEN, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 403, reason: "invalid_token" });
    });

    it("returns 403 when provided token is longer than stored", () => {
      const result = validateExportToken(VALID_TOKEN + "extra", VALID_TOKEN, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 403, reason: "invalid_token" });
    });
  });

  describe("expired token", () => {
    it("returns 403 when token is expired beyond the 5-minute drift window", () => {
      const result = validateExportToken(VALID_TOKEN, VALID_TOKEN, PAST_EXPIRY);
      expect(result).toMatchObject({ valid: false, status: 403, reason: "token_expired" });
    });

    it("returns valid when token is within the 5-minute clock-drift grace period", () => {
      const result = validateExportToken(VALID_TOKEN, VALID_TOKEN, EDGE_EXPIRY);
      expect(result).toMatchObject({ valid: true });
    });
  });

  describe("valid token", () => {
    it("returns valid when token matches and is not expired", () => {
      const result = validateExportToken(VALID_TOKEN, VALID_TOKEN, FUTURE_EXPIRY);
      expect(result).toMatchObject({ valid: true });
    });

    it("returns valid when token matches and no expiry is set", () => {
      const result = validateExportToken(VALID_TOKEN, VALID_TOKEN, null);
      expect(result).toMatchObject({ valid: true });
    });

    it("returns valid when token matches and expiry is undefined", () => {
      const result = validateExportToken(VALID_TOKEN, VALID_TOKEN, undefined);
      expect(result).toMatchObject({ valid: true });
    });
  });
});
