import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { logger } from "./logger";

const disabled = process.env.RATE_LIMIT_DISABLED === "true";
const isDev = process.env.NODE_ENV !== "production";

function authLimit(): number {
  const configured = Number(process.env.RATE_LIMIT_AUTH_MAX ?? 100);
  return isDev ? Math.max(configured, 500) : configured;
}

/**
 * Returns true for auction-related endpoints that must NEVER be rate-limited.
 *
 * Auction operations run at 2-3 requests/second per bidder, with polling on
 * 4+ screens every 1 second. Any rate limit here would freeze a live auction.
 * Admin PATCH edits on players/teams are also time-critical during bidding.
 */
export function isAuctionEndpoint(req: Request): boolean {
  const p = req.path;
  return (
    p.includes("/auction") ||
    p.includes("/owner/") ||
    p.includes("/display") ||
    p.includes("/cheer") ||
    (req.method === "PATCH" && p.includes("/players/")) ||
    (req.method === "PATCH" && p.includes("/teams/"))
  );
}

/** Auth routes use dedicated tier-2 limiters — skip the global catch-all. */
export function isAuthEndpoint(req: Request): boolean {
  return req.path.includes("/auth/");
}

function onLimitReached(req: Request, _res: Response, limitName: string) {
  logger.warn(
    { method: req.method, path: req.path, ip: req.ip },
    `rate-limit: ${limitName} exceeded`,
  );
}

/**
 * TIER 1 — Global catch-all (2500 req / 15 min per IP).
 * Skips auction and auth endpoints — those have dedicated limiters.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL_MAX ?? 2500),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => disabled || isAuctionEndpoint(req) || isAuthEndpoint(req),
  message: { error: "Too many requests, please try again later." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "global");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * TIER 2 — Auth / login endpoints (100 attempts / 15 min per IP; 500 in dev).
 * Applied directly to admin login, organizer login, and account login routes.
 * Prevents brute-force credential stuffing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authLimit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many login attempts, please try again in 15 minutes." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "auth");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * OTP send limiter (3 requests / 5 min per IP).
 * Tighter than auth because each send triggers a paid Twilio SMS.
 */
export const otpSendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_OTP_SEND_MAX ?? 8),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many OTP requests, please wait 5 minutes." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "otp-send");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * OTP verify limiter (10 attempts / 15 min per IP).
 * Prevents brute-forcing 6-digit OTP codes.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_OTP_VERIFY_MAX ?? 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many verification attempts, please try again in 15 minutes." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "otp-verify");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * TIER 3 — Heavy DB operations: export (5 req / 15 min per IP).
 * Export builds a full tournament snapshot — expensive query.
 */
export const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_EXPORT_MAX ?? 5),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many export requests, please try again later." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "export");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * TIER 3 — Heavy DB operations: reports / search (10 req / 15 min per IP).
 */
export const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many requests, please try again later." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "heavy");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Cheer limiter (30 req / min per IP).
 * Audience cheers are fun but not critical — light cap to prevent spam.
 */
export const cheerLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_CHEER_MAX ?? 30),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Slow down on the cheering!" },
  handler(req, res, next, options) {
    onLimitReached(req, res, "cheer");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Push-subscribe limiter (5 subscriptions / 10 min per IP).
 * Each call writes a DB row; prevent device/endpoint spam from
 * unauthenticated callers.
 */
export const pushSubscribeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PUSH_SUBSCRIBE_MAX ?? 5),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many subscription requests, please try again later." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "push-subscribe");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Owner onboarding lookup (15 req / 15 min per IP).
 * Read-only but exposes which tournaments a mobile is registered in.
 */
export const ownerLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_OWNER_LOOKUP_MAX ?? 15),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many lookup attempts, please try again in 15 minutes." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "owner-lookup");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Tournament insights limiter (30 req / 15 min per IP).
 * Responses are cached server-side; this prevents LLM cost abuse.
 */
export const insightsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_INSIGHTS_MAX ?? 30),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many insight requests, please try again later." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "insights");
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Public Contact Us form limiter (8 submits / 15 min per IP).
 * Keeps inquiry inbox usable and blocks automated spam bursts.
 */
export const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_CONTACT_MAX ?? 8),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: "Too many contact requests, please try again later." },
  handler(req, res, next, options) {
    onLimitReached(req, res, "contact-form");
    res.status(options.statusCode).json(options.message);
  },
});
