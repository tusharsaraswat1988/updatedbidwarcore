import type { Request } from "express";
import {
  issueCaptchaChallenge,
  verifyCaptchaChallenge,
  verifyTurnstileToken,
  type CaptchaIssue,
} from "./captcha-challenge";

export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_CAPTCHA_THRESHOLD = 5;
export const LOGIN_COOLDOWN_THRESHOLD = 10;
export const LOGIN_COOLDOWN_MS = 90 * 1000;

export type LoginGuardTier = "normal" | "captcha" | "cooldown";

export type LoginGuardStatus = {
  tier: LoginGuardTier;
  failures: number;
  cooldownRemainingSec: number;
  captchaRequired: boolean;
  captcha?: CaptchaIssue;
  turnstileSiteKey?: string;
};

type AttemptEntry = {
  failures: number;
  cooldownUntil: number | null;
  lastActivity: number;
};

const attempts = new Map<string, AttemptEntry>();

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function normalizeLoginIdentifier(identifier: string): string {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;
  return trimmed.replace(/\s+/g, "");
}

export function buildLoginGuardKey(req: Request, identifier: string): string {
  const ip = getClientIp(req);
  const normalized = normalizeLoginIdentifier(identifier);
  return `${ip}|${normalized || "__empty__"}`;
}

function freshEntry(now: number): AttemptEntry {
  return { failures: 0, cooldownUntil: null, lastActivity: now };
}

function getEntry(key: string, now = Date.now()): AttemptEntry {
  const existing = attempts.get(key);
  if (!existing) return freshEntry(now);
  if (now - existing.lastActivity > LOGIN_FAILURE_WINDOW_MS) {
    return freshEntry(now);
  }
  if (existing.cooldownUntil !== null && now >= existing.cooldownUntil) {
    return { ...existing, cooldownUntil: null, lastActivity: now };
  }
  return existing;
}

function saveEntry(key: string, entry: AttemptEntry) {
  attempts.set(key, entry);
}

function cooldownRemainingSec(entry: AttemptEntry, now = Date.now()): number {
  if (!entry.cooldownUntil || now >= entry.cooldownUntil) return 0;
  return Math.ceil((entry.cooldownUntil - now) / 1000);
}

function resolveTier(entry: AttemptEntry, now = Date.now()): LoginGuardTier {
  if (entry.failures >= LOGIN_COOLDOWN_THRESHOLD && cooldownRemainingSec(entry, now) > 0) {
    return "cooldown";
  }
  if (entry.failures >= LOGIN_CAPTCHA_THRESHOLD) return "captcha";
  return "normal";
}

export function getLoginGuardStatus(
  req: Request,
  identifier: string,
  options?: { includeCaptcha?: boolean },
): LoginGuardStatus {
  const now = Date.now();
  const key = buildLoginGuardKey(req, identifier);
  const entry = getEntry(key, now);
  const tier = resolveTier(entry, now);
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY?.trim() || undefined;
  const captchaRequired = tier === "captcha" || (tier === "cooldown" && entry.failures >= LOGIN_CAPTCHA_THRESHOLD);

  const status: LoginGuardStatus = {
    tier,
    failures: entry.failures,
    cooldownRemainingSec: cooldownRemainingSec(entry, now),
    captchaRequired: captchaRequired && tier !== "cooldown",
    turnstileSiteKey,
  };

  if (options?.includeCaptcha && status.captchaRequired && !turnstileSiteKey) {
    status.captcha = issueCaptchaChallenge(key);
  }

  return status;
}

export type LoginGuardBlock =
  | { allowed: true }
  | {
      allowed: false;
      status: number;
      error: string;
      guard: LoginGuardStatus;
    };

export async function checkLoginAttemptAllowed(
  req: Request,
  identifier: string,
  captcha?: {
    turnstileToken?: string;
    captchaId?: string;
    captchaAnswer?: string;
  },
): Promise<LoginGuardBlock> {
  const now = Date.now();
  const key = buildLoginGuardKey(req, identifier);
  const entry = getEntry(key, now);
  const remaining = cooldownRemainingSec(entry, now);

  if (entry.failures >= LOGIN_COOLDOWN_THRESHOLD && remaining > 0) {
    const guard = getLoginGuardStatus(req, identifier);
    return {
      allowed: false,
      status: 429,
      error: `Too many failed attempts. Try again in ${remaining} seconds.`,
      guard,
    };
  }

  if (entry.failures >= LOGIN_CAPTCHA_THRESHOLD) {
    const turnstileOk = await verifyTurnstileToken(captcha?.turnstileToken);
    const mathOk = verifyCaptchaChallenge(key, captcha?.captchaId, captcha?.captchaAnswer);
    if (!turnstileOk && !mathOk) {
      const guard = getLoginGuardStatus(req, identifier, { includeCaptcha: true });
      return {
        allowed: false,
        status: 400,
        error: "Please complete the security check before signing in.",
        guard,
      };
    }
  }

  return { allowed: true };
}

export function recordLoginFailure(req: Request, identifier: string): LoginGuardStatus {
  const now = Date.now();
  const key = buildLoginGuardKey(req, identifier);
  const entry = getEntry(key, now);
  entry.failures += 1;
  entry.lastActivity = now;
  if (entry.failures >= LOGIN_COOLDOWN_THRESHOLD) {
    entry.cooldownUntil = now + LOGIN_COOLDOWN_MS;
  }
  saveEntry(key, entry);
  return getLoginGuardStatus(req, identifier, {
    includeCaptcha: entry.failures >= LOGIN_CAPTCHA_THRESHOLD && entry.failures < LOGIN_COOLDOWN_THRESHOLD,
  });
}

export function clearLoginFailures(req: Request, identifier: string) {
  const key = buildLoginGuardKey(req, identifier);
  attempts.delete(key);
}

/** @internal test helper */
export function _resetLoginAttemptsForTests() {
  attempts.clear();
}
