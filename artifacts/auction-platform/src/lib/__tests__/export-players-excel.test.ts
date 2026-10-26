import { describe, expect, it } from "vitest";
import { collectSpecColumnLabels } from "@workspace/api-base/player-spec-export";
import { buildPlayerExportRows } from "@workspace/api-base/export-players-rows";
import { exportPlayersToExcel } from "../export-players-excel";

describe("exportPlayersToExcel", () => {
  it("builds dynamic spec columns per sport", async () => {
    const labels = collectSpecColumnLabels([
      {
        specifications: [
          { specGroupId: 1, groupName: "Playing Hand", value: "Left" },
          { specGroupId: 2, groupName: "Playing Style", value: "Attacking" },
        ],
      },
      {
        specifications: [
          { specGroupId: 3, groupName: "Batting Hand", value: "Right" },
        ],
      },
    ]);

    expect(labels).toContain("Playing Hand");
    expect(labels).toContain("Batting Hand");
    expect(labels).not.toContain("Batting Style");
  });

  it("throws when no players", async () => {
    await expect(
      exportPlayersToExcel([], {}, {}, "empty.xlsx"),
    ).rejects.toThrow("No players to export.");
  });

  it("includes custom questions columns in exported player rows", () => {
    const players = [
      {
        id: 1,
        serialNo: 1,
        name: "Test Player",
        customAnswers: {
          q1: "Medium",
          q2: ["Mon", "Wed"],
        },
      },
    ];
    const customQuestions = [
      { id: "q1", label: "T-Shirt Size", type: "dropdown" as const, required: true },
      { id: "q2", label: "Days Available", type: "multiple_choice" as const, required: false },
    ];
    const rows = buildPlayerExportRows(players, {}, {}, null, customQuestions);
    expect(rows[0]["T-Shirt Size"]).toBe("Medium");
    expect(rows[0]["Days Available"]).toBe("Mon, Wed");
  });
});
