import ExcelJS from "exceljs";
import { JERSEY_SIZE_VALUES, JERSEY_SIZE_CHART } from "@workspace/player-registry/jersey-size";
import { LOWER_SIZE_VALUES } from "@workspace/api-base/lower-size";
import { getSportCapabilities } from "@workspace/platform-core";

export interface TemplateBuilderContext {
  tournament: {
    id: number;
    name: string;
    sport?: string | null;
    minBid?: number | null;
    currency?: string | null;
  };
  categories: Array<{ id: number; name: string; minBid?: number | null }>;
  teams: Array<{ id: number; name: string; shortCode?: string | null }>;
  sportRoles: Array<{ id: number; roleName: string }>;
  specGroups?: Array<{
    id: number;
    roleName: string;
    groupName: string;
    options: string[];
  }>;
}

interface ColumnDef {
  key: string;
  header: string;
  required: boolean;
  type: "text" | "number" | "url" | "dropdown";
  width: number;
  note: string;
  validationList?: string[];
  refRange?: string;
  numFmt?: string;
  example1: string | number;
  example2: string | number;
}

const BRAND = {
  requiredBg: "FFF59E0B", // Amber 500
  dropdownBg: "FF2563EB", // Blue 600
  optionalBg: "FF334155", // Slate 700
  headerText: "FFFFFFFF", // White
  refHeaderBg: "FF0F172A", // Slate 900
  refSubHeaderBg: "FF1E293B", // Slate 800
  border: "FFE2E8F0", // Slate 200
  sampleRowBg1: "FFFFFFFF",
  sampleRowBg2: "FFF8FAFC",
};

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const STATUS_OPTIONS = ["Available", "Retained"];
const PLAYER_TAG_OPTIONS = ["None", "Captain", "Vice Captain", "Owner", "Co-Owner", "Icon", "Star Player", "Booster"];

const CRICKET_BATTING_HANDS = ["Right-hand", "Left-hand"];
const CRICKET_BOWLING_ARMS = ["Right-arm", "Left-arm", "None"];
const CRICKET_BOWLING_STYLES = [
  "Fast",
  "Fast Medium",
  "Medium",
  "Off Spin",
  "Leg Spin",
  "Orthodox",
  "Chinaman",
  "None",
];

