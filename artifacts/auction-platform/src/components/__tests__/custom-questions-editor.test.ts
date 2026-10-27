import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  validateCustomQuestionsDefinition,
  sanitizeCustomQuestionOptions,
  type RegistrationCustomQuestion,
} from "@workspace/api-base/registration-fields";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Custom Questions Editor & Settings Card Integration", () => {
  const editorPath = path.resolve(__dirname, "../registration/custom-questions-editor.tsx");
  const editorSrc = readFileSync(editorPath, "utf8");

  const settingsPagePath = path.resolve(__dirname, "../../pages/tournament-settings.tsx");
  const settingsPageSrc = readFileSync(settingsPagePath, "utf8");

  describe("1. CustomQuestionsEditor UI/UX capabilities", () => {
    it("provides inline option updating capability", () => {
      expect(editorSrc).toContain("handleUpdateOption");
      expect(editorSrc).toContain("handleMoveOption");
      expect(editorSrc).toContain("handleRemoveOption");
      expect(editorSrc).toContain("handleAddOption");
    });

    it("supports keyboard Enter shortcut on option inputs to add next option", () => {
      expect(editorSrc).toContain('e.key === "Enter"');
      expect(editorSrc).toContain("handleAddOption(idx");
    });

    it("supports duplicating questions", () => {
      expect(editorSrc).toContain("handleDuplicateQuestion");
      expect(editorSrc).toContain("Copy");
    });

    it("provides a bottom add-question button for quick access without scrolling to top", () => {
      expect(editorSrc).toContain("Add Another Question");
    });

    it("renders editable inputs for choice question options instead of static tags", () => {
      // Must map options into an Input with onChange handleUpdateOption
      expect(editorSrc).toContain("handleUpdateOption(idx, optIdx, e.target.value)");
      expect(editorSrc).toContain("placeholder={`Option ${optIdx + 1}`}");
    });
  });

  describe("2. Tournament Settings Integration & Full-Width Card", () => {
    it("renders Custom Registration Questions as a dedicated full-width card", () => {
      expect(settingsPageSrc).toContain('title="Custom Registration Questions"');
      expect(settingsPageSrc).toContain('className="lg:col-span-2"');
    });

    it("imports and enforces validateCustomQuestionsDefinition in settings save validation", () => {
      expect(settingsPageSrc).toContain("validateCustomQuestionsDefinition");
      expect(settingsPageSrc).toContain("validateCustomQuestionsDefinition(customQuestions)");
    });

    it("correctly identifies valid and invalid custom questions definitions", () => {
      const validQuestions: RegistrationCustomQuestion[] = [
        {
          id: "q_1",
          label: "Batting Style",
          type: "single_choice",
          required: true,
          options: ["Right Hand", "Left Hand"],
        },
        {
          id: "q_2",
          label: "Jersey Name",
          type: "short_text",
          required: false,
        },
      ];
      const validRes = validateCustomQuestionsDefinition(validQuestions);
      expect(validRes.ok).toBe(true);

      const invalidEmptyLabel: RegistrationCustomQuestion[] = [
        {
          id: "q_3",
          label: "",
          type: "short_text",
          required: false,
        },
      ];
      const invalidRes1 = validateCustomQuestionsDefinition(invalidEmptyLabel);
      expect(invalidRes1.ok).toBe(false);

      const invalidNoOptions: RegistrationCustomQuestion[] = [
        {
          id: "q_4",
          label: "Choices",
          type: "single_choice",
          required: false,
          options: [],
        },
      ];
      const invalidRes2 = validateCustomQuestionsDefinition(invalidNoOptions);
      expect(invalidRes2.ok).toBe(false);
    });
  });
});
