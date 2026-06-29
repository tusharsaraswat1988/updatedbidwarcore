import { describe, expect, it } from "vitest";
import {
  formatPlayerGenderForWorkbook,
  parseWorkbookGenderLabel,
  WORKBOOK_GENDER_LABELS,
} from "../player-gender.ts";

describe("workbook gender helpers", () => {
  it("exports website-aligned labels", () => {
    expect(WORKBOOK_GENDER_LABELS).toEqual(["Male", "Female", "Not specified"]);
  });

  it("formats stored codes for Excel", () => {
    expect(formatPlayerGenderForWorkbook("M")).toBe("Male");
    expect(formatPlayerGenderForWorkbook("F")).toBe("Female");
    expect(formatPlayerGenderForWorkbook(null)).toBe("Not specified");
    expect(formatPlayerGenderForWorkbook(undefined)).toBe("Not specified");
  });

  it("parses workbook labels to DB codes", () => {
    expect(parseWorkbookGenderLabel("Male")).toBe("M");
    expect(parseWorkbookGenderLabel("Female")).toBe("F");
    expect(parseWorkbookGenderLabel("Not specified")).toBe(null);
    expect(parseWorkbookGenderLabel("")).toBe(undefined);
    expect(parseWorkbookGenderLabel(undefined)).toBe(undefined);
    expect(parseWorkbookGenderLabel("Other")).toBe(undefined);
  });
});