export function buildTemplateColumns(ctx: TemplateBuilderContext): ColumnDef[] {
  const sport = (ctx.tournament.sport || "cricket").toLowerCase();
  const isCricket = getSportCapabilities(sport).hasLegacyCricketSpecs;
  const minBid = ctx.tournament.minBid ?? 100000;

  const sampleCat1 = ctx.categories[0]?.name ?? "Category A";
  const sampleCat2 = ctx.categories[1]?.name ?? ctx.categories[0]?.name ?? "Category B";
  const sampleTeam1 = ctx.teams[0]?.name ?? "Team Tigers";
  const sampleRole1 = ctx.sportRoles[0]?.roleName ?? (isCricket ? "Batsman" : "Player");
  const sampleRole2 = ctx.sportRoles[1]?.roleName ?? (isCricket ? "Bowler" : "Player");

  const cols: ColumnDef[] = [
    {
      key: "name",
      header: "Name *",
      required: true,
      type: "text",
      width: 24,
      note: "Required: Full name of the player.",
      example1: "Rohit Sharma",
      example2: "Jasprit Bumrah",
    },
    {
      key: "mobileNumber",
      header: "Mobile Number *",
      required: true,
      type: "text",
      width: 18,
      numFmt: "@",
      note: "Required: 10-digit Indian mobile number (e.g. 9876543210). Used for player notifications and consent.",
      example1: "9876543210",
      example2: "9876543211",
    },
    {
      key: "category",
      header: "Category",
      required: false,
      type: "dropdown",
      width: 20,
      note: "Tournament category. Select from dropdown or see Instructions sheet for available categories.",
      validationList: ctx.categories.map((c) => c.name),
      refRange: ctx.categories.length > 0 ? `'Instructions & Reference'!$D$4:$D$${Math.max(4, 3 + ctx.categories.length)}` : undefined,
      example1: sampleCat1,
      example2: sampleCat2,
    },
    {
      key: "role",
      header: "Role",
      required: false,
      type: "dropdown",
      width: 18,
      note: "Sport role. Select from dropdown.",
      validationList: ctx.sportRoles.map((r) => r.roleName),
      refRange: ctx.sportRoles.length > 0 ? `'Instructions & Reference'!$J$4:$J$${Math.max(4, 3 + ctx.sportRoles.length)}` : undefined,
      example1: sampleRole1,
      example2: sampleRole2,
    },
    {
      key: "basePrice",
      header: "Base Price",
      required: false,
      type: "number",
      width: 16,
      numFmt: "#,##0",
      note: `Base auction price/points. Defaults to tournament minimum bid (${minBid.toLocaleString("en-IN")}) if blank.`,
      example1: minBid * 2,
      example2: minBid,
    },
    {
      key: "gender",
      header: "Gender",
      required: false,
      type: "dropdown",
      width: 14,
      note: "Player gender (Male, Female, Other).",
      validationList: GENDER_OPTIONS,
      example1: "Male",
      example2: "Male",
    },
    {
      key: "age",
      header: "Age",
      required: false,
      type: "number",
      width: 10,
      note: "Player age in years.",
      example1: 36,
      example2: 30,
    },
    {
      key: "city",
      header: "City",
      required: false,
      type: "text",
      width: 18,
      note: "Player city or hometown.",
      example1: "Mumbai",
      example2: "Ahmedabad",
    },
    {
      key: "jerseyNumber",
      header: "Jersey #",
      required: false,
      type: "text",
      width: 12,
      note: "Preferred kit jersey number.",
      example1: "45",
      example2: "93",
    },
    {
      key: "jerseySize",
      header: "Jersey Size",
      required: false,
      type: "dropdown",
      width: 15,
      note: "Kit shirt/jersey size: XXS, XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL.",
      validationList: [...JERSEY_SIZE_VALUES],
      example1: "L",
      example2: "XL",
    },
    {
      key: "lowerSize",
      header: "Lower Size",
      required: false,
      type: "dropdown",
      width: 14,
      note: "Kit pant/lower size: 28, 30, 32, 34, 36, 38, 40, 42, 44.",
      validationList: [...LOWER_SIZE_VALUES],
      example1: "34",
      example2: "32",
    },
    {
      key: "team",
      header: "Team",
      required: false,
      type: "dropdown",
      width: 22,
      note: "Optional team pre-assignment or retention. See Instructions sheet for available teams.",
      validationList: ctx.teams.map((t) => t.name),
      refRange: ctx.teams.length > 0 ? `'Instructions & Reference'!$G$4:$G$${Math.max(4, 3 + ctx.teams.length)}` : undefined,
      example1: sampleTeam1,
      example2: "",
    },
    {
      key: "status",
      header: "Status",
      required: false,
      type: "dropdown",
      width: 14,
      note: "Auction status: Available or Retained. If assigned to a team, select Retained.",
      validationList: STATUS_OPTIONS,
      example1: "Retained",
      example2: "Available",
    },
    {
      key: "retainedPrice",
      header: "Retained Price",
      required: false,
      type: "number",
      width: 16,
      numFmt: "#,##0",
      note: "Purse deduction for retained players. Leave blank for available players.",
      example1: minBid * 3,
      example2: "",
    },
    {
      key: "playerTag",
      header: "Player Tag",
      required: false,
      type: "dropdown",
      width: 16,
      note: "Badge tag: Captain, Vice Captain, Owner, Icon, Star Player, Booster.",
      validationList: PLAYER_TAG_OPTIONS,
      example1: "Captain",
      example2: "None",
    },
  ];

  // Sport-specific columns
  if (isCricket) {
    cols.push(
      {
        key: "batting_hand",
        header: "Batting Hand",
        required: false,
        type: "dropdown",
        width: 16,
        note: "Batting style: Right-hand or Left-hand.",
        validationList: CRICKET_BATTING_HANDS,
        example1: "Right-hand",
        example2: "Right-hand",
      },
      {
        key: "bowling_arm",
        header: "Bowling Arm",
        required: false,
        type: "dropdown",
        width: 16,
        note: "Bowling arm: Right-arm or Left-arm.",
        validationList: CRICKET_BOWLING_ARMS,
        example1: "Right-arm",
        example2: "Right-arm",
      },
      {
        key: "bowling_style",
        header: "Bowling Style",
        required: false,
        type: "dropdown",
        width: 18,
        note: "Bowling pace / spin variation.",
        validationList: CRICKET_BOWLING_STYLES,
        example1: "None",
        example2: "Fast",
      },
      {
        key: "cricheroUrl",
        header: "CricHero URL",
        required: false,
        type: "url",
        width: 32,
        note: "Link to player CricHeroes profile.",
        example1: "https://cricheroes.in/player-profile/rohit",
        example2: "https://cricheroes.in/player-profile/jasprit",
      },
    );
  } else if (sport === "badminton") {
    cols.push(
      {
        key: "playing_hand",
        header: "Playing Hand",
        required: false,
        type: "dropdown",
        width: 16,
        note: "Playing hand: Right Hand or Left Hand.",
        validationList: ["Right Hand", "Left Hand"],
        example1: "Right Hand",
        example2: "Left Hand",
      },
      {
        key: "playing_style",
        header: "Playing Style",
        required: false,
        type: "dropdown",
        width: 16,
        note: "Playing style: Attacking, Defensive, All-Round.",
        validationList: ["Attacking", "Defensive", "All-Round"],
        example1: "Attacking",
        example2: "All-Round",
      },
    );
  } else if (sport === "football") {
    cols.push({
      key: "preferred_foot",
      header: "Preferred Foot",
      required: false,
      type: "dropdown",
      width: 16,
      note: "Preferred kicking foot: Right, Left, Both.",
      validationList: ["Right", "Left", "Both"],
      example1: "Right",
      example2: "Left",
    });
  }

  // Common trailing fields
  cols.push(
    {
      key: "achievements",
      header: "Achievements",
      required: false,
      type: "text",
      width: 26,
      note: "Notable sporting achievements or honors.",
      example1: "Tournament Best Batsman 2025",
      example2: "Highest Wicket Taker",
    },
    {
      key: "email",
      header: "Email",
      required: false,
      type: "text",
      width: 24,
      note: "Player email address.",
      example1: "rohit@example.com",
      example2: "jasprit@example.com",
    },
    {
      key: "availabilityDates",
      header: "Availability Dates",
      required: false,
      type: "text",
      width: 22,
      note: "Match dates or availability window.",
      example1: "All match dates",
      example2: "All match dates",
    },
    {
      key: "photoUrl",
      header: "Photo URL",
      required: false,
      type: "url",
      width: 32,
      note: "Direct HTTPS link to player photo.",
      example1: "https://res.cloudinary.com/demo/image/upload/rohit.jpg",
      example2: "",
    },
  );

  return cols;
}

