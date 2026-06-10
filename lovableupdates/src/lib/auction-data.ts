import player1 from "@/assets/players/player-1.jpg";
import player2 from "@/assets/players/player-2.jpg";
import player3 from "@/assets/players/player-3.jpg";
import player4 from "@/assets/players/player-4.jpg";
import player5 from "@/assets/players/player-5.jpg";
import player6 from "@/assets/players/player-6.jpg";

export type Role = "BAT" | "BOWL" | "AR" | "WK";
export type PlayerStatus = "queue" | "live" | "sold" | "unsold";

export interface Player {
  id: string;
  name: string;
  role: Role;
  basePrice: number; // in rupees
  city: string;
  age: number;
  battingHand: "Right" | "Left";
  jerseyNo: number;
  portrait: string;
  status: PlayerStatus;
  soldTo?: string;
  soldFor?: number;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string; // tailwind/hex
  purse: number; // remaining
  totalPurse: number;
  squad: string[]; // player ids
  maxSlots: number;
}

export const TEAMS: Team[] = [
  { id: "MUM", name: "Mumbai Mavericks", short: "MUM", color: "#1E40AF", purse: 8_50_00_000, totalPurse: 10_00_00_000, squad: [], maxSlots: 18 },
  { id: "BLR", name: "Bengaluru Titans", short: "BLR", color: "#DC2626", purse: 9_25_00_000, totalPurse: 10_00_00_000, squad: [], maxSlots: 18 },
  { id: "DEL", name: "Delhi Hawks", short: "DEL", color: "#0891B2", purse: 7_75_00_000, totalPurse: 10_00_00_000, squad: [], maxSlots: 18 },
  { id: "CHE", name: "Chennai Strikers", short: "CHE", color: "#F59E0B", purse: 9_50_00_000, totalPurse: 10_00_00_000, squad: [], maxSlots: 18 },
];

export const PLAYERS: Player[] = [
  { id: "p1", name: "Ishaan Sharma", role: "AR", basePrice: 2_00_000, city: "Mumbai", age: 26, battingHand: "Right", jerseyNo: 7, portrait: player1, status: "queue" },
  { id: "p2", name: "Rohit Patel", role: "BAT", basePrice: 5_00_000, city: "Mumbai", age: 28, battingHand: "Right", jerseyNo: 45, portrait: player2, status: "queue" },
  { id: "p3", name: "Arjun Reddy", role: "BOWL", basePrice: 3_00_000, city: "Hyderabad", age: 24, battingHand: "Right", jerseyNo: 11, portrait: player3, status: "queue" },
  { id: "p4", name: "Vikram Singh", role: "BAT", basePrice: 8_00_000, city: "Delhi", age: 31, battingHand: "Left", jerseyNo: 18, portrait: player4, status: "queue" },
  { id: "p5", name: "Karan Mehta", role: "WK", basePrice: 4_00_000, city: "Bengaluru", age: 23, battingHand: "Right", jerseyNo: 9, portrait: player5, status: "queue" },
  { id: "p6", name: "Suresh Iyer", role: "BOWL", basePrice: 6_00_000, city: "Chennai", age: 29, battingHand: "Right", jerseyNo: 32, portrait: player6, status: "queue" },
  { id: "p7", name: "Aditya Kumar", role: "AR", basePrice: 2_00_000, city: "Kolkata", age: 25, battingHand: "Right", jerseyNo: 21, portrait: player1, status: "queue" },
  { id: "p8", name: "Rahul Verma", role: "BAT", basePrice: 5_00_000, city: "Pune", age: 27, battingHand: "Right", jerseyNo: 14, portrait: player2, status: "queue" },
];

export const TOURNAMENT = {
  name: "Premier League Series 2026",
  organizer: "BIDWAR Sports Committee",
  venue: "Mumbai Stadium",
  date: "2026-05-15",
  baseIncrement: 25_000,
};

// Bid increment tiers (rupees)
export const INCREMENT_TIERS = [
  { upTo: 10_00_000, step: 25_000 },
  { upTo: 20_00_000, step: 50_000 },
  { upTo: 50_00_000, step: 1_00_000 },
  { upTo: Infinity, step: 2_50_000 },
];

export function nextIncrement(currentBid: number): number {
  return INCREMENT_TIERS.find((t) => currentBid < t.upTo)?.step ?? 1_00_000;
}

// Format ₹ in Indian style: ₹5,00,000 or ₹1.25 CR for large
export function formatINR(n: number): string {
  if (n >= 1_00_00_000) {
    const cr = n / 1_00_00_000;
    return `₹${cr.toFixed(cr >= 10 ? 1 : 2)} CR`;
  }
  if (n >= 1_00_000) {
    const lakh = n / 1_00_000;
    return `₹${lakh.toFixed(lakh >= 10 ? 1 : 2)} L`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatINRFull(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batsman",
  BOWL: "Bowler",
  AR: "All-Rounder",
  WK: "Wicket-Keeper",
};
