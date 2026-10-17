import { describe, expect, it } from "vitest";
import type { Player, TeamPurse } from "@workspace/api-client-react";
import { BroadcastDirector } from "../../director/broadcast-director";
import type { DirectorContext } from "../../director/types";
import { DEFAULT_BROADCAST_SETTINGS } from "../../types";
import { adaptAuctionToBroadcastFrame } from "../auction-v2-adapter";

function player(partial: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    status: "available",
    role: "Batsman",
    basePrice: 1000,
    soldPrice: null,
    retainedPrice: null,
    teamId: null,
    photoUrl: null,
    ...partial,
  } as Player;
}

function purse(partial: Partial<TeamPurse> & Pick<TeamPurse, "teamId" | "teamName">): TeamPurse {
  return {
    shortCode: partial.teamName.slice(0, 2).toUpperCase(),
    purseRemaining: 150_000,
    playersBought: 0,
    maximumSquadSize: 12,
    color: "#facc15",
    logoUrl: null,
    maxAllowedBid: 150_000,
    ...partial,
  } as TeamPurse;
}

const purses = [
  purse({ teamId: 19, teamName: "Pitch Warriors", shortCode: "PW", purseRemaining: 140_000 }),
  purse({ teamId: 17, teamName: "Thunder Strikers", shortCode: "TS", purseRemaining: 150_000 }),
];

function context(soldPlayers: Player[]): DirectorContext {
  return {
    tournamentId: 6,
    outputTarget: "obs",
    tournamentName: "BOX CRICKET TESTING",
    tournamentLogoUrl: null,
    auctionStartsAt: null,
    sponsorLogos: [],
    settings: DEFAULT_BROADCAST_SETTINGS,
    isObsMode: true,
    isStaleFeed: false,
    formatAmount: (n) => `₹${n}`,
    resolvePhotoSrc: () => null,
    auctionStatus: "active",
    currentPlayerId: 166,
    currentBid: 1000,
    currentBidTeamId: null,
    currentBidTeamName: null,
    currentBidTeamColor: null,
    currentBidTeamLogoUrl: null,
    timerEndsAt: null,
    remainingPlayersCount: 23,
    currentCategoryName: null,
    playerName: "Mayank Yadav",
    playerPhotoUrl: null,
    playerRole: "Bowler",
    playerCity: null,
    playerBasePrice: 1000,
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
    summarySold: 0,
    summaryUnsold: 0,
    summaryRemaining: 23,
    summaryHighestBid: null,
    teamPurses: purses,
    soldPlayers,
    presentationContext: { context: "top5", selectedTeamId: null },
    nowMs: 1_700_000_000_000,
  } as DirectorContext;
}

function renderedNames(soldPlayers: Player[]) {
  const frame = new BroadcastDirector().tick(context(soldPlayers)).frame;
  const rendered = adaptAuctionToBroadcastFrame({
    directorFrame: frame,
    tournamentName: "BOX CRICKET TESTING",
    tournamentLogoUrl: null,
    sponsorLogos: [],
    state: undefined,
    teamPurses: purses,
    soldPlayers,
    formatAmount: (n) => String(n),
    isStaleFeed: false,
    feedState: "live",
  });
  expect(rendered.scene).toBe("TOP5");
  if (rendered.scene !== "TOP5") return [];
  return rendered.model.entries.map((entry) => ({
    name: entry.playerName,
    price: entry.price,
  }));
}

describe("OBS Top 5 retained and sold players", () => {
  it("renders a retained player at the retained price", () => {
    expect(
      renderedNames([
        player({
          id: 144,
          name: "Virat Kohli",
          status: "retained",
          teamId: 19,
          retainedPrice: 10_000,
          role: "Batsman",
        }),
      ]),
    ).toEqual([{ name: "Virat Kohli", price: 10_000 }]);
  });

  it("renders a sold player at the sold price", () => {
    expect(
      renderedNames([
        player({ id: 1, name: "Rohit Sharma", status: "sold", teamId: 17, soldPrice: 50_000 }),
      ]),
    ).toEqual([{ name: "Rohit Sharma", price: 50_000 }]);
  });

  it("ranks mixed sold and retained players by descending price and keeps equal-price order", () => {
    expect(
      renderedNames([
        player({ id: 2, name: "Second", status: "sold", teamId: 17, soldPrice: 10_000 }),
        player({ id: 1, name: "First", status: "retained", teamId: 19, retainedPrice: 10_000 }),
        player({ id: 3, name: "Highest", status: "sold", teamId: 17, soldPrice: 80_000 }),
      ]),
    ).toEqual([
      { name: "Highest", price: 80_000 },
      { name: "Second", price: 10_000 },
      { name: "First", price: 10_000 },
    ]);
  });

  it("keeps an empty board and a short board", () => {
    expect(renderedNames([])).toEqual([]);
    expect(
      renderedNames([
        player({ id: 1, name: "Only", status: "sold", teamId: 17, soldPrice: 20_000 }),
      ]),
    ).toEqual([{ name: "Only", price: 20_000 }]);
  });

  it("stops at five eligible players", () => {
    const many = [60, 50, 40, 30, 20, 10].map((price, index) =>
      player({
        id: index + 1,
        name: `P${index + 1}`,
        status: "sold",
        teamId: 17,
        soldPrice: price,
      }),
    );
    expect(renderedNames(many).map((row) => row.name)).toEqual(["P1", "P2", "P3", "P4", "P5"]);
  });

  it("excludes unsold, available, missing prices, and players with no team", () => {
    expect(
      renderedNames([
        player({ id: 1, name: "Available", status: "available", teamId: 17, soldPrice: 90_000 }),
        player({ id: 2, name: "Unsold", status: "unsold", teamId: 17, soldPrice: 90_000 }),
        player({ id: 3, name: "No sold price", status: "sold", teamId: 17, soldPrice: null }),
        player({ id: 4, name: "No retained price", status: "retained", teamId: 19, retainedPrice: null }),
        player({ id: 5, name: "Zero", status: "sold", teamId: 17, soldPrice: 0 }),
        player({ id: 6, name: "No team", status: "retained", teamId: null, retainedPrice: 10_000 }),
        player({ id: 7, name: "Kept", status: "sold", teamId: 17, soldPrice: 15_000 }),
      ]),
    ).toEqual([{ name: "Kept", price: 15_000 }]);
  });
});
