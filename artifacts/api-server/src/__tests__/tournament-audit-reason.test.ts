import { describe, expect, it } from "vitest";
import {
  defaultTournamentPatchReason,
  resolveAuditReasonWithDefault,
  tournamentConfigFieldsChanged,
  TOURNAMENT_CONFIG_FIELDS,
} from "../lib/audit-reason";

describe("Tournament Audit Reason & Config Detection", () => {
  describe("tournamentConfigFieldsChanged", () => {
    it("identifies registration fields as config fields", () => {
      const updates = {
        registrationDeadline: "2026-10-05",
        registrationLimit: 64,
        name: "BidWar Cup",
      };
      const changed = tournamentConfigFieldsChanged(updates);
      expect(changed).toEqual(["registrationDeadline", "registrationLimit"]);
    });

    it("returns empty array for non-config fields", () => {
      const updates = {
        name: "New Name",
        venue: "Main Ground",
        city: "Delhi",
      };
      const changed = tournamentConfigFieldsChanged(updates);
      expect(changed).toEqual([]);
    });
  });

  describe("defaultTournamentPatchReason", () => {
    it("generates registration-specific reason when only registration fields are updated", () => {
      const reason1 = defaultTournamentPatchReason(["registrationDeadline", "registrationLimit"]);
      expect(reason1).toBe("Organizer dashboard: tournament registration settings updated");

      const reason2 = defaultTournamentPatchReason(["registrationDeadline"]);
      expect(reason2).toBe("Organizer dashboard: tournament registration settings updated");
    });

    it("generates generic settings updated reason when configFields is empty", () => {
      const reason = defaultTournamentPatchReason([]);
      expect(reason).toBe("Organizer dashboard: tournament settings updated");
    });

    it("generates descriptive reason when other config fields are included", () => {
      const reason = defaultTournamentPatchReason(["basePurse", "minBid"]);
      expect(reason).toBe("Organizer dashboard: tournament settings updated (basePurse, minBid)");
    });
  });

  describe("resolveAuditReasonWithDefault", () => {
    it("uses default reason when reason is undefined, null, or empty string", () => {
      const def = defaultTournamentPatchReason(["registrationDeadline"]);
      expect(resolveAuditReasonWithDefault({}, def)).toEqual({
        ok: true,
        reason: "Organizer dashboard: tournament registration settings updated",
      });
      expect(resolveAuditReasonWithDefault({ reason: "" }, def)).toEqual({
        ok: true,
        reason: "Organizer dashboard: tournament registration settings updated",
      });
      expect(resolveAuditReasonWithDefault({ reason: null }, def)).toEqual({
        ok: true,
        reason: "Organizer dashboard: tournament registration settings updated",
      });
    });

    it("uses valid user-provided reason when >= 10 chars", () => {
      const def = defaultTournamentPatchReason(["registrationDeadline"]);
      const custom = "Extended registration by request of team owners";
      expect(resolveAuditReasonWithDefault({ reason: custom }, def)).toEqual({
        ok: true,
        reason: custom,
      });
    });

    it("fails with 400 validation error when reason is too short", () => {
      const def = defaultTournamentPatchReason(["registrationDeadline"]);
      const result = resolveAuditReasonWithDefault({ reason: "short" }, def);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("minimum 10 characters");
      }
    });
  });
});
