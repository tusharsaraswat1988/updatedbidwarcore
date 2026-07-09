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
    tagline: "Premier Cricket League 2026",
    tournamentLogoUrl: "https://placehold.co/120x120/111/FBBF24?text=PCL",
  },
  players: [
    {
      playerId: "1",
      playerName: "Rohit Verma",
      playerImageUrl: "https://placehold.co/80x80/1a1a1a/FBBF24?text=RV",
      status: "retained",
      price: 1200000,
      priceDisplay: "₹12L",
      designation: "Batsman",
      isCaptain: true,
    },
    {
      playerId: "2",
      playerName: "Aditya Singh",
      playerImageUrl: "https://placehold.co/80x80/1a1a1a/FBBF24?text=AS",
      status: "sold",
      price: 4500000,
      priceDisplay: "₹45L",
      designation: "All-Rounder",
    },
    {
      playerId: "3",
      playerName: "Karan Mehta",
      status: "sold",
      price: 2800000,
      priceDisplay: "₹28L",
      designation: "Bowler",
    },
    {
      playerId: "4",
      playerName: "Priya Shankar",
      playerImageUrl: "https://placehold.co/80x80/1a1a1a/FBBF24?text=PS",
      status: "retained",
      price: 800000,
      priceDisplay: "₹8L",
      designation: "Wicket-Keeper",
    },
    {
      playerId: "5",
      playerName: "Vikas Pandey",
      status: "sold",
      price: 1500000,
      priceDisplay: "₹15L",
      designation: "Batsman",
    },
    {
      playerId: "6",
      playerName: "Arjun Mehta",
      status: "sold",
      price: 950000,
      priceDisplay: "₹9.5L",
      designation: "Bowler",
    },
    {
      playerId: "7",
      playerName: "Neha Desai",
      status: "sold",
      price: 1100000,
      priceDisplay: "₹11L",
      designation: "All-Rounder",
    },
    {
      playerId: "8",
      playerName: "Suresh Iyer",
      status: "retained",
      price: 600000,
      priceDisplay: "₹6L",
      designation: "Bowler",
    },
  ],
};

export const demoLargeSquad: TeamSquadContract = {
  teamName: "Delhi Thunderbolts",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/EF4444?text=DT",
  teamColor: "#EF4444",
  sport: SportType.Cricket,
  branding: {
    tagline: "Mega Auction Night",
    tournamentLogoUrl: "https://placehold.co/120x120/111/EF4444?text=MAN",
  },
  players: [
    ...demoMumbaiSquad.players,
    {
      playerId: "9",
      playerName: "Rahul Joshi",
      status: "sold",
      price: 2200000,
      priceDisplay: "₹22L",
      designation: "Batsman",
    },
    {
      playerId: "10",
      playerName: "Manish Rao",
      status: "sold",
      price: 1750000,
      priceDisplay: "₹17.5L",
      designation: "Bowler",
    },
    {
      playerId: "11",
      playerName: "Deepak Nair",
      status: "retained",
      price: 500000,
      priceDisplay: "₹5L",
      designation: "All-Rounder",
    },
    {
      playerId: "12",
      playerName: "Amit Kohli",
      status: "sold",
      price: 1300000,
      priceDisplay: "₹13L",
      designation: "Batsman",
    },
  ],
};

export const ALL_DEMO_SCENARIOS: TeamSquadContract[] = [
  demoMumbaiSquad,
  demoLargeSquad,
];
