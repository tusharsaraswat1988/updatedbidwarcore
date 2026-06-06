import {
  API_PREFIX,
  DEFAULT_API_DEV_PORT,
  DEFAULT_AUCTION_DEV_PORT,
  DEFAULT_OWNER_DEV_PORT,
} from "@workspace/api-base";

export type CheckResult = { ok: true } | { ok: false; message: string };

export async function fetchOk(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, text: msg };
  }
}

export function envOr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v || fallback;
}

export function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

export function pass(message: string): void {
  console.log(`✓ ${message}`);
}

export {
  API_PREFIX,
  DEFAULT_API_DEV_PORT,
  DEFAULT_AUCTION_DEV_PORT,
  DEFAULT_OWNER_DEV_PORT,
};
