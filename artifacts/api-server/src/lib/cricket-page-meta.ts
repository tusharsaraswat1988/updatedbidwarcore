import { db } from "@workspace/db";
import {
  playersTable,
  scoringMatchesTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { PageMeta } from "./page-meta.js";
import { getPlatformOpenGraphImageUrl } from "./branding-service.js";

const BASE_URL = "https://bidwar.in";

function withOg(meta: PageMeta): PageMeta {
  if (meta.ogImage) return meta;
  const platformOg = getPlatformOpenGraphImageUrl();
  return platformOg ? { ...meta, ogImage: platformOg } : meta;
}

const CRICKET_PUBLIC_RE =
  /^\/tournament\/(\d+)\/cricket(?:\/match\/(\d+)|\/player\/(\d+)|\/team\/(\d+))?$/;

const GLOBAL_PLAYER_RE = /^\/player\/([a-zA-Z0-9_-]+)$/;

/** Async SSR meta for public cricket scoring pages (WhatsApp / link previews). */
export async function resolveCricketPageMeta(pathname: string): Promise<PageMeta | null> {
  const cricketMatch = pathname.match(CRICKET_PUBLIC_RE);
  if (cricketMatch) {
    const tournamentId = parseInt(cricketMatch[1]!, 10);
    const matchId = cricketMatch[2] ? parseInt(cricketMatch[2], 10) : null;
    const playerId = cricketMatch[3] ? parseInt(cricketMatch[3], 10) : null;
    const teamId = cricketMatch[4] ? parseInt(cricketMatch[4], 10) : null;

    const [tournament] = await db
      .select({ name: tournamentsTable.name, sport: tournamentsTable.sport })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);

    if (!tournament || tournament.sport !== "cricket") return null;

    if (matchId) {
      const [match] = await db
        .select({
          homeTeamId: scoringMatchesTable.homeTeamId,
          awayTeamId: scoringMatchesTable.awayTeamId,
          resultSummary: scoringMatchesTable.resultSummary,
          status: scoringMatchesTable.status,
        })
        .from(scoringMatchesTable)
        .where(
          and(
            eq(scoringMatchesTable.id, matchId),
            eq(scoringMatchesTable.tournamentId, tournamentId),
          ),
        )
        .limit(1);

      if (!match) return null;

      const [home, away] = await Promise.all([
        db.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, match.homeTeamId)).limit(1).then((r) => r[0]),
        db.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, match.awayTeamId)).limit(1).then((r) => r[0]),
      ]);

      const title = `${home?.name ?? "Home"} vs ${away?.name ?? "Away"} — Scorecard | ${tournament.name}`;
      const description =
        match.resultSummary ??
        (match.status === "live" ? "Live cricket scorecard on BidWar." : "Full cricket scorecard on BidWar.");

      return withOg({
        title,
        description,
        canonical: `${BASE_URL}${pathname}`,
        ogTitle: title,
        ogDescription: description,
        robots: "noindex, follow",
        schemas: [],
      });
    }

    if (playerId) {
      const [player] = await db
        .select({ name: playersTable.name, role: playersTable.role })
        .from(playersTable)
        .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tournamentId)))
        .limit(1);

      if (!player) return null;

      const title = `${player.name} — ${tournament.name} | BidWar Cricket`;
      const description = `Tournament stats and match awards for ${player.name}${player.role ? ` (${player.role})` : ""} in ${tournament.name}.`;

      return withOg({
        title,
        description,
        canonical: `${BASE_URL}${pathname}`,
        ogTitle: title,
        ogDescription: description,
        robots: "noindex, follow",
        schemas: [],
      });
    }

    if (teamId) {
      const [team] = await db
        .select({ name: teamsTable.name, shortCode: teamsTable.shortCode })
        .from(teamsTable)
        .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)))
        .limit(1);

      if (!team) return null;

      const title = `${team.name} — ${tournament.name} | BidWar Cricket`;
      const description = `Squad, results, and standings for ${team.name} (${team.shortCode}) in ${tournament.name}.`;

      return withOg({
        title,
        description,
        canonical: `${BASE_URL}${pathname}`,
        ogTitle: title,
        ogDescription: description,
        robots: "noindex, follow",
        schemas: [],
      });
    }

    const title = `${tournament.name} — Live Cricket | BidWar`;
    const description = `Fixtures, points table, leaderboards, and live scores for ${tournament.name}.`;

    return withOg({
      title,
      description,
      canonical: `${BASE_URL}${pathname}`,
      ogTitle: title,
      ogDescription: description,
      robots: "noindex, follow",
      schemas: [],
    });
  }

  const globalMatch = pathname.match(GLOBAL_PLAYER_RE);
  if (globalMatch) {
    const title = "Cricket Player Profile | BidWar";
    const description = "Career cricket stats and tournament history on BidWar.";
    return withOg({
      title,
      description,
      canonical: `${BASE_URL}${pathname}`,
      ogTitle: title,
      ogDescription: description,
      robots: "noindex, follow",
      schemas: [],
    });
  }

  return null;
}

export function isCricketPublicPath(pathname: string): boolean {
  return CRICKET_PUBLIC_RE.test(pathname) || GLOBAL_PLAYER_RE.test(pathname);
}
