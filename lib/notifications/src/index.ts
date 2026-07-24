/**
 * @workspace/notifications — platform notifications domain (scaffold).
 *
 * Dispatch/providers currently live in api-server (`lib/notifications`) due to
 * Express/runtime coupling. This package is the public domain home; move the
 * service here in a follow-up once runtime-env/logger are injectable.
 */

export type NotificationDomain = "platform" | "auction" | "sport";

/** Placeholder so the package is a real domain target, not an empty container. */
export const NOTIFICATIONS_DOMAIN = "platform" as const;
