import type { DisplayAuction } from "@/lib/auth";
import type { Sport, UpcomingTournament } from "@/data/upcoming-auctions";

export async function fetchDisplayAuctions(): Promise<DisplayAuction[]> {
  const response = await fetch("/api/display-auctions", { cache: "no-store" });
  if (!response.ok) return [];
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as DisplayAuction[]) : [];
}

export function mapDisplayAuctionsToUpcoming(data: DisplayAuction[]): UpcomingTournament[] {
  return data.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code || d.name.split(" ").map((w) => w[0]).join("").slice(0, 4).toUpperCase(),
    sport: d.sport as Sport,
    city: d.city + (d.state ? `, ${d.state}` : ""),
    date: d.scheduledDate,
    time: d.scheduledTime,
    purse: d.purse,
    playersPerTeam: d.playersPerTeam,
    teams: d.teamsCount,
    primary: d.primaryColor,
    accent: d.accentColor,
  }));
}
