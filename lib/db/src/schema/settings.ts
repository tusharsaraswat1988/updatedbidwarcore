import { pgTable, text } from "drizzle-orm/pg-core";

/**
 * Generic key/value settings table for platform-level configuration.
 * Keys are plain strings; values are text (JSON-encode complex values).
 *
 * Current keys:
 *   installer_url         — Windows installer download URL (GitHub Releases etc.)
 *   installer_version     — e.g. "1.0.0"
 *   installer_released_at — ISO date string e.g. "2026-05-19"
 *   admin_session_lock_minutes — Super Admin idle lock timeout (1–120, default 2)
 *   default_countdown_sound_url — Platform default countdown tick for all tournaments
 *   default_sold_sound_url — Platform default sold fanfare for all tournaments
 *   default_break_end_sound_url — Platform default break-end chime for all tournaments
 */
export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});
