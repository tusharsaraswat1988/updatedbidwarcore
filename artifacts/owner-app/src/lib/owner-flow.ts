/**
 * Owner-app onboarding — re-exports shared helpers so behaviour stays identical
 * to mobile-app (single source of truth in @workspace/api-base/owner-onboarding).
 */
export {
  type OwnerOnboardingEntry,
  type OwnerDeepLink,
  type OwnerFlowStep,
  type MobileSubmitResult,
  ONBOARDING_ENTRIES_KEY,
  parseOwnerDeepLink,
  saveOnboardingEntries,
  loadOnboardingEntries,
  clearOnboardingEntries,
  lookupOwnerTeams,
  resolveAfterMobileLookup,
  ownerDashboardRoute,
  submitOwnerMobile,
} from "@workspace/api-base/owner-onboarding";
