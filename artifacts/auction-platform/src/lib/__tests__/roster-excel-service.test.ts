import { describe, it, expect } from "vitest";
import {
  parseBattingStyle,
  parseRole,
  parseBowlingStyle,
} from "../roster-excel-service";

describe("roster-excel-service parsing utilities", () => {
  it("normalizes batting styles correctly", () => {
    expect(parseBattingStyle("Right Hand")).toBe("Right Hand");
    expect(parseBattingStyle("Right-hand")).toBe("Right Hand");
    expect(parseBattingStyle("Left Hand")).toBe("Left Hand");
    expect(parseBattingStyle("LHB")).toBe("Left Hand");
    expect(parseBattingStyle("")).toBe("Right Hand"); // default
    expect(parseBattingStyle(undefined)).toBe("Right Hand");
  });

  it("normalizes roles correctly", () => {
    expect(parseRole("Batsman")).toBe("Batsman");
    expect(parseRole("Bowler")).toBe("Bowler");
    expect(parseRole("All Rounder")).toBe("All Rounder");
    expect(parseRole("Wicket Keeper")).toBe("Wicket Keeper");
    expect(parseRole("WK")).toBe("Wicket Keeper");
    expect(parseRole("all-rounder")).toBe("All Rounder");
    expect(parseRole("")).toBe("Batsman"); // default
  });

  it("normalizes bowling styles correctly", () => {
    expect(parseBowlingStyle("Right Arm Medium")).toBe("Right Arm Medium");
    expect(parseBowlingStyle("Right Arm Fast")).toBe("Right Arm Fast");
    expect(parseBowlingStyle("None")).toBe("None");
    expect(parseBowlingStyle("—")).toBe("None");
    expect(parseBowlingStyle("")).toBe("None");
  });

  it("parses an in-memory Excel workbook with new and update players", async () => {
    const XLSX = await import("xlsx");
    const { parseRosterExcelFile } = await import("../roster-excel-service");

    const wb = XLSX.utils.book_new();
    const rows = [
      {
        "Player ID (Do Not Change)": "",
        "Team Code *": "WARRIORS",
        "Team Name": "Ishita Warriors",
        "Player Name *": "Gopal Pandey",
        Role: "Batsman",
        "Batting Style": "Right Hand",
        "Bowling Style": "None",
        "Jersey #": "5",
        "Jersey Size": "32",
        "DOB (YYYY-MM-DD)": "2015-06-23",
        Mobile: "9793168475",
        City: "Varanasi",
        "Photo URL": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      },
      {
        "Player ID (Do Not Change)": 101,
        "Team Code *": "WARRIORS",
        "Team Name": "Ishita Warriors",
        "Player Name *": "Varshit Jaiswal",
        Role: "All Rounder",
        "Batting Style": "Right Hand",
        "Bowling Style": "Right Arm Medium",
        "Jersey #": "7",
        "Jersey Size": "34",
        "DOB (YYYY-MM-DD)": "2016-02-11",
        Mobile: "7668454551",
        City: "Varanasi",
        "Photo URL": "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Cricket Roster");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const file = new File([buf], "roster.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const mockTeams: any[] = [
      { id: 1, name: "Ishita Warriors", shortCode: "WARRIORS" },
    ];
    const mockPlayers: any[] = [
      { id: 101, name: "Varshit Jaiswal", teamId: 1, jerseyNumber: "1" },
    ];

    const result = await parseRosterExcelFile(file, mockTeams, mockPlayers);

    expect(result.validRows.length).toBe(2);
    expect(result.newCount).toBe(1);
    expect(result.updateCount).toBe(1);
    expect(result.errors.length).toBe(0);

    // Verify Row 1: New Player
    expect(result.validRows[0].action).toBe("new");
    expect(result.validRows[0].name).toBe("Gopal Pandey");
    expect(result.validRows[0].teamId).toBe(1);
    expect(result.validRows[0].jerseyNumber).toBe("5");

    // Verify Row 2: Update Player
    expect(result.validRows[1].action).toBe("update");
    expect(result.validRows[1].id).toBe(101);
    expect(result.validRows[1].name).toBe("Varshit Jaiswal");
    expect(result.validRows[1].jerseyNumber).toBe("7");
    expect(result.validRows[1].role).toBe("All Rounder");
  });
});
