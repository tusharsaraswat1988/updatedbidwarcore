// ─── Shared upcoming auction data ─────────────────────────────────────────────

export type Sport = "cricket" | "football" | "kabaddi";

export interface UpcomingTournament {
  id: number;
  name: string;
  code: string;
  sport: Sport;
  city: string;
  date: string;
  time: string;
  purse: number;
  playersPerTeam: number;
  teams: number;
  primary: string;
  accent: string;
}

export const UPCOMING: UpcomingTournament[] = [
  {
    id: 1,
    name: "Lucknow Premier League Season 4",
    code: "LPL",
    sport: "cricket",
    city: "Lucknow",
    date: "2026-06-05",
    time: "18:00",
    purse: 3000000,
    playersPerTeam: 14,
    teams: 12,
    primary: "#1a3a6b",
    accent: "#f5c842",
  },
  {
    id: 2,
    name: "Kashi Cricket Cup 2026",
    code: "KCC",
    sport: "cricket",
    city: "Varanasi",
    date: "2026-06-12",
    time: "17:30",
    purse: 2000000,
    playersPerTeam: 11,
    teams: 10,
    primary: "#7b1a1a",
    accent: "#f97316",
  },
  {
    id: 3,
    name: "Agra Kings Premier League",
    code: "AKPL",
    sport: "cricket",
    city: "Agra",
    date: "2026-06-15",
    time: "19:00",
    purse: 2500000,
    playersPerTeam: 13,
    teams: 8,
    primary: "#1a4d2e",
    accent: "#22c55e",
  },
  {
    id: 4,
    name: "Prayagraj Champions Trophy",
    code: "PCT",
    sport: "cricket",
    city: "Prayagraj",
    date: "2026-06-20",
    time: "15:00",
    purse: 1500000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#2d1a6b",
    accent: "#a78bfa",
  },
  {
    id: 5,
    name: "Mathura Warriors Super League",
    code: "MWSL",
    sport: "football",
    city: "Mathura",
    date: "2026-06-22",
    time: "20:00",
    purse: 1800000,
    playersPerTeam: 16,
    teams: 10,
    primary: "#1a3a3a",
    accent: "#06b6d4",
  },
  {
    id: 6,
    name: "Meerut Premier Cricket League",
    code: "MPCL",
    sport: "cricket",
    city: "Meerut",
    date: "2026-06-28",
    time: "16:00",
    purse: 1200000,
    playersPerTeam: 12,
    teams: 8,
    primary: "#4a1a1a",
    accent: "#fb7185",
  },
  {
    id: 7,
    name: "Noida Super League Season 2",
    code: "NSL",
    sport: "cricket",
    city: "Noida",
    date: "2026-07-05",
    time: "18:30",
    purse: 3500000,
    playersPerTeam: 14,
    teams: 14,
    primary: "#1a2a4a",
    accent: "#38bdf8",
  },
  {
    id: 8,
    name: "Ghaziabad Cricket Federation Cup",
    code: "GCFC",
    sport: "cricket",
    city: "Ghaziabad",
    date: "2026-07-10",
    time: "17:00",
    purse: 1000000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#1a3a1a",
    accent: "#84cc16",
  },
  {
    id: 9,
    name: "Bareilly Premier League",
    code: "BPL",
    sport: "cricket",
    city: "Bareilly",
    date: "2026-07-15",
    time: "19:30",
    purse: 2000000,
    playersPerTeam: 12,
    teams: 10,
    primary: "#3a1a4a",
    accent: "#e879f9",
  },
  {
    id: 10,
    name: "Gorakhpur T20 Super Series",
    code: "GTSS",
    sport: "cricket",
    city: "Gorakhpur",
    date: "2026-07-18",
    time: "16:30",
    purse: 1500000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#2a1a0a",
    accent: "#fb923c",
  },
  {
    id: 11,
    name: "Aligarh Kabaddi Mahotsav 2026",
    code: "AKM",
    sport: "kabaddi",
    city: "Aligarh",
    date: "2026-07-22",
    time: "14:00",
    purse: 800000,
    playersPerTeam: 12,
    teams: 8,
    primary: "#0a2a3a",
    accent: "#14b8a6",
  },
  {
    id: 12,
    name: "Jhansi Warriors Cricket League",
    code: "JWCL",
    sport: "cricket",
    city: "Jhansi",
    date: "2026-07-26",
    time: "18:00",
    purse: 1200000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#1a0a2a",
    accent: "#c084fc",
  },
  {
    id: 13,
    name: "Kanpur Premier League Season 5",
    code: "KPL",
    sport: "cricket",
    city: "Kanpur",
    date: "2026-08-02",
    time: "19:00",
    purse: 4000000,
    playersPerTeam: 15,
    teams: 14,
    primary: "#1a1a0a",
    accent: "#eab308",
  },
  {
    id: 14,
    name: "Moradabad Box Cricket League",
    code: "MBCL",
    sport: "cricket",
    city: "Moradabad",
    date: "2026-08-08",
    time: "17:00",
    purse: 800000,
    playersPerTeam: 10,
    teams: 8,
    primary: "#0a1a2a",
    accent: "#60a5fa",
  },
  {
    id: 15,
    name: "Firozabad Cricket Cup Season 2",
    code: "FCC",
    sport: "cricket",
    city: "Firozabad",
    date: "2026-08-14",
    time: "16:00",
    purse: 1000000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#1a2a1a",
    accent: "#4ade80",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatPurse(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(0)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(0)} Lakh`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export const SPORT_LABEL: Record<Sport, string> = {
  cricket: "Cricket",
  football: "Football",
  kabaddi: "Kabaddi",
};
