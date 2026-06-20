/**
 * Tournament sponsor logos — re-exports from shared priority service.
 * @see @workspace/api-base/sponsor-priority
 */

export {
  SponsorPriorityType,
  brandingService,
  buildSponsorTickerText,
  formatSponsorTickerSegment,
  getPrimarySponsor,
  getSponsorsByPriority,
  normalizeSponsorLogos,
  parseSponsorLogos,
  resolveSponsorPriorityType,
  validateSponsorList,
  SPONSOR_VALIDATION_ERRORS,
} from "@workspace/api-base/sponsor-priority";

export type {
  SponsorLogo,
  PrioritizedSponsor,
  SponsorValidationResult,
} from "@workspace/api-base/sponsor-priority";
