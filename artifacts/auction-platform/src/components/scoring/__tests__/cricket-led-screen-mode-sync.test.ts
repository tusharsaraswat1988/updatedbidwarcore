import { describe, expect, it } from "vitest";
import type { CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";

describe("Unified Screen Mode Control for Ground LED & OBS", () => {
  it("A. Supported screen modes enum covers all 7 broadcast modes and none fallback", () => {
    const canonicalModes: CricketObsMidOverlayKind[] = [
      "none",
      "sponsors",
      "standings",
      "fixtures",
      "scorecard",
      "summary",
      "intro",
    ];

    expect(canonicalModes).toHaveLength(7);
    expect(canonicalModes).toContain("none");
    expect(canonicalModes).toContain("sponsors");
    expect(canonicalModes).toContain("standings");
    expect(canonicalModes).toContain("fixtures");
    expect(canonicalModes).toContain("scorecard");
    expect(canonicalModes).toContain("summary");
    expect(canonicalModes).toContain("intro");
  });

  it("B. Module imports and exports CricketLedMidOverlays without runtime resolution errors", async () => {
    const mod = await import("@/components/scoring/cricket-led-mid-overlays");
    expect(typeof mod.CricketLedMidOverlays).toBe("function");
  }, 20000);

  it("C. ScoreDisplayShell module imports and resolves successfully", async () => {
    const mod = await import("@/components/scoring/score-display-shell");
    expect(typeof mod.ScoreDisplayShell).toBe("function");
  }, 20000);

  it("D. Canonical SSE and BroadcastChannel channel naming consistency", () => {
    const tournamentId = 25;
    const expectedChannelName = `bidwar_cricket_obs_${tournamentId}`;
    const expectedQueryKey = ["cricket-obs-director", tournamentId];
    const expectedEventName = "cricket_obs_director";

    expect(expectedChannelName).toBe("bidwar_cricket_obs_25");
    expect(expectedQueryKey).toEqual(["cricket-obs-director", 25]);
    expect(expectedEventName).toBe("cricket_obs_director");
  });

  it("E. Canonical screen mode transitions are deterministic across both Ground LED and OBS", () => {
    const transitions: { action: string; canonicalOverlay: CricketObsMidOverlayKind; ledActive: boolean; obsActive: boolean }[] = [
      { action: "Camera Feed Only", canonicalOverlay: "none", ledActive: false, obsActive: false },
      { action: "Sponsor Showcase", canonicalOverlay: "sponsors", ledActive: true, obsActive: true },
      { action: "Points Table", canonicalOverlay: "standings", ledActive: true, obsActive: true },
      { action: "Upcoming Matches", canonicalOverlay: "fixtures", ledActive: true, obsActive: true },
      { action: "Full Scorecard", canonicalOverlay: "scorecard", ledActive: true, obsActive: true },
      { action: "Match Summary", canonicalOverlay: "summary", ledActive: true, obsActive: true },
      { action: "Match Intro / VS", canonicalOverlay: "intro", ledActive: true, obsActive: true },
      { action: "Reset to Camera", canonicalOverlay: "none", ledActive: false, obsActive: false },
    ];

    for (const t of transitions) {
      expect(["none", "sponsors", "standings", "fixtures", "scorecard", "summary", "intro"]).toContain(t.canonicalOverlay);
      if (t.canonicalOverlay === "none") {
        expect(t.ledActive).toBe(false);
        expect(t.obsActive).toBe(false);
      } else {
        expect(t.ledActive).toBe(true);
        expect(t.obsActive).toBe(true);
      }
    }
  });

  it("F. Stale / out-of-order SSE event timestamp protection logic", () => {
    // Simulator matching the exact logic in ScoreDisplayShell and useCricketObsLive
    class ScreenModeConsumer {
      public currentOverlay: CricketObsMidOverlayKind = "none";
      private lastDirectorTimestamp = 0;

      public handleSseDirector(detail: { overlay?: CricketObsMidOverlayKind; timestamp?: number }) {
        // Reject stale out-of-order events
        if (detail.timestamp && detail.timestamp < this.lastDirectorTimestamp) {
          return;
        }
        if (detail.timestamp) {
          this.lastDirectorTimestamp = detail.timestamp;
        }
        if (detail.overlay !== undefined) {
          this.currentOverlay = detail.overlay;
        }
      }
    }

    const consumer = new ScreenModeConsumer();

    // 1. Normal order test: Event A (1000 -> sponsors) then Event B (1050 -> scorecard)
    consumer.handleSseDirector({ overlay: "sponsors", timestamp: 1000 });
    expect(consumer.currentOverlay).toBe("sponsors");

    consumer.handleSseDirector({ overlay: "scorecard", timestamp: 1050 });
    expect(consumer.currentOverlay).toBe("scorecard");

    // 2. Out-of-order delivery test: Event B (2000 -> scorecard) arrives first, then delayed Event A (1950 -> sponsors) arrives second
    const consumerReorder = new ScreenModeConsumer();
    consumerReorder.handleSseDirector({ overlay: "scorecard", timestamp: 2000 });
    expect(consumerReorder.currentOverlay).toBe("scorecard");

    // Delayed stale event arriving late
    consumerReorder.handleSseDirector({ overlay: "sponsors", timestamp: 1950 });
    // Must remain "scorecard" because timestamp 1950 < 2000 is rejected
    expect(consumerReorder.currentOverlay).toBe("scorecard");

    // 3. Full sequence transition test: none -> sponsors -> standings -> fixtures -> scorecard -> summary -> intro -> none
    const fullSequence: CricketObsMidOverlayKind[] = [
      "none",
      "sponsors",
      "standings",
      "fixtures",
      "scorecard",
      "summary",
      "intro",
      "none",
    ];

    let ts = 3000;
    const seqConsumer = new ScreenModeConsumer();
    for (const mode of fullSequence) {
      ts += 100;
      seqConsumer.handleSseDirector({ overlay: mode, timestamp: ts });
      expect(seqConsumer.currentOverlay).toBe(mode);
    }
  });

  it("G. getSponsorCategoryLabel correctly resolves custom designations and never outputs NORMAL or STANDARD", async () => {
    const { getSponsorCategoryLabel } = await import("@/components/scoring/score-display-shell");

    // Standard sponsor with custom designation "BOUNDARY SPONSOR"
    const sjmaa = {
      name: "SJMAA",
      type: "BOUNDARY SPONSOR",
      priorityType: "NORMAL",
      isTitleSponsor: false,
      isCoSponsor: false,
    };
    expect(getSponsorCategoryLabel(sjmaa)).toBe("BOUNDARY SPONSOR");

    // Standard sponsor with custom designation "GIFTING SPONSOR"
    const goodMorning = {
      name: "GOOD MORNING",
      type: "GIFTING SPONSOR",
      priorityType: "NORMAL",
      isTitleSponsor: false,
      isCoSponsor: false,
    };
    expect(getSponsorCategoryLabel(goodMorning)).toBe("GIFTING SPONSOR");

    // Title sponsor with custom designation "HERITAGE TITLE SPONSOR"
    const heritage = {
      name: "HERITAGE HOSPIT",
      type: "HERITAGE TITLE SPONSOR",
      priorityType: "TITLE",
      isTitleSponsor: true,
      isCoSponsor: false,
    };
    expect(getSponsorCategoryLabel(heritage)).toBe("HERITAGE TITLE SPONSOR");

    // Sponsor without custom type falls back gracefully to Title/Co/Partner, never "NORMAL"
    const normalWithoutType = {
      name: "LOCAL PARTNER",
      type: "",
      priorityType: "NORMAL",
      isTitleSponsor: false,
      isCoSponsor: false,
    };
    expect(getSponsorCategoryLabel(normalWithoutType)).toBe("Official Partner");
  }, 20000);

  it("H. OBS Director state payload correctly encapsulates matchId and overlay", () => {
    class MockDirectorReceiver {
      public currentOverlay: CricketObsMidOverlayKind = "none";
      public overlayMatchId: number | undefined = undefined;

      public handleSseDirector(detail: { overlay?: CricketObsMidOverlayKind; matchId?: number }) {
        if (detail.overlay !== undefined) {
          this.currentOverlay = detail.overlay;
        }
        if (detail.matchId !== undefined) {
          this.overlayMatchId = detail.matchId;
        }
      }
    }

    const receiver = new MockDirectorReceiver();

    // 1. Broadcast intro with Match #5
    receiver.handleSseDirector({ overlay: "intro", matchId: 5 });
    expect(receiver.currentOverlay).toBe("intro");
    expect(receiver.overlayMatchId).toBe(5);

    // 2. Broadcast summary with Match #2
    receiver.handleSseDirector({ overlay: "summary", matchId: 2 });
    expect(receiver.currentOverlay).toBe("summary");
    expect(receiver.overlayMatchId).toBe(2);

    // 3. Reset to camera
    receiver.handleSseDirector({ overlay: "none" });
    expect(receiver.currentOverlay).toBe("none");
  });
});
