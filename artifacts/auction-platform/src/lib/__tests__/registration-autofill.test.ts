import { describe, expect, it } from "vitest";
import {
  changedAutofillFieldIds,
  changedSpecFieldIds,
  mergeGlobalProfile,
  mergeTournamentProfile,
  projectSpecSelections,
  type AutofillFormFields,
} from "../registration-autofill";

function emptyForm(overrides: Partial<AutofillFormFields> = {}): AutofillFormFields {
  return {
    name: "",
    city: "",
    age: "",
    gender: "",
    role: "Doubles Player",
    photoUrl: "",
    battingStyle: "",
    bowlingStyle: "",
    specialization: "",
    jerseyNumber: "",
    jerseySize: "",
    achievements: "",
    cricheroUrl: "",
    availabilityDates: "2027-08-01",
    categoryId: "",
    teamId: "",
    ...overrides,
  };
}

describe("registration autofill field tracking", () => {
  it("highlights only tournament fields the lookup actually wrote", () => {
    const before = emptyForm({ name: "Typed Name" });
    const after = mergeTournamentProfile(before, {
      name: "",
      city: "Mumbai",
      age: 24,
      gender: "M",
      role: "Doubles Player",
      photoUrl: null,
      jerseyNumber: "7",
      jerseySize: null,
      achievements: null,
    });

    expect(changedAutofillFieldIds(before, after)).toEqual(["city", "age", "gender", "jerseyNumber"]);
    expect(after.name).toBe("Typed Name");
    expect(after.role).toBe("Doubles Player");
  });

  it("does not highlight a global profile field the player already filled", () => {
    const before = emptyForm({ name: "Already typed", city: "" });
    const after = mergeGlobalProfile(before, {
      name: "Saved Name",
      city: "Pune",
      age: 0,
      role: "Singles Player",
    });

    expect(after.name).toBe("Already typed");
    expect(after.age).toBe("");
    expect(after.role).toBe("Doubles Player");
    expect(changedAutofillFieldIds(before, after)).toEqual(["city"]);
  });

  it("returns no fields when the lookup matches the current form", () => {
    const before = emptyForm({ name: "Asha", city: "Mumbai", age: "21" });
    const after = mergeTournamentProfile(before, { name: "Asha", city: "Mumbai", age: 21 });
    expect(changedAutofillFieldIds(before, after)).toEqual([]);
  });

  it("ignores email because lookup does not write it", () => {
    const before = emptyForm();
    const after = mergeGlobalProfile(before, { name: "Asha" });
    expect(changedAutofillFieldIds(before, after)).not.toContain("email");
    expect(changedAutofillFieldIds(before, after)).toEqual(["name"]);
  });

  it("highlights only spec groups whose selected value changed", () => {
    const specs = [
      { id: 42, displayOrder: 1 },
      { id: 45, displayOrder: 4 },
    ];
    const next = projectSpecSelections(
      { 42: "Right Hand" },
      specs,
      { 45: "Back Court Specialist" },
      { battingStyle: "Right Hand" },
    );

    expect(next[42]).toBe("Right Hand");
    expect(next[45]).toBe("Back Court Specialist");
    expect(changedSpecFieldIds({ 42: "Right Hand" }, next)).toEqual(["spec:45"]);
  });
});
