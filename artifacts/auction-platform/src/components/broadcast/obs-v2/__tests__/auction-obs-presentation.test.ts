import { describe, expect, it } from "vitest";
import type { Player, TeamPurse } from "@workspace/api-client-react";
import { parsePresentationContext } from "@/lib/presentation-context";
import { BroadcastDirector } from "../../director/broadcast-director";
import type { BroadcastFrame as DirectorFrame, DirectorContext } from "../../director/types";
import { DEFAULT_BROADCAST_SETTINGS } from "../../types";
import { adaptAuctionToBroadcastFrame } from "../auction-v2-adapter";

function player(partial: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    status: "sold",
    role: "Batsman",
    basePrice: 100000,
    soldPrice: 0,
    teamId: null,
    photoUrl: null,
    ...partial,
  } as Player;
}

function purse(partial: Partial<TeamPurse> & Pick<TeamPurse, "teamId" | "teamName">): TeamPurse {
  return {
    shortCode: partial.teamName.slice(0, 3).toUpperCase(),
    purseRemaining: 1_000_000,
    playersBought: 0,
    maximumSquadSize: 8,
    color: "#facc15",
    logoUrl: null,
    maxAllowedBid: 1_000_000,
    ...partial,
  } as TeamPurse;
}

function directorContext(overrides: Partial<DirectorContext> = {}): DirectorContext {
  return {
    tournamentId: 9,
    outputTarget: "obs",
    tournamentName: "BidWar Premier League",
    tournamentLogoUrl: null,
    auctionStartsAt: null,
    sponsorLogos: [],
    settings: DEFAULT_BROADCAST_SETTINGS,
    isObsMode: true,
    isStaleFeed: false,
    formatAmount: (n) => String(n),
    resolvePhotoSrc: () => null,
    auctionStatus: "active",
    currentPlayerId: 41,
    currentBid: 1_200_000,
    currentBidTeamId: 1,
    currentBidTeamName: "Blazing Titans",
    currentBidTeamColor: "#ef4444",
    currentBidTeamLogoUrl: null,
    timerEndsAt: "2026-10-17T12:00:30.000Z",
    remainingPlayersCount: 6,
    currentCategoryName: "Gold",
    playerName: "Rahul Sharma",
    playerPhotoUrl: null,
    playerRole: "Batsman",
    playerCity: "Jaipur",
    playerBasePrice: 200_000,
    playerTag: null,
    displayIsBreak: false,
    breakEndsAt: null,
    breakMessage: null,
    outcomeType: null,
    outcomeKey: null,
    outcomeIsManual: false,
    soldPlayerName: null,
    soldPhotoUrl: null,
    soldAmount: null,
    soldTeamName: null,
    soldTeamColor: null,
    soldTeamLogoUrl: null,
    unsoldPlayerName: null,
    unsoldPhotoUrl: null,
    summarySold: 2,
    summaryUnsold: 0,
    summaryRemaining: 6,
    summaryHighestBid: 2_500_000,
    summaryHighestBidPlayer: "Aman",
    summaryTopBuyerName: "Blazing Titans",
    summaryTopBuyerSpend: 2_500_000,
    summaryHighestTeamSpend: 2_500_000,
    summaryHighestTeamName: "Blazing Titans",
    presentationContext: { context: "auction", selectedTeamId: null },
    teamPurses: [
      purse({ teamId: 1, teamName: "Blazing Titans", shortCode: "BT", purseRemaining: 4_500_000, playersBought: 1 }),
      purse({ teamId: 2, teamName: "Royal Strikers", shortCode: "RS", purseRemaining: 3_200_000, playersBought: 1 }),
    ],
    soldPlayers: [
      player({ id: 1, name: "Aman", soldPrice: 2_500_000, teamId: 1 }),
      player({ id: 2, name: "Neel", soldPrice: 900_000, teamId: 2, role: "Bowler" }),
    ],
    nowMs: 1_700_000_000_000,
    ...overrides,
  };
}

