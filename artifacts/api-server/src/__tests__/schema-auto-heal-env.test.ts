import { afterEach, describe, expect, it } from "vitest";
import {
  resolveAutoHealEnabled,
  resolveEnvironment,
} from "@workspace/db/schema-governance";

const ENV_KEYS = [
  "SCHEMA_AUTO_HEAL",
  "BIDWAR_ENV",
  "NODE_ENV",
  "APP_DOMAIN",
  "APP_URL",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("resolveEnvironment / resolveAutoHealEnabled (staging Render)", () => {
  stashEnv();
  afterEach(() => {
    clearEnv();
    restoreEnv();
  });

  it("enables auto-heal for BIDWAR_ENV=staging even when NODE_ENV=production", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "staging";
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.APP_URL = "https://bidwar.in";

    expect(resolveEnvironment()).toBe("staging");
    expect(resolveAutoHealEnabled()).toBe(true);
  });

  it("enables auto-heal when APP_DOMAIN looks like staging (Render staging)", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_DOMAIN = "bidwar-staging.onrender.com";
    process.env.APP_URL = "https://bidwar-staging.onrender.com";

    expect(resolveEnvironment()).toBe("staging");
    expect(resolveAutoHealEnabled()).toBe(true);
  });

  it("keeps validate-only for true production hosts", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.APP_URL = "https://bidwar.in";

    expect(resolveEnvironment()).toBe("production");
    expect(resolveAutoHealEnabled()).toBe(false);
  });

  it("honors SCHEMA_AUTO_HEAL=false even on staging", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "staging";
    process.env.SCHEMA_AUTO_HEAL = "false";

    expect(resolveAutoHealEnabled()).toBe(false);
  });

  it("honors SCHEMA_AUTO_HEAL=true even on production", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.SCHEMA_AUTO_HEAL = "true";

    expect(resolveAutoHealEnabled()).toBe(true);
  });
});
