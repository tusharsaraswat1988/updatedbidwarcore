/**
 * Load league/group standings boards for the Leaderboards broadcast moment.
 */

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { badmintonFetch } from "@/lib/badminton-api";
import {
  buildLeaderboardBoards,
  buildLeaderboardPages,
  isLeagueDrawType,
  registrationTeamIdFromRow,
  type LeaderboardBoard,
  type LeaderboardPage,
  type LeagueCategoryLite,
  type LeagueGroupView,
  type LeagueStandingRow,
} from "@/lib/badminton-leaderboards";
import { BROADCAST_LEADERBOARD_PAGE_SIZE } from "@/lib/badminton-broadcast-director";

type RegistrationListRow = {
  registration?: { id?: number; metaJson?: unknown } | null;
  player1?: { teamId?: number | null; auctionTeamId?: number | null } | null;
};

export function useBadmintonLeaderboardBoards(
  tournamentId: number,
  enabled: boolean,
) {
  const categoriesQuery = useQuery<LeagueCategoryLite[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId && enabled,
    staleTime: 15_000,
  });

  const leagueCategories = useMemo(
    () =>
      (categoriesQuery.data ?? [])
        .filter((c) => isLeagueDrawType(c.drawType))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id),
    [categoriesQuery.data],
  );

  const detailQueries = useQueries({
    queries: leagueCategories.map((cat) => ({
      queryKey: ["badminton-leaderboard-board", tournamentId, cat.id],
      enabled: !!tournamentId && enabled && leagueCategories.length > 0,
      staleTime: 10_000,
      queryFn: async () => {
        const [standings, groups, registrations] = await Promise.all([
          badmintonFetch<LeagueStandingRow[]>(
            tournamentId,
            `/categories/${cat.id}/standings`,
          ),
          badmintonFetch<LeagueGroupView[]>(
            tournamentId,
            `/categories/${cat.id}/groups`,
          ).catch(() => [] as LeagueGroupView[]),
          badmintonFetch<RegistrationListRow[]>(
            tournamentId,
            `/categories/${cat.id}/registrations`,
          ).catch(() => [] as RegistrationListRow[]),
        ]);
        return { cat, standings, groups, registrations };
      },
    })),
  });

  const boards: LeaderboardBoard[] = useMemo(() => {
    if (!enabled) return [];
    const standingsByCategory = new Map<number, LeagueStandingRow[]>();
    const groupsByCategory = new Map<number, LeagueGroupView[]>();
    const registrationTeamByCategory = new Map<number, Map<number, number>>();

    for (const q of detailQueries) {
      if (!q.data) continue;
      const { cat, standings, groups, registrations } = q.data;
      standingsByCategory.set(cat.id, standings);
      groupsByCategory.set(cat.id, groups);
      const teamMap = new Map<number, number>();
      for (const row of registrations) {
        const mapped = registrationTeamIdFromRow(row);
        if (mapped) teamMap.set(mapped.registrationId, mapped.teamId);
      }
      registrationTeamByCategory.set(cat.id, teamMap);
    }

    return buildLeaderboardBoards({
      categories: leagueCategories,
      standingsByCategory,
      groupsByCategory,
      registrationTeamByCategory,
    });
  }, [detailQueries, enabled, leagueCategories]);

  const pages: LeaderboardPage[] = useMemo(
    () => buildLeaderboardPages(boards, BROADCAST_LEADERBOARD_PAGE_SIZE),
    [boards],
  );

  const loading =
    enabled &&
    (categoriesQuery.isLoading ||
      (leagueCategories.length > 0 && detailQueries.some((q) => q.isLoading)));

  const error =
    enabled &&
    (categoriesQuery.isError || detailQueries.some((q) => q.isError));

  return {
    boards,
    pages,
    loading,
    error,
    leagueCategoryCount: leagueCategories.length,
  };
}
