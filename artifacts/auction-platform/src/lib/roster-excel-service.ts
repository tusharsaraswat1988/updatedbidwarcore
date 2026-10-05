import type { Player, Team } from "@workspace/api-client-react";

export interface ParsedRosterPlayer {
  id?: number; // Present if updating an existing player
  action: "new" | "update";
  teamId: number;
  teamName: string;
  name: string;
  role: "Batsman" | "Bowler" | "All Rounder" | "Wicket Keeper";
  battingStyle: "Right Hand" | "Left Hand";
  bowlingStyle: string;
  jerseyNumber?: string;
  jerseySize?: string;
  dob?: string;
  mobileNumber?: string;
  city?: string;
  photoUrl?: string;
  rowNumber: number;
}

export interface ParsedRosterResult {
  validRows: ParsedRosterPlayer[];
  errors: { row: number; player: string; message: string }[];
  warnings: { row: number; player: string; message: string }[];
  newCount: number;
  updateCount: number;
  totalRows: number;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").trim() || "Tournament";
}

function normalizeStr(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

export function parseBattingStyle(raw?: string): "Right Hand" | "Left Hand" {
  if (!raw) return "Right Hand";
  const lower = raw.toLowerCase();
  if (lower.includes("left") || lower.includes("lhb")) return "Left Hand";
  return "Right Hand";
}

export function parseRole(raw?: string): "Batsman" | "Bowler" | "All Rounder" | "Wicket Keeper" {
  if (!raw) return "Batsman";
  const lower = raw.toLowerCase();
  if (lower.includes("wicket") || lower.includes("wk") || lower.includes("keeper")) return "Wicket Keeper";
  if (lower.includes("all") || lower.includes("ar")) return "All Rounder";
  if (lower.includes("bowl")) return "Bowler";
  return "Batsman";
}

export function parseBowlingStyle(raw?: string): string {
  if (!raw) return "None";
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "none" || trimmed === "—" || trimmed === "-") {
    return "None";
  }
  return trimmed;
}

/**
 * Generates an Excel workbook template (.xlsx) for Cricket Player Roster.
 * If mode is "prefill", populates with current players and their stable Player IDs.
 * If mode is "blank", generates an empty template with 2 sample demonstration rows.
 */
