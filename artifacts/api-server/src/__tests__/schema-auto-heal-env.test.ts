import { afterEach, describe, expect, it } from "vitest";
import {
  assertEnvironmentDatabaseIsolation,
  gateAutoHealForDatabase,
  isProductionDatabaseUrl,
  isStagingDatabaseUrl,
  resolveAutoHealEnabled,
  resolveEffectiveAutoHeal,
  resolveEnvironment,
  resolveSchemaBootTimeoutMs,
  withTimeout,
  DEFAULT_SCHEMA_BOOT_TIMEOUT_MS,
} from "@workspace/db/schema-governance";

const ENV_KEYS = [
  "SCHEMA_AUTO_HEAL",
  "BIDWAR_ENV",
  "NODE_ENV",
  "APP_DOMAIN",
  "APP_URL",
  "SCHEMA_BOOT_TIMEOUT_MS",
  "DATABASE_URL",
  "NEON_DATABASE_URL",
  "NEON_PRODUCTION_HOST_MARKERS",
  "NEON_STAGING_HOST_MARKERS",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

const PROD_URL =
  "postgresql://u:p@ep-late-math-aohd4iep-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const STAGING_URL =
  "postgresql://u:p@ep-long-sky-aorboyzr-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const LOCAL_URL =
  "postgresql://u:p@ep-hidden-band-aogw7hho-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

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
    expect(resolveEffectiveAutoHeal(undefined, STAGING_URL)).toBe(true);
  });

  it("enables auto-heal when APP_DOMAIN looks like staging (Render staging)", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_DOMAIN = "bidwar-staging.onrender.com";
    process.env.APP_URL = "https://bidwar-staging.onrender.com";

    expect(resolveEnvironment()).toBe("staging");
    expect(resolveEffectiveAutoHeal(undefined, STAGING_URL)).toBe(true);
  });

  it("keeps validate-only for true production hosts", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.APP_URL = "https://bidwar.in";

    expect(resolveEnvironment()).toBe("production");
    expect(resolveEffectiveAutoHeal(undefined, PROD_URL)).toBe(false);
  });

  it("honors SCHEMA_AUTO_HEAL=false even on staging", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "staging";
    process.env.SCHEMA_AUTO_HEAL = "false";

    expect(resolveEffectiveAutoHeal(undefined, STAGING_URL)).toBe(false);
  });

  it("never heals production Neon even if SCHEMA_AUTO_HEAL=true", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.SCHEMA_AUTO_HEAL = "true";

    expect(resolveAutoHealEnabled()).toBe(true);
    expect(resolveEffectiveAutoHeal(undefined, PROD_URL)).toBe(false);
    expect(gateAutoHealForDatabase(true, PROD_URL)).toBe(false);
  });

  it("enables local auto-heal against non-production Neon", () => {
    clearEnv();
    process.env.NODE_ENV = "development";
    process.env.BIDWAR_ENV = "local";

    expect(resolveEffectiveAutoHeal(undefined, LOCAL_URL)).toBe(true);
  });
});

describe("DATABASE_URL isolation (separate Neon per env)", () => {
  stashEnv();
  afterEach(() => {
    clearEnv();
    restoreEnv();
  });

  it("classifies production and staging hosts", () => {
    expect(isProductionDatabaseUrl(PROD_URL)).toBe(true);
    expect(isStagingDatabaseUrl(PROD_URL)).toBe(false);
    expect(isStagingDatabaseUrl(STAGING_URL)).toBe(true);
    expect(isProductionDatabaseUrl(STAGING_URL)).toBe(false);
    expect(isProductionDatabaseUrl(LOCAL_URL)).toBe(false);
  });

  it("refuses staging/local when DATABASE_URL is production Neon", () => {
    expect(() => assertEnvironmentDatabaseIsolation("staging", PROD_URL)).toThrow(
      /isolation breach/,
    );
    expect(() => assertEnvironmentDatabaseIsolation("local", PROD_URL)).toThrow(
      /isolation breach/,
    );
    expect(() => assertEnvironmentDatabaseIsolation("development", PROD_URL)).toThrow(
      /isolation breach/,
    );
  });

  it("refuses production when DATABASE_URL is staging Neon", () => {
    expect(() => assertEnvironmentDatabaseIsolation("production", STAGING_URL)).toThrow(
      /isolation breach/,
    );
  });

  it("allows matching env↔database pairs", () => {
    expect(() => assertEnvironmentDatabaseIsolation("production", PROD_URL)).not.toThrow();
    expect(() => assertEnvironmentDatabaseIsolation("staging", STAGING_URL)).not.toThrow();
    expect(() => assertEnvironmentDatabaseIsolation("local", LOCAL_URL)).not.toThrow();
  });
});

describe("schema boot timeouts", () => {
  stashEnv();
  afterEach(() => {
    clearEnv();
    restoreEnv();
  });

  it("defaults SCHEMA_BOOT_TIMEOUT_MS to 90s", () => {
    clearEnv();
    expect(resolveSchemaBootTimeoutMs()).toBe(DEFAULT_SCHEMA_BOOT_TIMEOUT_MS);
  });

  it("rejects hanging work via withTimeout", async () => {
    await expect(
      withTimeout(new Promise(() => {}), 50, "timed out for test"),
    ).rejects.toThrow("timed out for test");
  });
});
