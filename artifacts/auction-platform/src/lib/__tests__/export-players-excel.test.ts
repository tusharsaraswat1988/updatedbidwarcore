import { describe, expect, it } from "vitest";
import { collectSpecColumnLabels } from "@workspace/api-base/player-spec-export";
import { exportPlayersToExcel } from "../../export-players-excel";

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
});
