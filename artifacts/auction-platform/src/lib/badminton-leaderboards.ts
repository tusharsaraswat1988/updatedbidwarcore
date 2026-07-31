/**
 * League / group leaderboard helpers for Venue + OBS broadcast moments.
 */

export type LeagueStandingRow = {
  rank: number;
  registrationId: number;
  label: string;
  groupId?: number | null;
  groupName?: string | null;
  played: number;
  won: number;
  lost: number;
  /** Point difference from won matches (VNBL Diff). */
  marginPoints: number;
};

export type LeagueGroupView = {
  id: number;
  name: string;
  sortOrder: number;
  teams: Array<{ teamId: number; teamName: string; seed: number | null }>;
};

export type LeagueCategoryLite = {
  id: number;
  name: string;
  code?: string | null;
  drawType?: string | null;
  sortOrder?: number | null;
};

export type LeaderboardBoard = {
  key: string;
  categoryId: number;
  categoryName: string;
  /** Group name, or "League" when category-wide. */
  boardTitle: string;
  subtitle: string;
  rows: LeagueStandingRow[];
};

export type LeaderboardPage = {
  key: string;
  board: LeaderboardBoard;
  pageIndex: number;
  pageCount: number;
  rows: LeagueStandingRow[];
};

export function isLeagueDrawType(drawType: string | null | undefined): boolean {
  return drawType === "round_robin" || drawType === "group_knockout";
}

