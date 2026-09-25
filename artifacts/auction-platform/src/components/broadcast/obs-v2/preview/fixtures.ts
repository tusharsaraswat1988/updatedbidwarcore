/**
 * PREVIEW-ONLY sample frames for design review. Never import from production
 * code paths — the real frame comes from BidWar's useBroadcastDirector / live hooks.
 */
import type { BroadcastFrame, BroadcastSceneId, CricketScoreModel, TeamPurse } from "../contracts";

const teams: [TeamPurse, TeamPurse, TeamPurse, TeamPurse] = [
  { teamId: "dps", name: "Delhi Panthers", short: "DPS", purseRemaining: 42_000_000, playersBought: 9, slotsRemaining: 6 },
  { teamId: "sun", name: "Sunbeams Anaadis", short: "SUN", purseRemaining: 38_500_000, playersBought: 11, slotsRemaining: 4 },
  { teamId: "rhn", name: "Rhino Knights", short: "RHN", purseRemaining: 51_000_000, playersBought: 7, slotsRemaining: 8 },
  { teamId: "tgr", name: "Tigers United", short: "TGR", purseRemaining: 29_750_000, playersBought: 12, slotsRemaining: 3 },
];

export function makeCricket(): CricketScoreModel {
  return {
    battingTeam: { short: "DPS", name: "Delhi Panthers" },
    bowlingTeamShort: "SUN",
    runs: 27,
    wickets: 0,
    overs: "1.3",
    maxOvers: 5,
    crr: 18,
    striker: { name: "Mayank Pahuja", runs: 23, balls: 7, onStrike: true },
    nonStriker: { name: "Siddharth Singh", runs: 2, balls: 2, onStrike: false },
    bowler: { name: "Anubhav Bassi", wickets: 0, runs: 10, overs: "0.3" },
    thisOver: [
      { kind: "run", label: "2" },
      { kind: "wide", label: "Wd" },
      { kind: "wide", label: "Wd" },
      { kind: "run", label: "2" },
      { kind: "four", label: "4" },
    ],
    result: { kicker: "Walkover Awarded", headline: "Sunbeams Anaadis", detail: "Won by Walkover" },
    status: { chip: "FINAL", text: "WON BY WALKOVER" },
  };
}

const player = { id: "p1", name: "Rohan Mehra", role: "All-Rounder", basePrice: 2_000_000, category: "Marquee Set" };

export function makeFrame(scene: BroadcastSceneId): BroadcastFrame {
  const base = {
    branding: { tournamentName: "BIDWAR", tournamentAccent: "PREMIER LEAGUE", tournamentShort: "BPL" },
    sponsors: [
      { id: "ld", name: "Lions Diamond", tier: "title" as const, label: "Official Partner" },
      { id: "a1", name: "Apex Cement", tier: "associate" as const },
      { id: "a2", name: "Nova Energy", tier: "associate" as const },
      { id: "a3", name: "Kite Mobile", tier: "associate" as const },
    ],
    teams,
    settings: { performanceMode: false, showTicker: true },
    feed: { status: "live" as const },
  };
  switch (scene) {
    case "CRICKET":
      return { ...base, scene, model: makeCricket() };
    case "WAITING":
      return { ...base, scene, model: { headline: "Auction resumes shortly", subline: "Next: Marquee Set 2" } };
    case "AUCTION":
      return { ...base, scene, model: { player, currentBid: 8_500_000, leadingTeam: teams[1], bidCount: 14 } };
    case "SOLD":
      return { ...base, scene, model: { player, soldPrice: 12_000_000, team: teams[1] } };
    case "UNSOLD":
      return { ...base, scene, model: { player: { ...player, name: "Karan Dutt", role: "Bowler" } } };
    case "BREAK":
      return { ...base, scene, model: { headline: "Strategic Time-Out", subline: "Break" } };
    case "SUMMARY":
      return {
        ...base,
        scene,
        model: { totalSold: 39, totalUnsold: 7, totalSpent: 318_000_000, highest: { playerName: "Rohan Mehra", price: 12_000_000, teamShort: "SUN" } },
      };
    case "TOP5":
      return {
        ...base,
        scene,
        model: {
          title: "Top Buys",
          entries: [
            { rank: 1, playerName: "Rohan Mehra", role: "AR", teamShort: "SUN", price: 12_000_000 },
            { rank: 2, playerName: "Mayank Pahuja", role: "BAT", teamShort: "DPS", price: 10_500_000 },
            { rank: 3, playerName: "Anubhav Bassi", role: "BWL", teamShort: "SUN", price: 9_000_000 },
            { rank: 4, playerName: "Vikram Rao", role: "WK", teamShort: "RHN", price: 8_200_000 },
            { rank: 5, playerName: "Arjun Sethi", role: "BAT", teamShort: "TGR", price: 7_600_000 },
          ],
        },
      };
    case "TEAM":
      return {
        ...base,
        scene,
        model: {
          team: teams[0],
          squad: [
            { name: "M. Pahuja", role: "BAT", price: 10_500_000 },
            { name: "S. Singh", role: "BAT", price: 4_000_000 },
            { name: "A. Khan", role: "BWL", price: 3_200_000 },
            { name: "R. Das", role: "AR", price: 6_100_000 },
            { name: "T. Iyer", role: "WK", price: 2_500_000 },
            { name: "P. Nair", role: "BWL", price: 2_000_000 },
            { name: "K. Bose", role: "AR", price: 3_800_000 },
          ],
        },
      };
  }
}
