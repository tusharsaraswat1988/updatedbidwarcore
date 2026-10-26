import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveBuildInfo } from "../resolve-build-info";

describe("resolveBuildInfo", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BIDWAR_GIT_SHA;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.RENDER_GIT_COMMIT;
    delete process.env.RENDER_GIT_COMMIT_SHA;
    delete process.env.BIDWAR_BUILD_TIMESTAMP;
    delete process.env.RENDER_GIT_COMMIT_TIMESTAMP;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves commit SHA from RAILWAY_GIT_COMMIT_SHA", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "abcdef1234567890abcdef1234567890abcdef12";
    const info = resolveBuildInfo();
    expect(info.commitSha).toBe("abcdef1234567890abcdef1234567890abcdef12");
    expect(info.commitShaShort).toBe("abcdef1");
    expect(info.source).toBe("railway_env");
  });
});