export function paginateItems<T>(items: T[], pageSize: number): T[][] {
  const size = Math.max(1, pageSize);
  if (items.length === 0) return [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

/** Re-rank standings 1..n after filtering to a group subset. */
export function rerankStandings(rows: LeagueStandingRow[]): LeagueStandingRow[] {
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Filter category standings to registrations whose franchise team is in the group.
 * Returns empty when no registration→team mapping matches (caller may fall back).
 */
export function filterStandingsForGroup(
  standings: LeagueStandingRow[],
  group: LeagueGroupView,
  registrationTeamId: Map<number, number>,
): LeagueStandingRow[] {
  const teamIds = new Set(group.teams.map((t) => t.teamId));
  if (teamIds.size === 0) return [];
  const filtered = standings.filter((row) => {
    const teamId = registrationTeamId.get(row.registrationId);
    return teamId != null && teamIds.has(teamId);
  });
  return rerankStandings(filtered);
}

/**
 * Build Results-page boards from category standings rows.
 * Prefer API `groupId` / `groupName` when present; otherwise one category-wide board.
 */
export function buildStandingsBoardsFromRows(input: {
  categories: LeagueCategoryLite[];
  standingsByCategory: Map<number, LeagueStandingRow[]>;
}): LeaderboardBoard[] {
  const leagueCats = input.categories
    .filter((c) => isLeagueDrawType(c.drawType))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);

  const boards: LeaderboardBoard[] = [];

  for (const cat of leagueCats) {
    const standings = input.standingsByCategory.get(cat.id) ?? [];
    if (standings.length === 0) continue;

    const categoryName = cat.code?.trim() || cat.name;
    const byGroup = new Map<string, LeagueStandingRow[]>();
    let hasGroup = false;

    for (const row of standings) {
      if (row.groupId != null || (row.groupName && row.groupName.trim())) {
        hasGroup = true;
        const key = String(row.groupId ?? row.groupName);
        const list = byGroup.get(key) ?? [];
        list.push(row);
        byGroup.set(key, list);
      }
    }

    if (hasGroup && byGroup.size > 0) {
      const entries = [...byGroup.entries()].sort((a, b) => {
        const aId = a[1][0]?.groupId ?? 0;
        const bId = b[1][0]?.groupId ?? 0;
        if (aId !== bId) return aId - bId;
        return (a[1][0]?.groupName ?? "").localeCompare(b[1][0]?.groupName ?? "");
      });
      for (const [key, rows] of entries) {
        const title = rows[0]?.groupName?.trim() || `Group ${key}`;
        boards.push({
          key: `cat-${cat.id}-group-${key}`,
          categoryId: cat.id,
          categoryName,
          boardTitle: title,
          subtitle: `${categoryName} · Wins → Diff`,
          rows: rerankStandings(rows),
        });
      }
      continue;
    }

    boards.push({
      key: `cat-${cat.id}`,
      categoryId: cat.id,
      categoryName,
      boardTitle: categoryName,
      subtitle:
        cat.drawType === "group_knockout"
          ? "Group stage · Wins → Diff"
          : "Round robin · Wins → Diff",
      rows: standings,
    });
  }

  return boards;
}

export function buildLeaderboardBoards(input: {
  categories: LeagueCategoryLite[];
  standingsByCategory: Map<number, LeagueStandingRow[]>;
  groupsByCategory: Map<number, LeagueGroupView[]>;
  registrationTeamByCategory: Map<number, Map<number, number>>;
}): LeaderboardBoard[] {
  const leagueCats = input.categories
    .filter((c) => isLeagueDrawType(c.drawType))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);

  const boards: LeaderboardBoard[] = [];

  for (const cat of leagueCats) {
    const standings = input.standingsByCategory.get(cat.id) ?? [];
    if (standings.length === 0) continue;

    const categoryName = cat.code?.trim() || cat.name;
    const groups = input.groupsByCategory.get(cat.id) ?? [];
    const regTeam = input.registrationTeamByCategory.get(cat.id) ?? new Map();

    if (groups.length > 0) {
      let anyGroupBoard = false;
      for (const group of groups) {
        const filtered = filterStandingsForGroup(standings, group, regTeam);
        if (filtered.length === 0) continue;
        anyGroupBoard = true;
        boards.push({
          key: `cat-${cat.id}-group-${group.id}`,
          categoryId: cat.id,
          categoryName,
          boardTitle: group.name,
          subtitle: `${categoryName} · Wins → Diff`,
          rows: filtered,
        });
      }
      if (anyGroupBoard) continue;
    }

    boards.push({
      key: `cat-${cat.id}`,
      categoryId: cat.id,
      categoryName,
      boardTitle: "League",
      subtitle:
        cat.drawType === "group_knockout"
          ? `${categoryName} · Group stage`
          : `${categoryName} · Round robin`,
      rows: standings,
    });
  }

  return boards;
}

export function buildLeaderboardPages(
  boards: LeaderboardBoard[],
  pageSize: number,
): LeaderboardPage[] {
  const pages: LeaderboardPage[] = [];
  for (const board of boards) {
    const chunks = paginateItems(board.rows, pageSize);
    const pageCount = Math.max(1, chunks.length);
    if (chunks.length === 0) {
      pages.push({
        key: `${board.key}-p0`,
        board,
        pageIndex: 0,
        pageCount: 1,
        rows: [],
      });
      continue;
    }
    chunks.forEach((rows, pageIndex) => {
      pages.push({
        key: `${board.key}-p${pageIndex}`,
        board,
        pageIndex,
        pageCount,
        rows,
      });
    });
  }
  return pages;
}

export function registrationTeamIdFromRow(row: {
  registration?: { id?: number; metaJson?: unknown } | null;
  player1?: { teamId?: number | null; auctionTeamId?: number | null } | null;
}): { registrationId: number; teamId: number } | null {
  const reg = row.registration;
  if (!reg || typeof reg.id !== "number") return null;
  const meta = (reg.metaJson ?? null) as Record<string, unknown> | null;
  const metaTeam =
    meta && typeof meta.teamId === "number" && Number.isFinite(meta.teamId)
      ? meta.teamId
      : null;
  const playerTeam =
    typeof row.player1?.teamId === "number"
      ? row.player1.teamId
      : typeof row.player1?.auctionTeamId === "number"
        ? row.player1.auctionTeamId
        : null;
  const teamId = metaTeam ?? playerTeam;
  if (teamId == null) return null;
  return { registrationId: reg.id, teamId };
}
