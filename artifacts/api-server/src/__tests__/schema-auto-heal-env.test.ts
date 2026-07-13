import { afterEach, describe, expect, it } from "vitest";
import {
  assertEnvironmentDatabaseIsolation,
  classifyDatabaseRole,
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
  "NEON_PRODUCTION_HOST_ALLOWLIST",
  "NEON_STAGING_HOST_ALLOWLIST",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

const PROD_URL =
  "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
const STAGING_URL =
  "postgresql://u:p@ep-staging-example-pooler.example.neon.tech/neondb?sslmode=require";
const LOCAL_URL =
  "postgresql://u:p@ep-local-example-pooler.example.neon.tech/neondb?sslmode=require";

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

function withAllowLists() {
  process.env.NEON_PRODUCTION_HOST_ALLOWLIST = "ep-prod-example";
  process.env.NEON_STAGING_HOST_ALLOWLIST = "ep-staging-example";
}

describe("resolveEnvironment / resolveAutoHealEnabled", () => {
  stashEnv();
  afterEach(() => {
    clearEnv();
    restoreEnv();
  });

  it("enables auto-heal for BIDWAR_ENV=staging even when NODE_ENV=production", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "staging";
    process.env.APP_DOMAIN = "example.com";
    process.env.APP_URL = "https://example.com";

    expect(resolveEnvironment()).toBe("staging");
    expect(resolveAutoHealEnabled()).toBe(true);
    expect(resolveEffectiveAutoHeal(undefined, STAGING_URL)).toBe(true);
  });

  it("enables auto-heal when APP_DOMAIN looks like staging", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_DOMAIN = "app-staging.onrender.com";
    process.env.APP_URL = "https://app-staging.onrender.com";

    expect(resolveEnvironment()).toBe("staging");
    expect(resolveEffectiveAutoHeal(undefined, STAGING_URL)).toBe(true);
  });

  it("keeps validate-only when BIDWAR_ENV/production heuristics say production", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "production";
    process.env.APP_DOMAIN = "example.com";
    process.env.APP_URL = "https://example.com";

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

  it("blocks heal against production allow-list even if SCHEMA_AUTO_HEAL=true", () => {
    clearEnv();
    withAllowLists();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "staging";
    process.env.SCHEMA_AUTO_HEAL = "true";

    expect(resolveAutoHealEnabled()).toBe(true);
    expect(resolveEffectiveAutoHeal(undefined, PROD_URL)).toBe(false);
    expect(gateAutoHealForDatabase(true, PROD_URL)).toBe(false);
  });

  it("allows heal when no production allow-list is configured", () => {
    clearEnv();
    process.env.NODE_ENV = "development";
    process.env.BIDWAR_ENV = "local";
    process.env.SCHEMA_AUTO_HEAL = "true";

    // Without allow-list, host fingerprints are not consulted.
    expect(classifyDatabaseRole(PROD_URL)).toBe("unclassified");
    expect(resolveEffectiveAutoHeal(undefined, PROD_URL)).toBe(true);
  });

  it("enables local auto-heal", () => {
    clearEnv();
    process.env.NODE_ENV = "development";
    process.env.BIDWAR_ENV = "local";

    expect(resolveEffectiveAutoHeal(undefined, LOCAL_URL)).toBe(true);
  });
});

describe("optional DATABASE_URL allow-list isolation", () => {
  stashEnv();
  afterEach(() => {
    clearEnv();
    restoreEnv();
  });

  it("skips host checks when allow-lists are unset", () => {
    clearEnv();
    expect(classifyDatabaseRole(PROD_URL)).toBe("unclassified");
    expect(isProductionDatabaseUrl(PROD_URL)).toBe(false);
    expect(isStagingDatabaseUrl(STAGING_URL)).toBe(false);
    expect(() => assertEnvironmentDatabaseIsolation("staging", PROD_URL)).not.toThrow();
    expect(() => assertEnvironmentDatabaseIsolation("production", STAGING_URL)).not.toThrow();
  });

  it("classifies hosts only when allow-lists are set", () => {
    clearEnv();
    withAllowLists();
    expect(isProductionDatabaseUrl(PROD_URL)).toBe(true);
    expect(isStagingDatabaseUrl(STAGING_URL)).toBe(true);
    expect(isProductionDatabaseUrl(STAGING_URL)).toBe(false);
    expect(classifyDatabaseRole(LOCAL_URL)).toBe("other");
  });

  it("refuses staging/local when DATABASE_URL matches production allow-list", () => {
    clearEnv();
    withAllowLists();
    expect(() => assertEnvironmentDatabaseIsolation("staging", PROD_URL)).toThrow(
      /isolation breach/,
    );
    expect(() => assertEnvironmentDatabaseIsolation("local", PROD_URL)).toThrow(
      /isolation breach/,
    );
  });

  it("refuses production when DATABASE_URL matches staging allow-list", () => {
    clearEnv();
    withAllowLists();
    expect(() => assertEnvironmentDatabaseIsolation("production", STAGING_URL)).toThrow(
      /isolation breach/,
    );
  });

  it("requires production/staging URLs to be on their allow-lists when configured", () => {
    clearEnv();
    withAllowLists();
    expect(() => assertEnvironmentDatabaseIsolation("production", LOCAL_URL)).toThrow(
      /not on NEON_PRODUCTION_HOST_ALLOWLIST/,
    );
    expect(() => assertEnvironmentDatabaseIsolation("staging", LOCAL_URL)).toThrow(
      /not on NEON_STAGING_HOST_ALLOWLIST/,
    );
    expect(() => assertEnvironmentDatabaseIsolation("production", PROD_URL)).not.toThrow();
    expect(() => assertEnvironmentDatabaseIsolation("staging", STAGING_URL)).not.toThrow();
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
