import { randomBytes } from "crypto";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type StoredChallenge = {
  answer: number;
  guardKey: string;
  expiresAt: number;
};

const challenges = new Map<string, StoredChallenge>();

function pruneChallenges() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expiresAt <= now) challenges.delete(id);
  }
}

export type CaptchaIssue = {
  captchaId: string;
  question: string;
};

export function issueCaptchaChallenge(guardKey: string): CaptchaIssue {
  pruneChallenges();
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const answer = a + b;
  const captchaId = randomBytes(16).toString("hex");
  challenges.set(captchaId, {
    answer,
    guardKey,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return { captchaId, question: `What is ${a} + ${b}?` };
}

export function verifyCaptchaChallenge(
  guardKey: string,
  captchaId: string | undefined,
  captchaAnswer: string | undefined,
): boolean {
  if (!captchaId || captchaAnswer === undefined || captchaAnswer === "") return false;
  pruneChallenges();
  const stored = challenges.get(captchaId);
  if (!stored || stored.guardKey !== guardKey || stored.expiresAt <= Date.now()) {
    return false;
  }
  const parsed = Number.parseInt(String(captchaAnswer).trim(), 10);
  if (!Number.isFinite(parsed) || parsed !== stored.answer) return false;
  challenges.delete(captchaId);
  return true;
}

export async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !token?.trim()) return false;
  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

/** @internal test helper */
export function _clearCaptchaChallengesForTests() {
  challenges.clear();
}
