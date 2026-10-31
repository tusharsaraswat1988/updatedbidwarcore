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
  { code: "singles", label: "Singles Player", aliases: ["Singles"] },
  { code: "doubles", label: "Doubles Player", aliases: ["Doubles"] },
  { code: "mixed", label: "Mixed Doubles", aliases: ["Mixed"] },
];

const FOOTBALL_ROLES: SportRoleDefinition[] = [
  { code: "goalkeeper", label: "Goalkeeper (GK)", aliases: ["Goalkeeper", "GK", "Keeper", "Shot stopper", "Sweeper Keeper", "Backup Goalkeeper"] },
  { code: "defender", label: "Defender", aliases: ["DEF", "Centre-Back", "CB", "Left-Back", "LB", "Right-Back", "RB", "Wing-Back", "LWB", "RWB"] },
  { code: "midfielder", label: "Midfielder", aliases: ["MID", "Defensive Midfielder", "CDM", "Central Midfielder", "CM", "Attacking Midfielder", "CAM", "Left Midfielder", "LM", "Right Midfielder", "RM", "Left/Right Midfielder"] },
  { code: "forward", label: "Forward", aliases: ["FWD", "Striker", "ST", "Centre-Forward", "CF", "Left Winger", "LW", "Right Winger", "RW", "Second Striker", "SS"] },
];

const VOLLEYBALL_ROLES: SportRoleDefinition[] = [
  { code: "setter", label: "Setter" },
  { code: "libero", label: "Libero" },
  { code: "outside_hitter", label: "Outside Hitter", aliases: ["OH"] },
  { code: "middle_blocker", label: "Middle Blocker", aliases: ["MB"] },
  { code: "opposite", label: "Opposite Hitter", aliases: ["OPP", "Opposite"] },
];

const KABADDI_ROLES: SportRoleDefinition[] = [
  { code: "raider", label: "Raider" },
  { code: "defender", label: "Defender" },
  { code: "all_rounder", label: "All-Rounder", aliases: ["AR"] },
];

const TENNIS_ROLES: SportRoleDefinition[] = [
  { code: "singles", label: "Singles Player", aliases: ["Singles"] },
  { code: "doubles", label: "Doubles Specialist", aliases: ["Doubles"] },
  { code: "mixed_doubles", label: "Mixed Doubles Specialist", aliases: ["Mixed Doubles", "Mixed"] },
  { code: "all_court", label: "All-Court Player", aliases: ["All-Court"] },
];

const TABLE_TENNIS_ROLES: SportRoleDefinition[] = [
  { code: "offensive_attacker", label: "Offensive Attacker", aliases: ["Attacker", "Offensive"] },
  { code: "all_round", label: "All-Round Player", aliases: ["All-Round"] },
  { code: "defensive_chopper", label: "Defensive Chopper", aliases: ["Chopper", "Defensive"] },
  { code: "doubles", label: "Doubles Specialist", aliases: ["Doubles"] },
];

const BASKETBALL_ROLES: SportRoleDefinition[] = [
  { code: "point_guard", label: "Point Guard (PG)", aliases: ["PG", "Point Guard"] },
  { code: "shooting_guard", label: "Shooting Guard (SG)", aliases: ["SG", "Shooting Guard"] },
  { code: "small_forward", label: "Small Forward (SF)", aliases: ["SF", "Small Forward"] },
  { code: "power_forward", label: "Power Forward (PF)", aliases: ["PF", "Power Forward"] },
  { code: "center", label: "Center (C)", aliases: ["C", "Center"] },
];

const HOCKEY_ROLES: SportRoleDefinition[] = [
  { code: "goalkeeper", label: "Goalkeeper (GK)", aliases: ["GK", "Goalkeeper"] },
  { code: "defender", label: "Defender" },
  { code: "midfielder", label: "Midfielder" },
  { code: "forward", label: "Forward / Striker", aliases: ["Forward", "Striker"] },
];

const CHESS_ROLES: SportRoleDefinition[] = [
  { code: "board_1", label: "Board 1 (Top Board)", aliases: ["Board 1", "Top Board"] },
  { code: "board_2", label: "Board 2 (Senior Board)", aliases: ["Board 2", "Senior Board"] },
  { code: "board_3", label: "Board 3 (Junior Board)", aliases: ["Board 3", "Junior Board"] },
  { code: "board_4", label: "Board 4 (Women's Board)", aliases: ["Board 4", "Women's Board"] },
  { code: "reserve", label: "Reserve / Open Board", aliases: ["Reserve", "Open Board"] },
];

const PICKLEBALL_ROLES: SportRoleDefinition[] = [
  { code: "singles", label: "Singles Player", aliases: ["Singles"] },
  { code: "doubles", label: "Doubles Specialist", aliases: ["Doubles"] },
  { code: "mixed_doubles", label: "Mixed Doubles Specialist", aliases: ["Mixed Doubles", "Mixed"] },
  { code: "dinking_specialist", label: "Dinking / Defensive Specialist", aliases: ["Dinking Specialist", "Defensive"] },
];

const SQUASH_ROLES: SportRoleDefinition[] = [
  { code: "singles", label: "Singles Player", aliases: ["Singles"] },
  { code: "top_seed", label: "Top Seed / Board 1", aliases: ["Top Seed", "Board 1"] },
  { code: "veterans", label: "Masters / Veterans", aliases: ["Masters", "Veterans"] },
  { code: "junior", label: "Junior Player", aliases: ["Junior"] },
];

const CARROM_ROLES: SportRoleDefinition[] = [
  { code: "singles", label: "Singles Player", aliases: ["Singles"] },
  { code: "doubles", label: "Doubles Specialist", aliases: ["Doubles"] },
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
  chess: {
    id: "chess",
    label: "Chess",
    roles: CHESS_ROLES,
  },
  pickleball: {
    id: "pickleball",
    label: "Pickleball",
    roles: PICKLEBALL_ROLES,
  },
  squash: {
    id: "squash",
    label: "Squash",
    roles: SQUASH_ROLES,
  },
  carrom: {
    id: "carrom",
    label: "Carrom",
    roles: CARROM_ROLES,
  },
  generic: {
    id: "generic",
    label: "Generic",
    roles: GENERIC_ROLES,
  },
};

export function normalizeSportId(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "table tennis": "table_tennis",
    tabletennis: "table_tennis",
    soccer: "football",
    "field hockey": "hockey",
  };
  return aliases[s] ?? s.replace(/[\s-]+/g, "_");
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
