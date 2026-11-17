/**
 * Canonical re-export of timezone-safe spectator date and time formatters.
 */
export {
  formatFanDate as formatTournamentDate,
  formatFanTime as formatTournamentTime,
  formatFanDateTime as formatTournamentDateTime,
  formatFanDateRange as formatTournamentDateRange,
  formatFanStatus,
  DEFAULT_TIMEZONE as DEFAULT_PLATFORM_TIMEZONE,
} from "./fan-date-utils";
