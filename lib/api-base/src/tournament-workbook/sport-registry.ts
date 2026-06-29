/**
 * Sport-aware BMW configuration — roles, match settings, reference data.
 * Add new sports here without redesigning the workbook engine.
 */

export type SportRoleDefinition = {
  code: string;
  label: string;
  aliases?: string[];
};

export type SportConfig = {
  id: string;
  label: string;
  roles: SportRoleDefinition[];
  matchSettingKeys?: string[];
  categoryHints?: string[];
};

const CRICKET_ROLES: SportRoleDefinition[] = [
  { code: "batsman", label: "Batsman", aliases: ["BAT", "Batter"] },
  { code: "bowler", label: "Bowler", aliases: ["BOWL"] },
  { code: "all_rounder", label: "All-Rounder", aliases: ["AR", "All Rounder"] },
  { code: "wicket_keeper", label: "Wicket-Keeper", aliases: ["WK", "Keeper", "Wicket Keeper"] },
];

const BADMINTON_ROLES: SportRoleDefinition[] = [
  { code: "singles", label: "Singles" },
  { code: "doubles", label: "Doubles" },
  { code: "mixed", label: "Mixed" },
];

const FOOTBALL_ROLES: SportRoleDefinition[] = [
  { code: "goalkeeper", label: "Goalkeeper", aliases: ["GK", "Keeper"] },
  { code: "defender", label: "Defender", aliases: ["DEF"] },
  { code: "midfielder", label: "Midfielder", aliases: ["MID"] },
  { code: "forward", label: "Forward", aliases: ["FWD", "Striker"] },
];

const VOLLEYBALL_ROLES: SportRoleDefinition[] = [
  { code: "setter", label: "Setter" },
  { code: "outside_hitter", label: "Outside Hitter", aliases: ["OH"] },
  { code: "middle_blocker", label: "Middle Blocker", aliases: ["MB"] },
  { code: "libero", label: "Libero" },
  { code: "opposite", label: "Opposite", aliases: ["OPP"] },
];

const KABADDI_ROLES: SportRoleDefinition[] = [
  { code: "raider", label: "Raider" },
  { code: "defender", label: "Defender" },
  { code: "all_rounder", label: "All-Rounder", aliases: ["AR"] },
];

const TENNIS_ROLES: SportRoleDefinition[] = [
  { code: "singles", label: "Singles" },
  { code: "doubles", label: "Doubles" },
  { code: "mixed_doubles", label: "Mixed Doubles" },
];

const TABLE_TENNIS_ROLES: SportRoleDefinition[] = [
  { code: "singles", label: "Singles" },
  { code: "doubles", label: "Doubles" },
  { code: "mixed", label: "Mixed" },
];

const BASKETBALL_ROLES: SportRoleDefinition[] = [
  { code: "point_guard", label: "Point Guard", aliases: ["PG"] },
  { code: "shooting_guard", label: "Shooting Guard", aliases: ["SG"] },
  { code: "small_forward", label: "Small Forward", aliases: ["SF"] },
  { code: "power_forward", label: "Power Forward", aliases: ["PF"] },
  { code: "center", label: "Center", aliases: ["C"] },
];

const HOCKEY_ROLES: SportRoleDefinition[] = [
  { code: "goalkeeper", label: "Goalkeeper", aliases: ["GK"] },
  { code: "defender", label: "Defender" },
  { code: "midfielder", label: "Midfielder" },
  { code: "forward", label: "Forward" },
];

const GENERIC_ROLES: SportRoleDefinition[] = [
  { code: "player", label: "Player" },
  { code: "captain", label: "Captain" },
  { code: "substitute", label: "Substitute" },
];

export const SPORT_REGISTRY: Record<string, SportConfig> = {
  cricket: {
    id: "cricket",
    label: "Cricket",
    roles: CRICKET_ROLES,
    matchSettingKeys: ["overs", "powerplay", "super_over"],
    categoryHints: ["Open", "Masters", "Women"],
  },
  badminton: {
    id: "badminton",
    label: "Badminton",
    roles: BADMINTON_ROLES,
    matchSettingKeys: ["best_of", "points_per_game"],
  },
  football: {
    id: "football",
    label: "Football",
    roles: FOOTBALL_ROLES,
    matchSettingKeys: ["match_duration", "extra_time"],
  },
  volleyball: {
    id: "volleyball",
    label: "Volleyball",
    roles: VOLLEYBALL_ROLES,
    matchSettingKeys: ["sets_to_win", "points_per_set"],
  },
  kabaddi: {
    id: "kabaddi",
    label: "Kabaddi",
    roles: KABADDI_ROLES,
    matchSettingKeys: ["raid_time", "match_duration"],
  },
  tennis: {
    id: "tennis",
    label: "Tennis",
    roles: TENNIS_ROLES,
    matchSettingKeys: ["sets", "tiebreak"],
  },
  table_tennis: {
    id: "table_tennis",
    label: "Table Tennis",
    roles: TABLE_TENNIS_ROLES,
    matchSettingKeys: ["best_of", "points_per_game"],
  },
  basketball: {
    id: "basketball",
    label: "Basketball",
    roles: BASKETBALL_ROLES,
    matchSettingKeys: ["quarters", "shot_clock"],
  },
  hockey: {
    id: "hockey",
    label: "Hockey",
    roles: HOCKEY_ROLES,
    matchSettingKeys: ["quarters", "penalty_shootout"],
  },
  generic: {
    id: "generic",
    label: "Generic",
    roles: GENERIC_ROLES,
  },
};

export function normalizeSportId(raw: unknown): string {
  const s = String(raw ?? "cricket").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "table tennis": "table_tennis",
    tabletennis: "table_tennis",
    soccer: "football",
    "field hockey": "hockey",
  };
  return aliases[s] ?? s.replace(/\s+/g, "_");
}

export function getSportConfig(sport: unknown): SportConfig {
  const id = normalizeSportId(sport);
  return SPORT_REGISTRY[id] ?? SPORT_REGISTRY.generic!;
}

export function getRolesForSport(sport: unknown): SportRoleDefinition[] {
  return getSportConfig(sport).roles;
}

export function getRoleLabelsForSport(sport: unknown): string[] {
  return getRolesForSport(sport).map((r) => r.label);
}

/** Resolve a raw role string to canonical code for the sport */
export function resolveRoleForSport(sport: unknown, rawRole: unknown): string | null {
  if (rawRole == null || rawRole === "") return null;
  const normalized = String(rawRole).trim().toLowerCase();
  const config = getSportConfig(sport);

  for (const role of config.roles) {
    if (role.code === normalized || role.label.toLowerCase() === normalized) return role.code;
    if (role.aliases?.some((a) => a.toLowerCase() === normalized)) return role.code;
  }
  return null;
}

export function isValidRoleForSport(sport: unknown, rawRole: unknown): boolean {
  if (rawRole == null || rawRole === "") return true;
  return resolveRoleForSport(sport, rawRole) != null;
}

export function listRegisteredSports(): SportConfig[] {
  return Object.values(SPORT_REGISTRY);
}
