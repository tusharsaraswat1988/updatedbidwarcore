import { describe, expect, it } from "vitest";
import {
  coerceScoringModePlayerStatus,
  isAuctionPlayerRegistration,
  isScoringPlayerRegistration,
  parsePlayerRegistrationMode,
  parseRegistrationCategoryMode,
  publicRegistrationCategoryIdPayload,
  resolvePlayerRosterAssignmentType,
  resolvePublicRegistrationBidFields,
  shouldAcceptPublicCategoryId,
  shouldAcceptPublicRegistrationCategoryId,
  shouldShowOrganizerCategoryControls,
  shouldShowPublicCategorySelect,
} from "@workspace/api-base/player-registration-mode";

describe("player registration mode", () => {
  it("defaults unknown values to auction", () => {
    expect(parsePlayerRegistrationMode(null)).toBe("auction");
    expect(parsePlayerRegistrationMode(undefined)).toBe("auction");
    expect(parsePlayerRegistrationMode("individual")).toBe("auction");
    expect(parsePlayerRegistrationMode("scoring")).toBe("scoring");
    expect(isScoringPlayerRegistration("scoring")).toBe(true);
    expect(isAuctionPlayerRegistration("scoring")).toBe(false);
  });

  it("parses category policy without inventing age groups", () => {
    expect(parseRegistrationCategoryMode(null)).toBe("hidden");
    expect(parseRegistrationCategoryMode("player_select")).toBe("player_select");
    expect(parseRegistrationCategoryMode("organizer_assign")).toBe("organizer_assign");
    expect(shouldShowPublicCategorySelect("hidden")).toBe(false);
    expect(shouldShowPublicCategorySelect("organizer_assign")).toBe(false);
    expect(shouldShowPublicCategorySelect("player_select")).toBe(true);
    expect(shouldAcceptPublicCategoryId("player_select")).toBe(true);
    expect(shouldAcceptPublicCategoryId("organizer_assign")).toBe(false);
  });

  it("keeps auction public categoryId accepted for backward compatibility", () => {
    expect(shouldAcceptPublicRegistrationCategoryId("auction", "hidden")).toBe(true);
    expect(shouldAcceptPublicRegistrationCategoryId("scoring", "hidden")).toBe(false);
    expect(shouldAcceptPublicRegistrationCategoryId("scoring", "player_select")).toBe(true);
    expect(shouldAcceptPublicRegistrationCategoryId("scoring", "organizer_assign")).toBe(false);
  });

  it("shows organizer category controls except when hidden", () => {
    expect(shouldShowOrganizerCategoryControls("hidden")).toBe(false);
    expect(shouldShowOrganizerCategoryControls("player_select")).toBe(true);
    expect(shouldShowOrganizerCategoryControls("organizer_assign")).toBe(true);
  });

  it("clears category only when the caller sends explicit null", () => {
    expect(publicRegistrationCategoryIdPayload(false, "12")).toBeUndefined();
    expect(publicRegistrationCategoryIdPayload(true, "")).toBeNull();
    expect(publicRegistrationCategoryIdPayload(true, "7")).toBe(7);
  });

  it("prevents scoring-mode assignment from creating an auction sold state", () => {
    expect(coerceScoringModePlayerStatus("sold", "available")).toBe("available");
    expect(resolvePlayerRosterAssignmentType({
      registrationMode: "scoring",
      requestedStatus: "sold",
      existingStatus: "available",
      existingTeamId: null,
      nextTeamId: 4,
    })).toBe("transfer");
    expect(resolvePlayerRosterAssignmentType({
      registrationMode: "auction",
      requestedStatus: "sold",
      existingStatus: "available",
      existingTeamId: null,
      nextTeamId: 4,
    })).toBe("unsold_replacement");
  });

  it("skips auction bid assignment in scoring mode", () => {
    const scoring = resolvePublicRegistrationBidFields(
      "scoring",
      { minBid: 250000, bidValueMode: "player", bidValueOptions: "[500,1000]" },
      { selectedBidValue: 500 },
    );
    expect(scoring.ok).toBe(true);
    if (scoring.ok) {
      expect(scoring.fields.basePrice).toBe(250000);
      expect(scoring.fields.selectedBidValue).toBeNull();
      expect(scoring.fields.bidValueSource).toBe("system");
    }
  });

  it("keeps player-selected bid values in auction mode", () => {
    const auction = resolvePublicRegistrationBidFields(
      "auction",
      { minBid: 100000, bidValueMode: "player", bidValueOptions: "[500,1000]" },
      { selectedBidValue: 500 },
    );
    expect(auction.ok).toBe(true);
    if (auction.ok) {
      expect(auction.fields.basePrice).toBe(500);
      expect(auction.fields.selectedBidValue).toBe(500);
      expect(auction.fields.bidValueSource).toBe("player");
    }
  });
});