export async function buildPlayerTemplateExcel(ctx: TemplateBuilderContext): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BidWar";
  wb.lastModifiedBy = "BidWar System";
  wb.created = new Date();
  wb.modified = new Date();

  const columns = buildTemplateColumns(ctx);

  // ─── Sheet 1: Player Upload ────────────────────────────────────────────────
  const ws = wb.addWorksheet("Player Upload", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });

  // Headers
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: BRAND.headerText }, size: 11, name: "Calibri" };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  columns.forEach((col, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = col.header;

    let bg = BRAND.optionalBg;
    if (col.required) bg = BRAND.requiredBg;
    else if (col.type === "dropdown") bg = BRAND.dropdownBg;

    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
    if (col.note) {
      cell.note = col.note;
    }
    ws.getColumn(colNumber).width = col.width;
  });

  // ─── Sample Rows (Row 2 & 3) ──────────────────────────────────────────────
  const sampleRows = [
    columns.map((c) => c.example1),
    columns.map((c) => c.example2),
  ];

  sampleRows.forEach((rowVals, rIdx) => {
    const row = ws.getRow(rIdx + 2);
    row.height = 20;
    rowVals.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { size: 10, name: "Calibri" };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: BRAND.border } },
        bottom: { style: "thin", color: { argb: BRAND.border } },
        left: { style: "thin", color: { argb: BRAND.border } },
        right: { style: "thin", color: { argb: BRAND.border } },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rIdx === 0 ? BRAND.sampleRowBg1 : BRAND.sampleRowBg2 },
      };
    });
  });

  // ─── Data Validation on Player Upload Sheet ──────────────────────────────
  // Apply data validation & formatting up to row 500
  const MAX_ROWS = 500;
  for (let r = 2; r <= MAX_ROWS; r++) {
    const row = ws.getRow(r);
    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);

      // Number formats
      if (col.numFmt) {
        cell.numFmt = col.numFmt;
      }

      // Dropdown validations
      if (col.type === "dropdown") {
        if (col.refRange) {
          cell.dataValidation = {
            type: "list",
            allowBlank: !col.required,
            formulae: [col.refRange],
            showErrorMessage: true,
            errorTitle: "Invalid Selection",
            error: `Please select a valid ${col.header} from the dropdown list.`,
          };
        } else if (col.validationList && col.validationList.length > 0) {
          cell.dataValidation = {
            type: "list",
            allowBlank: !col.required,
            formulae: [`"${col.validationList.join(",")}"`],
            showErrorMessage: true,
            errorTitle: "Invalid Selection",
            error: `Please select a valid ${col.header} from the allowed options.`,
          };
        }
      }
    });
  }

  // ─── Sheet 2: Instructions & Reference ───────────────────────────────────
  const refWs = wb.addWorksheet("Instructions & Reference", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Title Row
  refWs.mergeCells("A1:N1");
  const titleCell = refWs.getCell("A1");
  titleCell.value = `BidWar Player Upload Guide & Reference — ${ctx.tournament.name}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.refHeaderBg } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  refWs.getRow(1).height = 36;

  // Instructions Header
  refWs.mergeCells("A3:B3");
  const instHead = refWs.getCell("A3");
  instHead.value = "HOW TO FILL THIS TEMPLATE";
  instHead.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  instHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.refSubHeaderBg } };

  const instructions = [
    "1. Go to the 'Player Upload' sheet.",
    "2. Row 2 and 3 are sample demonstration rows — you can overwrite or keep them.",
    "3. Columns with * (Name, Mobile Number) are MANDATORY.",
    "4. Mobile Number MUST be a 10-digit Indian phone number.",
    "5. For Category, Role, Jersey Size, Lower Size, Gender, and Status, use the cell DROPDOWN arrows.",
    "6. If a player is already retained by a team, select the Team and set Status to 'Retained'.",
    "7. Base Price defaults to the tournament minimum bid if left blank.",
    "8. Save this file as .xlsx and drop it into the BidWar Bulk Player Upload modal.",
  ];

  instructions.forEach((txt, i) => {
    const rowNum = 4 + i;
    refWs.getCell(`A${rowNum}`).value = txt;
    refWs.getCell(`A${rowNum}`).font = { size: 10, name: "Calibri" };
  });

  // Table: Categories Reference (Columns D & E)
  refWs.mergeCells("D3:E3");
  const catHead = refWs.getCell("D3");
  catHead.value = "AVAILABLE CATEGORIES";
  catHead.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  catHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dropdownBg } };
  catHead.alignment = { horizontal: "center" };

  refWs.getCell("D4").value = "Category Name";
  refWs.getCell("E4").value = "Min Bid";
  refWs.getCell("D4").font = { bold: true, size: 10 };
  refWs.getCell("E4").font = { bold: true, size: 10 };

  if (ctx.categories.length === 0) {
    refWs.getCell("D5").value = "No categories configured yet";
    refWs.getCell("D5").font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  } else {
    ctx.categories.forEach((cat, idx) => {
      const r = 4 + idx;
      refWs.getCell(`D${r}`).value = cat.name;
      refWs.getCell(`E${r}`).value = cat.minBid ?? ctx.tournament.minBid ?? "";
      if (cat.minBid) refWs.getCell(`E${r}`).numFmt = "#,##0";
    });
  }

  // Table: Teams Reference (Columns G & H)
  refWs.mergeCells("G3:H3");
  const teamHead = refWs.getCell("G3");
  teamHead.value = "AVAILABLE TEAMS";
  teamHead.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  teamHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dropdownBg } };
  teamHead.alignment = { horizontal: "center" };

  refWs.getCell("G4").value = "Team Name";
  refWs.getCell("H4").value = "Team Code";
  refWs.getCell("G4").font = { bold: true, size: 10 };
  refWs.getCell("H4").font = { bold: true, size: 10 };

  if (ctx.teams.length === 0) {
    refWs.getCell("G5").value = "No teams created yet";
    refWs.getCell("G5").font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  } else {
    ctx.teams.forEach((t, idx) => {
      const r = 4 + idx;
      refWs.getCell(`G${r}`).value = t.name;
      refWs.getCell(`H${r}`).value = t.shortCode || "";
    });
  }

  // Table: Sport Roles Reference (Columns J & K)
  refWs.mergeCells("J3:K3");
  const roleHead = refWs.getCell("J3");
  roleHead.value = "SPORT ROLES";
  roleHead.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  roleHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dropdownBg } };
  roleHead.alignment = { horizontal: "center" };

  refWs.getCell("J4").value = "Role";
  refWs.getCell("K4").value = "Sport";
  refWs.getCell("J4").font = { bold: true, size: 10 };
  refWs.getCell("K4").font = { bold: true, size: 10 };

  ctx.sportRoles.forEach((role, idx) => {
    const r = 4 + idx;
    refWs.getCell(`J${r}`).value = role.roleName;
    refWs.getCell(`K${r}`).value = ctx.tournament.sport || "cricket";
  });

  // Table: Sizing Guide Reference (Columns M & N)
  refWs.mergeCells("M3:N3");
  const sizeHead = refWs.getCell("M3");
  sizeHead.value = "APPAREL SIZE CHART";
  sizeHead.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  sizeHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.refSubHeaderBg } };
  sizeHead.alignment = { horizontal: "center" };

  refWs.getCell("M4").value = "Jersey Size (Chest)";
  refWs.getCell("N4").value = "Lower Size (Waist)";
  refWs.getCell("M4").font = { bold: true, size: 10 };
  refWs.getCell("N4").font = { bold: true, size: 10 };

  JERSEY_SIZE_VALUES.forEach((js, idx) => {
    const r = 4 + idx;
    const chart = JERSEY_SIZE_CHART[js];
    refWs.getCell(`M${r}`).value = `${js} (${chart.chest}")`;
    const ls = LOWER_SIZE_VALUES[idx];
    if (ls) refWs.getCell(`N${r}`).value = `${ls} (Waist)`;
  });

  // Column widths on Instructions sheet
  refWs.getColumn("A").width = 54;
  refWs.getColumn("B").width = 4;
  refWs.getColumn("C").width = 3;
  refWs.getColumn("D").width = 22;
  refWs.getColumn("E").width = 14;
  refWs.getColumn("F").width = 3;
  refWs.getColumn("G").width = 24;
  refWs.getColumn("H").width = 14;
  refWs.getColumn("I").width = 3;
  refWs.getColumn("J").width = 18;
  refWs.getColumn("K").width = 14;
  refWs.getColumn("L").width = 3;
  refWs.getColumn("M").width = 22;
  refWs.getColumn("N").width = 20;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildPlayerTemplateCsv(ctx: TemplateBuilderContext): string {
  const columns = buildTemplateColumns(ctx);
  const escapeCsv = (str: unknown) => {
    const s = str == null ? "" : String(str);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = columns.map((c) => escapeCsv(c.key)).join(",");
  const row1 = columns.map((c) => escapeCsv(c.example1)).join(",");
  const row2 = columns.map((c) => escapeCsv(c.example2)).join(",");

  return `${headerLine}\n${row1}\n${row2}\n`;
}
