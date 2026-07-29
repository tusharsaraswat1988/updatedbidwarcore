/**
 * CSV / structured import for Fixture Collections (drawKind: imported).
 *
 * Headers (case-insensitive): round, slot, player_a|side_a, player_b|side_b
 * Unresolved names become label-only sides in fixture metaJson (match side JSON shape).
 */

export type ParsedDrawCsvRow = {
  roundName?: string;
  slotNumber?: number;
  playerA: string;
  playerB: string;
  /** 1-based data row index (excluding header) for error messages. */
  rowNumber: number;
};

export type ImportFixtureSide =
  | { registrationId: number; label: string }
  | { registrationId: null; label: string };

export type ResolvedImportFixture = {
  slotNumber: number;
  roundName?: string;
  sideA: ImportFixtureSide;
  sideB: ImportFixtureSide;
};

export type RegistrationNameEntry = {
  registrationId: number;
  /** Display labels that should resolve to this registration (already normalized). */
  aliases: string[];
};

/** Match-side JSON shape used on fixtures for unresolved import sides. */
export type FixtureSideLabelJson = {
  label: string;
  shortLabel?: string;
};

export function normalizeImportName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ");
}

export function playerDisplayName(p: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
} | null | undefined): string {
  if (!p) return "";
  if (p.displayName?.trim()) return p.displayName.trim();
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
}

export function registrationDisplayLabel(
  player1: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null,
  player2?: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null,
): string {
  const a = playerDisplayName(player1);
  const b = playerDisplayName(player2 ?? null);
  if (a && b) return `${a} / ${b}`;
  return a || b;
}

/** Build alias → registrationId map. First registration wins on collisions. */
export function buildRegistrationAliasMap(
  entries: RegistrationNameEntry[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      const key = normalizeImportName(alias);
      if (!key || map.has(key)) continue;
      map.set(key, entry.registrationId);
    }
  }
  return map;
}

export function buildAliasesForRegistration(input: {
  registrationId: number;
  player1: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null;
  player2?: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null;
}): RegistrationNameEntry {
  const aliases: string[] = [];
  const pair = registrationDisplayLabel(input.player1, input.player2 ?? null);
  if (pair) aliases.push(pair);
  const p1 = playerDisplayName(input.player1);
  const p2 = playerDisplayName(input.player2 ?? null);
  if (p1) aliases.push(p1);
  if (p2) aliases.push(p2);
  // Compact doubles form without spaces around slash
  if (p1 && p2) aliases.push(`${p1}/${p2}`);
  return { registrationId: input.registrationId, aliases };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

type ColumnMap = {
  round?: number;
  slot?: number;
  playerA?: number;
  playerB?: number;
};

function mapHeaders(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((raw, index) => {
    const h = normalizeHeader(raw);
    if (h === "round" || h === "round_name" || h === "roundname") map.round = index;
    else if (h === "slot" || h === "slot_number" || h === "slotnumber" || h === "match") {
      map.slot = index;
    } else if (
      h === "player_a" ||
      h === "playera" ||
      h === "side_a" ||
      h === "sidea" ||
      h === "a"
    ) {
      map.playerA = index;
    } else if (
      h === "player_b" ||
      h === "playerb" ||
      h === "side_b" ||
      h === "sideb" ||
      h === "b"
    ) {
      map.playerB = index;
    }
  });
  return map;
}

export class FixtureImportParseError extends Error {
  constructor(
    message: string,
    public code: string = "IMPORT_CSV_INVALID",
  ) {
    super(message);
    this.name = "FixtureImportParseError";
  }
}

/**
 * Parse a draw CSV. Requires a header row with player_a/side_a and player_b/side_b.
 */
export function parseDrawCsv(csv: string): ParsedDrawCsvRow[] {
  const text = csv.replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new FixtureImportParseError("CSV is empty");
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new FixtureImportParseError(
      "CSV needs a header row and at least one fixture row",
    );
  }

  const headers = parseCsvLine(lines[0]);
  const cols = mapHeaders(headers);
  if (cols.playerA == null || cols.playerB == null) {
    throw new FixtureImportParseError(
      "CSV header must include player_a (or side_a) and player_b (or side_b)",
    );
  }

  const rows: ParsedDrawCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const playerA = (cells[cols.playerA] ?? "").trim();
    const playerB = (cells[cols.playerB] ?? "").trim();
    if (!playerA && !playerB) continue;

    if (!playerA || !playerB) {
      throw new FixtureImportParseError(
        `Row ${i}: both player_a and player_b are required`,
      );
    }

    let slotNumber: number | undefined;
    if (cols.slot != null) {
      const raw = (cells[cols.slot] ?? "").trim();
      if (raw) {
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 1) {
          throw new FixtureImportParseError(
            `Row ${i}: slot must be a positive integer`,
          );
        }
        slotNumber = n;
      }
    }

    const roundRaw =
      cols.round != null ? (cells[cols.round] ?? "").trim() : "";

    rows.push({
      roundName: roundRaw || undefined,
      slotNumber,
      playerA,
      playerB,
      rowNumber: i,
    });
  }

  if (rows.length === 0) {
    throw new FixtureImportParseError("CSV has no fixture rows");
  }

  return rows;
}

function resolveSide(
  name: string,
  aliasMap: Map<string, number>,
): ImportFixtureSide {
  const key = normalizeImportName(name);
  const registrationId = aliasMap.get(key) ?? null;
  return { registrationId, label: name.trim() };
}

export function resolveImportFixtures(
  rows: Array<{
    playerA: string;
    playerB: string;
    roundName?: string;
    slotNumber?: number;
  }>,
  aliasMap: Map<string, number>,
): ResolvedImportFixture[] {
  return rows.map((row, index) => ({
    slotNumber: row.slotNumber ?? index + 1,
    roundName: row.roundName?.trim() || undefined,
    sideA: resolveSide(row.playerA, aliasMap),
    sideB: resolveSide(row.playerB, aliasMap),
  }));
}

export function sideLabelJson(label: string): FixtureSideLabelJson {
  const trimmed = label.trim();
  const short =
    trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || trimmed.slice(0, 3).toUpperCase();
  return { label: trimmed, shortLabel: short };
}

/** Fixture metaJson for imported sides — always keep labels; registration IDs live on columns. */
export function buildImportedFixtureMeta(fixture: ResolvedImportFixture): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    sideA: sideLabelJson(fixture.sideA.label),
    sideB: sideLabelJson(fixture.sideB.label),
  };
  if (fixture.roundName) meta.roundName = fixture.roundName;
  return meta;
}
