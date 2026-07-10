/**
 * Buzz Studio — Team Squad Demo Data
 */

import { SportType } from "../../types/sport-types";
import type { TeamSquadContract } from "./TeamSquad.types";

export const demoMumbaiSquad: TeamSquadContract = {
  teamName: "Mumbai Warriors",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=MW",
  teamColor: "#F59E0B",
  sport: SportType.Cricket,
  branding: {
    tagline: "Vyapari Network Badminton League 3.0 (Women)",
    tournamentLogoUrl: "https://placehold.co/120x120/111/FBBF24?text=PCL",
    titleSponsor: {
      url: "https://placehold.co/160x48/111/FBBF24?text=TITLE",
      name: "Title Corp",
    },
    coSponsors: [
      { url: "https://placehold.co/100x40/111/fff?text=CO1", name: "Co One" },
      { url: "https://placehold.co/100x40/111/fff?text=CO2", name: "Co Two" },
    ],
  },
  players: [
    {
      playerId: "1",
      playerName: "Rohit Verma",
      playerImageUrl: "https://placehold.co/80x80/1a1a1a/FBBF24?text=RV",
      status: "retained",
      price: 1200000,
      designation: "Captain",
      isCaptain: true,
      playerTag: "captain",
    },
    {
      playerId: "2",
      playerName: "Aditya Singh",
      playerImageUrl: "https://placehold.co/80x80/1a1a1a/FBBF24?text=AS",
      status: "sold",
      price: 4500000,
      designation: "Icon",
      playerTag: "icon",
      isTopSold: true,
      topSoldRank: 1,
    },
    {
      playerId: "3",
      playerName: "Khushboo Gahoi",
      status: "sold",
      price: 165000,
      designation: "Doubles",
      isTopSold: true,
      topSoldRank: 4,
    },
    {
      playerId: "4",
      playerName: "Monisha Agrawal",
      playerImageUrl: "https://placehold.co/80x80/1a1a1a/FBBF24?text=MA",
      status: "sold",
      price: 130000,
      designation: "Doubles",
      playerTag: "star_player",
    },
    {
      playerId: "5",
      playerName: "Vikas Pandey",
      status: "sold",
      price: 1500000,
      designation: "Batsman",
      isTopSold: true,
      topSoldRank: 3,
    },
    {
      playerId: "6",
      playerName: "Arjun Mehta",
      status: "sold",
      price: 950000,
      designation: "Bowler",
    },
    {
      playerId: "7",
      playerName: "Neha Desai",
      status: "sold",
      price: 1100000,
      designation: "All-Rounder",
    },
    {
      playerId: "8",
      playerName: "Suresh Iyer",
      status: "retained",
      price: 600000,
      designation: "Bowler",
    },
  ],
};

export const demoLargeSquad: TeamSquadContract = {
  teamName: "Delhi Thunderbolts United",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/EF4444?text=DT",
  teamColor: "#EF4444",
  sport: SportType.Cricket,
  branding: {
    tagline: "Mega Auction Night Championship Series 2026",
    tournamentLogoUrl: "https://placehold.co/120x120/111/EF4444?text=MAN",
    titleSponsor: {
      url: "https://placehold.co/160x48/111/EF4444?text=TITLE",
      name: "Title Brand",
    },
    coSponsors: [
      { url: "https://placehold.co/100x40/111/fff?text=CO1", name: "Co One" },
      { url: "https://placehold.co/100x40/111/fff?text=CO2", name: "Co Two" },
      { url: "https://placehold.co/100x40/111/fff?text=CO3", name: "Co Three" },
    ],
  },
  players: [
    ...demoMumbaiSquad.players,
    {
      playerId: "9",
      playerName: "Rahul Joshi",
      status: "sold",
      price: 2200000,
      designation: "Batsman",
      isTopSold: true,
      topSoldRank: 2,
    },
    {
      playerId: "10",
      playerName: "Manish Rao",
      status: "sold",
      price: 1750000,
      designation: "Bowler",
      isTopSold: true,
      topSoldRank: 5,
    },
    {
      playerId: "11",
      playerName: "Deepak Nair",
      status: "retained",
      price: 500000,
      designation: "All-Rounder",
    },
    {
      playerId: "12",
      playerName: "Amit Kohli",
      status: "sold",
      price: 1300000,
      designation: "Batsman",
    },
  ],
};

export const ALL_DEMO_SCENARIOS: TeamSquadContract[] = [
  demoMumbaiSquad,
  demoLargeSquad,
];
