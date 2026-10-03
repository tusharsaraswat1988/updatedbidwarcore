import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDatabaseUrl, resolveDirectDatabaseUrl } from "@workspace/db/database-url";

describe("Database URL Resolution & Transaction Pooler Bypass", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;
    delete process.env.DIRECT_DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves base database url from DATABASE_URL or NEON_DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@ep-example.neon.tech/neondb";
    expect(resolveDatabaseUrl()).toBe("postgresql://user:pass@ep-example.neon.tech/neondb");

    process.env.NEON_DATABASE_URL = "postgresql://user:pass@ep-neon.neon.tech/neondb";
    expect(resolveDatabaseUrl()).toBe("postgresql://user:pass@ep-neon.neon.tech/neondb");
  });

  it("automatically strips -pooler. from Neon connection string for direct client", () => {
    process.env.DATABASE_URL =
      "postgresql://neondb_owner:s3cret@ep-cool-frost-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    
    // Regular pool gets the pooled URL
    expect(resolveDatabaseUrl()).toBe(
      "postgresql://neondb_owner:s3cret@ep-cool-frost-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    );

    // Direct client (LISTEN / migrator) gets direct compute to bypass PgBouncer transaction mode
    expect(resolveDirectDatabaseUrl()).toBe(
      "postgresql://neondb_owner:s3cret@ep-cool-frost-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    );
  });

  it("respects explicit DIRECT_DATABASE_URL override", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@pooler-host.net/db";
    process.env.DIRECT_DATABASE_URL = "postgresql://user:pass@direct-host.net/db";

    expect(resolveDirectDatabaseUrl()).toBe("postgresql://user:pass@direct-host.net/db");
  });

  it("respects explicit DATABASE_URL_UNPOOLED override", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@pooler-host.net/db";
    process.env.DATABASE_URL_UNPOOLED = "postgresql://user:pass@unpooled-host.net/db";

    expect(resolveDirectDatabaseUrl()).toBe("postgresql://user:pass@unpooled-host.net/db");
  });

  it("preserves non-pooler connection strings unchanged", () => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/bidwar_dev";
    expect(resolveDirectDatabaseUrl()).toBe("postgresql://postgres:postgres@localhost:5432/bidwar_dev");
  });
});