export async function exportRosterTemplateToExcel({
  tournamentName = "Tournament",
  teams,
  existingPlayers = [],
  mode = "blank",
}: {
  tournamentName?: string;
  teams: Team[];
  existingPlayers?: Player[];
  mode?: "blank" | "prefill";
}): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const teamById = new Map<number, Team>();
  for (const t of teams) teamById.set(t.id, t);

  const colWidths = [
    { wch: 18 }, // Player ID (Do Not Change)
    { wch: 18 }, // Team Code *
    { wch: 24 }, // Team Name
    { wch: 24 }, // Player Name *
    { wch: 18 }, // Role
    { wch: 16 }, // Batting Style
    { wch: 22 }, // Bowling Style
    { wch: 12 }, // Jersey #
    { wch: 14 }, // Jersey Size
    { wch: 16 }, // DOB (YYYY-MM-DD)
    { wch: 16 }, // Mobile
    { wch: 16 }, // City
    { wch: 45 }, // Photo URL
  ];

  let rows: Record<string, unknown>[] = [];

  if (mode === "prefill" && existingPlayers.length > 0) {
    const sorted = [...existingPlayers].sort((a, b) => (a.teamId ?? 999999) - (b.teamId ?? 999999));
    rows = sorted.map((p) => {
      const team = p.teamId != null ? teamById.get(p.teamId) : undefined;
      return {
        "Player ID (Do Not Change)": p.id,
        "Team Code *": team?.shortCode || team?.accessCode || (team?.id ? String(team.id) : ""),
        "Team Name": team?.name || "Unassigned",
        "Player Name *": p.name || "",
        Role: p.role || "Batsman",
        "Batting Style": p.battingStyle || "Right Hand",
        "Bowling Style": p.bowlingStyle || "None",
        "Jersey #": p.jerseyNumber ? String(p.jerseyNumber).replace("#", "") : "",
        "Jersey Size": p.jerseySize || "",
        "DOB (YYYY-MM-DD)": "",
        Mobile: p.mobileNumber || "",
        City: p.city || "",
        "Photo URL": p.photoUrl || "",
      };
    });
  } else {
    // Blank template with sample rows for the organizer
    const sampleTeam = teams[0];
    const sampleCode = sampleTeam?.shortCode || "TEAM1";
    const sampleName = sampleTeam?.name || "Sample Warriors";

    rows = [
      {
        "Player ID (Do Not Change)": "",
        "Team Code *": sampleCode,
        "Team Name": sampleName,
        "Player Name *": "Aarav Sharma",
        Role: "Batsman",
        "Batting Style": "Right Hand",
        "Bowling Style": "None",
        "Jersey #": "7",
        "Jersey Size": "36",
        "DOB (YYYY-MM-DD)": "2014-05-12",
        Mobile: "9876543210",
        City: "Varanasi",
        "Photo URL": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      },
      {
        "Player ID (Do Not Change)": "",
        "Team Code *": sampleCode,
        "Team Name": sampleName,
        "Player Name *": "Rohan Verma",
        Role: "All Rounder",
        "Batting Style": "Right Hand",
        "Bowling Style": "Right Arm Medium",
        "Jersey #": "18",
        "Jersey Size": "38",
        "DOB (YYYY-MM-DD)": "2013-09-22",
        Mobile: "9876543211",
        City: "Varanasi",
        "Photo URL": "",
      },
    ];
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Cricket Roster");

  // Reference & Instructions Sheet
  const instructionsRows = [
    { "HOW TO USE THIS TEMPLATE": "1. Fill in player details in the 'Cricket Roster' sheet." },
    { "HOW TO USE THIS TEMPLATE": "2. For NEW players: Leave the 'Player ID (Do Not Change)' column EMPTY." },
    { "HOW TO USE THIS TEMPLATE": "3. To UPDATE existing players: Keep the 'Player ID' number unchanged." },
    { "HOW TO USE THIS TEMPLATE": "4. Match teams using 'Team Code *' or 'Team Name' exactly as shown below." },
    { "HOW TO USE THIS TEMPLATE": "5. Save this file as .xlsx and upload it on the Player Roster page." },
    { "HOW TO USE THIS TEMPLATE": "" },
    { "HOW TO USE THIS TEMPLATE": "AVAILABLE TEAMS IN TOURNAMENT:" },
    ...teams.map((t) => ({
      "HOW TO USE THIS TEMPLATE": `• Team: ${t.name} | Code: ${t.shortCode || t.id}`,
    })),
    { "HOW TO USE THIS TEMPLATE": "" },
    { "HOW TO USE THIS TEMPLATE": "VALID VALUES FOR COLUMNS:" },
    { "HOW TO USE THIS TEMPLATE": "• Role: Batsman, Bowler, All Rounder, Wicket Keeper" },
    { "HOW TO USE THIS TEMPLATE": "• Batting Style: Right Hand, Left Hand" },
    { "HOW TO USE THIS TEMPLATE": "• Bowling Style: Right Arm Fast, Right Arm Medium, Right Arm Spin, Left Arm Fast, None" },
    { "HOW TO USE THIS TEMPLATE": "• Jersey Size: 32, 34, 36, 38, 40, S, M, L, XL" },
  ];

  const refWs = XLSX.utils.json_to_sheet(instructionsRows);
  refWs["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, refWs, "Instructions & Teams");

  const filename = `${sanitizeFilename(tournamentName)}-${mode === "prefill" ? "Current-Roster" : "Roster-Template"}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Parses and validates an uploaded Excel or CSV file.
 * Performs dry-run matching, assigns team IDs, distinguishes new vs update players,
 * and collects all errors and warnings before any database write.
 */
export async function parseRosterExcelFile(
  file: File,
  teams: Team[],
  existingPlayers: Player[],
): Promise<ParsedRosterResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes("roster") || s.toLowerCase().includes("player")) ??
    wb.SheetNames[0];

  if (!sheetName) {
    throw new Error("No readable worksheet found in the uploaded file.");
  }

  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: "",
  });

  if (rawRows.length === 0) {
    throw new Error("The selected sheet is empty. Please add player rows and upload again.");
  }

  // Build lookup maps
  const existingById = new Map<number, Player>();
  for (const p of existingPlayers) existingById.set(p.id, p);

  // Teams lookup: by shortCode (lower), accessCode (lower), and team name (lower)
  const teamByCode = new Map<string, Team>();
  const teamByName = new Map<string, Team>();
  for (const t of teams) {
    if (t.shortCode) teamByCode.set(t.shortCode.trim().toLowerCase(), t);
    if (t.accessCode) teamByCode.set(t.accessCode.trim().toLowerCase(), t);
    teamByCode.set(String(t.id), t);
    teamByName.set(t.name.trim().toLowerCase(), t);
  }

  const validRows: ParsedRosterPlayer[] = [];
  const errors: { row: number; player: string; message: string }[] = [];
  const warnings: { row: number; player: string; message: string }[] = [];
  let newCount = 0;
  let updateCount = 0;

  function findVal(row: Record<string, unknown>, keys: string[]): string {
    const rowKeys = Object.keys(row);
    for (const target of keys) {
      const match = rowKeys.find((k) => k.trim().toLowerCase() === target.toLowerCase());
      if (match && row[match] != null) {
        return normalizeStr(row[match]);
      }
    }
    return "";
  }

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1-based header is row 1, data starts at row 2

    // Check if entire row is empty or instruction row
    const rawName = findVal(row, ["Player Name *", "Player Name", "Player", "name", "P1 Name", "Name"]);
    if (!rawName || rawName.toLowerCase().startsWith("sample") || rawName.toLowerCase().includes("how to use")) {
      return;
    }

    // 1. Resolve Team
    const rawTeamCode = findVal(row, ["Team Code *", "Team Code", "team_code", "Code", "Short Code", "teamCode"]);
    const rawTeamName = findVal(row, ["Team Name", "Team", "team_name", "teamName"]);

    let matchedTeam: Team | undefined;
    if (rawTeamCode) {
      matchedTeam = teamByCode.get(rawTeamCode.toLowerCase());
    }
    if (!matchedTeam && rawTeamName) {
      matchedTeam = teamByName.get(rawTeamName.toLowerCase());
      if (!matchedTeam) {
        // Partial search
        matchedTeam = teams.find((t) => t.name.toLowerCase().includes(rawTeamName.toLowerCase()));
      }
    }

    if (!matchedTeam) {
      errors.push({
        row: rowNumber,
        player: rawName,
        message: `Team not found. Could not match team code '${rawTeamCode || rawTeamName}'. Check team list in Instructions tab.`,
      });
      return;
    }

    // 2. Resolve Player Identity (New vs Update)
    const rawPlayerId = findVal(row, ["Player ID (Do Not Change)", "Player ID", "player_id", "id", "BidWar Player ID"]);
    let parsedId: number | undefined;
    let action: "new" | "update" = "new";

    if (rawPlayerId) {
      const num = parseInt(rawPlayerId, 10);
      if (!isNaN(num) && existingById.has(num)) {
        parsedId = num;
        action = "update";
      } else if (!isNaN(num)) {
        warnings.push({
          row: rowNumber,
          player: rawName,
          message: `Player ID '${rawPlayerId}' does not belong to this tournament. Will create as a new player.`,
        });
      }
    }

    // If no valid ID provided, check if a player with identical name exists in this tournament team
    if (!parsedId) {
      const existingInTeam = existingPlayers.find(
        (p) => p.teamId === matchedTeam?.id && p.name.trim().toLowerCase() === rawName.toLowerCase(),
      );
      if (existingInTeam) {
        parsedId = existingInTeam.id;
        action = "update";
        warnings.push({
          row: rowNumber,
          player: rawName,
          message: `Matched existing player in ${matchedTeam.name} by name. Will update profile.`,
        });
      }
    }

    // 3. Normalize Player Attributes
    const role = parseRole(findVal(row, ["Role", "role", "Player Role"]));
    const battingStyle = parseBattingStyle(findVal(row, ["Batting Style", "batting_style", "Batting", "Batting Hand"]));
    const bowlingStyle = parseBowlingStyle(findVal(row, ["Bowling Style", "bowling_style", "Bowling", "Bowling Type"]));
    const jerseyNumber = findVal(row, ["Jersey #", "Jersey Number", "jersey_number", "Jersey", "JerseyNo"]).replace(/#/g, "");
    const jerseySize = findVal(row, ["Jersey Size", "jersey_size", "Size"]);
    const dob = findVal(row, ["DOB (YYYY-MM-DD)", "DOB", "dob", "Date of Birth"]);
    const mobileNumber = findVal(row, ["Mobile", "Mobile Number", "mobile", "Parent Mobile", "Phone"]);
    const city = findVal(row, ["City", "city"]);
    const photoUrl = findVal(row, ["Photo URL", "photo_url", "Photo", "Image URL", "Photo URL (Cloudinary)"]);

    if (action === "new") {
      newCount++;
    } else {
      updateCount++;
    }

    validRows.push({
      id: parsedId,
      action,
      teamId: matchedTeam.id,
      teamName: matchedTeam.name,
      name: rawName,
      role,
      battingStyle,
      bowlingStyle,
      jerseyNumber: jerseyNumber || undefined,
      jerseySize: jerseySize || undefined,
      dob: dob || undefined,
      mobileNumber: mobileNumber || undefined,
      city: city || undefined,
      photoUrl: photoUrl?.startsWith("http") ? photoUrl : undefined,
      rowNumber,
    });
  });

  return {
    validRows,
    errors,
    warnings,
    newCount,
    updateCount,
    totalRows: rawRows.length,
  };
}