function render(frame: DirectorFrame, extras: Partial<Parameters<typeof adaptAuctionToBroadcastFrame>[0]> = {}) {
  const defaults = directorContext();
  return adaptAuctionToBroadcastFrame({
    directorFrame: frame,
    tournamentName: "BidWar Premier League",
    tournamentLogoUrl: null,
    sponsorLogos: [],
    state: undefined,
    teamPurses: defaults.teamPurses,
    soldPlayers: defaults.soldPlayers,
    formatAmount: (n) => String(n),
    isStaleFeed: false,
    feedState: "live",
    ...extras,
  });
}

describe("OBS presentation reaches the stream renderer", () => {
  it("Top 5 control renders the five highest sales while the director scene stays live", () => {
    const director = new BroadcastDirector();
    const six = [
      player({ id: 1, name: "Aman", soldPrice: 2_500_000, teamId: 1 }),
      player({ id: 2, name: "Neel", soldPrice: 900_000, teamId: 2 }),
      player({ id: 3, name: "Kabir", soldPrice: 1_800_000, teamId: 1 }),
      player({ id: 4, name: "Dev", soldPrice: 700_000, teamId: 2 }),
      player({ id: 5, name: "Ishan", soldPrice: 1_100_000, teamId: 1 }),
      player({ id: 6, name: "Om", soldPrice: 400_000, teamId: 2 }),
    ];
    const tick = director.tick(
      directorContext({
        presentationContext: { context: "top5", selectedTeamId: null },
        soldPlayers: six,
      }),
    );

    expect(tick.frame.sceneId).toBe("AUCTION");
    expect(tick.frame.currentContext).toBe("TOP5");

    const frame = render(tick.frame, { soldPlayers: six, teamPurses: directorContext().teamPurses });
    expect(frame.scene).toBe("TOP5");
    if (frame.scene !== "TOP5") return;
    expect(frame.model.entries.map((entry) => entry.playerName)).toEqual([
      "Aman",
      "Kabir",
      "Ishan",
      "Neel",
      "Dev",
    ]);
    expect(frame.model.entries.map((entry) => entry.price)).toEqual([
      2_500_000,
      1_800_000,
      1_100_000,
      900_000,
      700_000,
    ]);
    expect(frame.model.entries[0]?.teamShort).toBe("BT");
    expect(frame.model.entries[0]?.teamName).toBe("Blazing Titans");
    expect(frame.model.entries[0]?.role).toBe("Batsman");
  });

  it("renders an empty Top 5 board when nobody is sold", () => {
    const director = new BroadcastDirector();
    const tick = director.tick(
      directorContext({
        presentationContext: { context: "top5", selectedTeamId: null },
        soldPlayers: [],
      }),
    );
    const frame = render(tick.frame, { soldPlayers: [] });
    expect(frame.scene).toBe("TOP5");
    if (frame.scene !== "TOP5") return;
    expect(frame.model.entries).toEqual([]);
  });

  it("Team Details renders the selected team's purse and squad", () => {
    const director = new BroadcastDirector();
    const soldPlayers = [
      player({ id: 1, name: "Aman", soldPrice: 2_500_000, teamId: 1, role: "Batsman" }),
      player({ id: 2, name: "Neel", soldPrice: 900_000, teamId: 2, role: "Bowler" }),
    ];
    const tick = director.tick(
      directorContext({
        presentationContext: { context: "team", selectedTeamId: 2 },
        soldPlayers,
      }),
    );

    expect(tick.frame.sceneId).toBe("AUCTION");
    expect(tick.frame.currentContext).toBe("TEAM");
    expect(tick.frame.team?.teamId).toBe(2);

    const frame = render(tick.frame, { soldPlayers, teamPurses: directorContext().teamPurses });
    expect(frame.scene).toBe("TEAM");
    if (frame.scene !== "TEAM") return;
    expect(frame.model.team.name).toBe("Royal Strikers");
    expect(frame.model.team.purseRemaining).toBe(3_200_000);
    expect(frame.model.team.playersBought).toBe(1);
    expect(frame.model.squad.map((member) => member.name)).toEqual(["Neel"]);
    expect(frame.model.squad[0]?.price).toBe(900_000);
  });

  it("Team Details with no franchises renders an empty squad instead of crashing", () => {
    const director = new BroadcastDirector();
    const tick = director.tick(
      directorContext({
        presentationContext: { context: "team", selectedTeamId: null },
        teamPurses: [],
        soldPlayers: [],
      }),
    );
    expect(tick.frame.team).toBeNull();
    const frame = render(tick.frame, { teamPurses: [], soldPlayers: [] });
    expect(frame.scene).toBe("TEAM");
    if (frame.scene !== "TEAM") return;
    expect(frame.model.squad).toEqual([]);
    expect(frame.model.team.name).toBe("No teams yet");
  });

  it("Team Details shows a retained player's retained price and falls back when a price is missing", () => {
    const director = new BroadcastDirector();
    const soldPlayers = [
      player({
        id: 144,
        name: "Virat Kohli",
        status: "retained",
        soldPrice: null,
        retainedPrice: 10_000,
        teamId: 19,
        role: "Batsman",
      }),
      player({
        id: 145,
        name: "No Price",
        status: "retained",
        soldPrice: null,
        retainedPrice: null,
        teamId: 19,
        role: "Bowler",
      }),
    ];
    const teamPurses = [
      purse({ teamId: 19, teamName: "Pitch Warriors", shortCode: "PW", purseRemaining: 140_000, playersBought: 1 }),
    ];
    const tick = director.tick(
      directorContext({
        presentationContext: { context: "team", selectedTeamId: 19 },
        soldPlayers,
        teamPurses,
      }),
    );
    const frame = render(tick.frame, { soldPlayers, teamPurses });
    expect(frame.scene).toBe("TEAM");
    if (frame.scene !== "TEAM") return;
    expect(frame.model.team.name).toBe("Pitch Warriors");
    expect(frame.model.team.purseRemaining).toBe(140_000);
    expect(frame.model.squad).toEqual([
      { name: "Virat Kohli", role: "Batsman", price: 10_000 },
      { name: "No Price", role: "Bowler", price: 0 },
    ]);
  });

  it("Live Auction restores the live strip with the current player and bid", () => {
    const director = new BroadcastDirector();
    const tick = director.tick(directorContext());
    expect(tick.frame.sceneId).toBe("AUCTION");
    expect(tick.frame.currentContext).toBe("AUCTION");

    const frame = render(tick.frame, {
      state: {
        currentBid: 1_200_000,
        currentBidTeamId: 1,
        currentPlayer: { id: 41, name: "Rahul Sharma", role: "Batsman", basePrice: 200_000 },
      } as Parameters<typeof render>[1]["state"],
    });
    expect(frame.scene).toBe("AUCTION");
    if (frame.scene !== "AUCTION") return;
    expect(frame.model.player.name).toBe("Rahul Sharma");
    expect(frame.model.currentBid).toBe(1_200_000);
    expect(frame.model.leadingTeam?.name).toBe("Blazing Titans");
  });

  it("a hall-only board leaves OBS on the live strip", () => {
    const director = new BroadcastDirector();
    const tick = director.tick(
      directorContext({ presentationContext: { context: "auction", selectedTeamId: 7 } }),
    );
    const frame = render(tick.frame);
    expect(frame.scene).toBe("AUCTION");
  });

  it("Sold, Unsold, Break, Waiting and Summary still beat an open Top 5 context", () => {
    const director = new BroadcastDirector();
    const top5 = { context: "top5" as const, selectedTeamId: null };

    director.tick(directorContext({ presentationContext: top5, outcomeKey: "seed", outcomeType: "sold", soldPlayerName: "Seed" }));
    const sold = director.tick(
      directorContext({
        presentationContext: top5,
        outcomeKey: "sale-2",
        outcomeType: "sold",
        soldPlayerName: "Aman",
        soldAmount: 2_500_000,
        soldTeamName: "Blazing Titans",
        nowMs: 1_700_000_006_000,
      }),
    );
    expect(sold.frame.sceneId).toBe("SOLD");
    expect(render(sold.frame).scene).toBe("SOLD");

    const unsoldDirector = new BroadcastDirector();
    unsoldDirector.tick(directorContext({ presentationContext: top5, outcomeKey: "seed", outcomeType: "unsold", unsoldPlayerName: "Seed" }));
    const unsold = unsoldDirector.tick(
      directorContext({
        presentationContext: top5,
        outcomeKey: "unsold-2",
        outcomeType: "unsold",
        unsoldPlayerName: "Dev",
        nowMs: 1_700_000_006_000,
      }),
    );
    expect(unsold.frame.sceneId).toBe("UNSOLD");
    expect(render(unsold.frame).scene).toBe("UNSOLD");

    const onBreak = new BroadcastDirector().tick(
      directorContext({
        presentationContext: top5,
        displayIsBreak: true,
        breakEndsAt: "2026-10-17T12:05:00.000Z",
        breakMessage: "Strategic timeout",
      }),
    );
    expect(onBreak.frame.sceneId).toBe("BREAK");
    expect(onBreak.frame.currentContext).toBe("BREAK");
    const breakFrame = render(onBreak.frame);
    expect(breakFrame.scene).toBe("BREAK");
    if (breakFrame.scene === "BREAK") expect(breakFrame.model.headline).toBe("Strategic timeout");

    const waiting = new BroadcastDirector().tick(
      directorContext({
        presentationContext: top5,
        auctionStatus: "idle",
        currentPlayerId: null,
        playerName: null,
      }),
    );
    expect(waiting.frame.sceneId).toBe("WAITING");
    expect(render(waiting.frame).scene).toBe("WAITING");
    const stillSold = render(waiting.frame, {
      state: {
        outcome: {
          type: "sold",
          playerName: "Ankit Jain",
          teamName: "Tushar Warriors",
          amount: 35_000,
        },
        soldPlayersCount: 1,
      } as Parameters<typeof render>[1]["state"],
    });
    expect(stillSold.scene).toBe("SOLD");
    if (stillSold.scene === "SOLD") {
      expect(stillSold.model.player.name).toBe("Ankit Jain");
      expect(stillSold.model.team.name).toBe("Tushar Warriors");
    }

    const summary = new BroadcastDirector().tick(
      directorContext({
        presentationContext: top5,
        auctionStatus: "completed",
      }),
    );
    expect(summary.frame.sceneId).toBe("SUMMARY");
    expect(render(summary.frame, {
      state: { soldPlayersCount: 32, unsoldPlayersCount: 0 } as Parameters<typeof render>[1]["state"],
    }).scene).toBe("SUMMARY");
  });

  it("reconnection restores Top 5 from the persisted presentation context", () => {
    const restored = parsePresentationContext(JSON.parse('{"context":"top5","selectedTeamId":null}'));
    const tick = new BroadcastDirector().tick(directorContext({ presentationContext: restored }));
    expect(tick.frame.currentContext).toBe("TOP5");
    expect(render(tick.frame).scene).toBe("TOP5");
  });

  it("repeated and out-of-order frames each render their own scene", () => {
    const director = new BroadcastDirector();
    const top5 = director.tick(directorContext({ presentationContext: { context: "top5", selectedTeamId: null } })).frame;
    const live = director.tick(directorContext({ presentationContext: { context: "auction", selectedTeamId: null }, nowMs: 1_700_000_001_000 })).frame;
    const team = new BroadcastDirector()
      .tick(directorContext({ presentationContext: { context: "team", selectedTeamId: 1 } })).frame;

    expect(render(team).scene).toBe("TEAM");
    expect(render(live).scene).toBe("AUCTION");
    expect(render(top5).scene).toBe("TOP5");
    expect(render(live).scene).toBe("AUCTION");
  });

  it("an unknown scene id falls back to standby instead of a blank frame", () => {
    const tick = new BroadcastDirector().tick(directorContext());
    const stale = { ...tick.frame, sceneId: "NOT_A_SCENE" } as DirectorFrame;
    expect(render(stale).scene).toBe("WAITING");
  });
});
