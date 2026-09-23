import { describe, expect, it, vi } from "vitest";
import {
  classifyGlobalPlayer,
  classifyOrganizer,
  classifyScorerAccount,
  classifyScoringOfficial,
  classifyTeamOwner,
} from "@workspace/db/identity-linking";
import {
  calculateNameSimilarity,
  isGenericName,
  isPlaceholderMobile,
  normalizeEmail,
  normalizeMobile,
  normalizeName,
} from "@workspace/db/identity-linking";
import {
  runIdentityLinkingDryRun,
  rollbackIdentityLinkingRun,
} from "@workspace/db/identity-linking";

describe("Phase 5D — High-Confidence Identity Linking & Safe Backfill", () => {
  describe("1. Normalization & Identity Signal Safeguards", () => {
    it("correctly normalizes 10-digit Indian mobiles and strips prefixes", () => {
      expect(normalizeMobile("+91 98765 43210")).toBe("9876543210");
      expect(normalizeMobile("09876543210")).toBe("9876543210");
      expect(normalizeMobile("919876543210")).toBe("9876543210");
      expect(normalizeMobile("9876543210")).toBe("9876543210");
    });

    it("identifies placeholder and dummy phone numbers", () => {
      expect(isPlaceholderMobile("0000000000")).toBe(true);
      expect(isPlaceholderMobile("1111111111")).toBe(true);
      expect(isPlaceholderMobile("1234567890")).toBe(true);
      expect(isPlaceholderMobile("9876543210")).toBe(true);
      expect(isPlaceholderMobile("9820123456")).toBe(false);
    });

    it("identifies generic and placeholder names", () => {
      expect(isGenericName("Player 1")).toBe(true);
      expect(isGenericName("guest")).toBe(true);
      expect(isGenericName("test user")).toBe(true);
      expect(isGenericName("Rahul Sharma")).toBe(false);
      expect(isGenericName("PV Sindhu")).toBe(false);
    });

    it("calculates name similarity accurately", () => {
      expect(calculateNameSimilarity("Rahul Sharma", "Rahul Sharma")).toBe(1.0);
      expect(calculateNameSimilarity("Rahul Sharma", "Rahul")).toBeGreaterThan(0.4);
      expect(calculateNameSimilarity("Rahul Sharma", "Vikram Singh")).toBe(0.0);
    });
  });

  describe("2. Identity Classifier Rules", () => {
    it("promotes verified phone organizer to Category A", () => {
      const org = classifyOrganizer({
        id: 1,
        name: "Sunil Verma",
        mobile: "9820011223",
        phoneVerified: true,
        passwordHash: "hash_123",
      });
      expect(org.category).toBe("CATEGORY_A");
      expect(org.reasons[0]).toMatch(/Verified mobile/);
    });

    it("relegates unverified organizer without credentials to Category B (Review Required)", () => {
      const org = classifyOrganizer({
        id: 2,
        name: "Ramesh Gupta",
        mobile: "9820099887",
        phoneVerified: false,
        passwordHash: null,
      });
      expect(org.category).toBe("CATEGORY_B");
      expect(org.reasons[0]).toMatch(/human review/);
    });

    it("relegates generic name organizer to Category C (Unresolved)", () => {
      const org = classifyOrganizer({
        id: 3,
        name: "Test Admin",
        mobile: "9820099887",
        phoneVerified: true,
      });
      expect(org.category).toBe("CATEGORY_C");
      expect(org.reasons[0]).toMatch(/Generic/);
    });

    it("promotes active credentialed scorer account to Category A", () => {
      const scorer = classifyScorerAccount({
        id: 10,
        name: "Amit Kumar",
        mobile: "9811122233",
        pinHash: "pin_hash_456",
        isActive: true,
      });
      expect(scorer.category).toBe("CATEGORY_A");
      expect(scorer.reasons[0]).toMatch(/Active credentialed scorer/);
    });

    it("promotes authoritative global player with linked tournament rows to Category A", () => {
      const gp = classifyGlobalPlayer({
        id: "gp_101",
        canonicalName: "Deepak Chahar",
        mobileNumber: "9833344455",
        hasLinkedTournamentRows: true,
      });
      expect(gp.category).toBe("CATEGORY_A");
      expect(gp.reasons[0]).toMatch(/Authoritative master player/);
    });

    it("relegates global player without linked tournament rows to Category B", () => {
      const gp = classifyGlobalPlayer({
        id: "gp_102",
        canonicalName: "Unlinked Player",
        mobileNumber: "9833344455",
        hasLinkedTournamentRows: false,
      });
      expect(gp.category).toBe("CATEGORY_B");
    });

    it("NEVER auto-promotes scoring officials to Category A (Always Category B)", () => {
      const official = classifyScoringOfficial({
        id: 50,
        tournamentId: 10,
        name: "Official Raj",
        mobile: "9811122233",
        role: "scorer",
      });
      expect(official.category).toBe("CATEGORY_B");
    });

    it("NEVER auto-promotes team owner historical records to Category A (Always Category B)", () => {
      const owner = classifyTeamOwner({
        id: 70,
        tournamentId: 10,
        ownerName: "Owner Singhania",
        ownerMobile: "9877788899",
      });
      expect(owner.category).toBe("CATEGORY_B");
    });
  });

  describe("3. Dry-Run Engine Simulation & Collision Protection", () => {
    it("executes dry-run analysis producing proposed entities and zero database writes", async () => {
      // Mock pool query response
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("member_identity_links")) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes("FROM organizers")) {
            return Promise.resolve({
              rows: [
                {
                  id: 1,
                  name: "Vikram Malhotra",
                  mobile: "9820012345",
                  email: "vikram@example.com",
                  phone_verified: true,
                  password_hash: "pass_hash",
                  google_id: null,
                },
              ],
            });
          }
          if (sql.includes("FROM scorer_accounts")) {
            return Promise.resolve({
              rows: [
                {
                  id: 101,
                  name: "Scorer Nitin",
                  mobile: "9830012345",
                  pin_hash: "pin_123",
                  is_active: true,
                },
              ],
            });
          }
          if (sql.includes("FROM global_players")) {
            return Promise.resolve({
              rows: [
                {
                  id: "gp_991",
                  canonical_name: "Rahul Verma",
                  first_name: "Rahul",
                  last_name: "Verma",
                  mobile_number: "9840012345",
                  email: "rahul@example.com",
                  dob: "1995-05-10",
                  gender: "M",
                  country: "IND",
                  state: "UP",
                  city: "Varanasi",
                  sport: "cricket",
                  handedness: "R",
                  photo_url: null,
                  photo_public_id: null,
                },
              ],
            });
          }
          if (sql.includes("FROM players")) {
            return Promise.resolve({
              rows: [
                {
                  id: 501,
                  tournament_id: 10,
                  name: "Rahul Verma",
                  mobile_number: "9840012345",
                  email: "rahul@example.com",
                  global_player_id: "gp_991",
                  role: "All-rounder",
                  team_id: 5,
                  jersey_number: "7",
                },
              ],
            });
          }
          if (sql.includes("FROM badminton_players")) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes("FROM scoring_officials")) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes("FROM teams")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as any;

      const dryRun = await runIdentityLinkingDryRun(mockPool);

      expect(dryRun.mode).toBe("dry_run");
      expect(dryRun.stats.totalSourceRecords).toBe(3);
      expect(dryRun.stats.categoryACount).toBe(3);
      expect(dryRun.stats.categoryBCount).toBe(0);
      expect(dryRun.stats.categoryCCount).toBe(0);
      expect(dryRun.stats.proposedNewMembers).toBe(3);

      // Roles
      expect(dryRun.proposedRoles).toHaveLength(3);
      expect(dryRun.proposedRoles.map((r) => r.role)).toEqual(["organizer", "scorer", "player"]);

      // Sport Profile for Cricket
      expect(dryRun.proposedSportProfiles).toHaveLength(1);
      expect(dryRun.proposedSportProfiles[0]!.sportSlug).toBe("cricket");

      // Tournament Participation for Cricket Player 501
      expect(dryRun.proposedParticipations).toHaveLength(1);
      expect(dryRun.proposedParticipations[0]!.tournamentId).toBe(10);
      expect(dryRun.proposedParticipations[0]!.role).toBe("player");

      // Identity links: 1 organizer + 1 scorer + 1 global player + 1 cricket player = 4 links
      expect(dryRun.proposedLinks).toHaveLength(4);
      expect(dryRun.proposedLinks.every((l) => l.confidenceScore === 100)).toBe(true);
    });

    it("detects cross-source contact collision (same number with conflicting names) and downgrades to Category C", async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("member_identity_links")) return Promise.resolve({ rows: [] });
          if (sql.includes("FROM organizers")) {
            return Promise.resolve({
              rows: [
                {
                  id: 1,
                  name: "Sunil Sharma",
                  mobile: "9820011111",
                  phone_verified: true,
                  password_hash: "hash",
                },
              ],
            });
          }
          if (sql.includes("FROM scorer_accounts")) {
            return Promise.resolve({
              rows: [
                {
                  id: 2,
                  name: "Pooja Gupta", // Completely different person sharing same mobile number!
                  mobile: "9820011111",
                  pin_hash: "hash",
                  is_active: true,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as any;

      const dryRun = await runIdentityLinkingDryRun(mockPool);

      expect(dryRun.collisions).toHaveLength(1);
      expect(dryRun.collisions[0]!.conflictType).toBe("name_mismatch_same_contact");
      expect(dryRun.stats.categoryACount).toBe(0); // Downgraded from Category A
      expect(dryRun.stats.categoryCCount).toBe(2);
      expect(dryRun.stats.proposedNewMembers).toBe(0); // No member created for ambiguous collision
    });
  });

  describe("4. Idempotency & Rollback Isolation", () => {
    it("reuses existing member ID when an identity link already exists", async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("member_identity_links")) {
            return Promise.resolve({
              rows: [
                {
                  source_table: "organizers",
                  source_record_id: "1",
                  member_id: "mem_existing_001",
                  status: "active",
                },
              ],
            });
          }
          if (sql.includes("FROM organizers")) {
            return Promise.resolve({
              rows: [
                {
                  id: 1,
                  name: "Vikram Malhotra",
                  mobile: "9820012345",
                  phone_verified: true,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as any;

      const dryRun = await runIdentityLinkingDryRun(mockPool);

      expect(dryRun.stats.proposedNewMembers).toBe(0); // Reused existing
      expect(dryRun.stats.reusedExistingMembers).toBe(1);
      expect(dryRun.proposedLinks[0]!.memberId).toBe("mem_existing_001");
    });

    it("verifies rollback targets only records with matching migrationRunId", async () => {
      const clientQuery = vi.fn().mockResolvedValue({ rowCount: 5 });
      const mockPool = {
        connect: vi.fn().mockResolvedValue({
          query: clientQuery,
          release: vi.fn(),
        }),
      } as any;

      const res = await rollbackIdentityLinkingRun(mockPool, "run_5d_test_123");
      expect(res.deletedMembers).toBe(5);
      expect(res.deletedLinks).toBe(5);
    });
  });
});
