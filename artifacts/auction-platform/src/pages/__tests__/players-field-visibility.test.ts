import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildRegistrationFieldVisibility,
  buildRegistrationFieldRequirements,
  parseRegistrationFieldsConfig,
} from "@workspace/api-base";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Players Form Field Rules & Visibility Integration", () => {
  const playersPageSrc = readFileSync(
    path.resolve(__dirname, "../players.tsx"),
    "utf8",
  );

  it("imports buildRegistrationFieldVisibility from @workspace/api-base in players.tsx", () => {
    expect(playersPageSrc).toContain("buildRegistrationFieldVisibility");
  });

  it("computes fieldVisibility and fieldRequirements in PlayerForm", () => {
    expect(playersPageSrc).toMatch(/const fieldVisibility = useMemo\(\(\) => \{[\s\S]*buildRegistrationFieldVisibility\(regConfig/);
    expect(playersPageSrc).toMatch(/const fieldRequirements = useMemo\(\(\) => \{[\s\S]*buildRegistrationFieldRequirements\(regConfig/);
  });

  it("gates optional and configurable fields behind show* visibility flags", () => {
    expect(playersPageSrc).toContain("const showPhoto = fieldVisibility.photo !== false;");
    expect(playersPageSrc).toContain("const showRole = fieldVisibility.role !== false;");
    expect(playersPageSrc).toContain("const showEmail = fieldVisibility.email !== false;");
    expect(playersPageSrc).toContain("const showCity = fieldVisibility.city !== false;");
    expect(playersPageSrc).toContain("const showAge = fieldVisibility.age !== false;");
    expect(playersPageSrc).toContain("const showGender = fieldVisibility.gender !== false;");
    expect(playersPageSrc).toContain("const showJerseyNumber = fieldVisibility.jerseyNumber !== false;");
    expect(playersPageSrc).toContain("const showJerseySize = fieldVisibility.jerseySize !== false;");
    expect(playersPageSrc).toContain("const showLowerSize = fieldVisibility.lowerSize !== false;");
    expect(playersPageSrc).toContain("const showJersey = showJerseyNumber || showJerseySize || showLowerSize;");
    expect(playersPageSrc).toContain("const showAchievements = fieldVisibility.achievements !== false;");
    expect(playersPageSrc).toContain("const showCrichero = sportCaps.hasLegacyCricketSpecs && fieldVisibility.cricheroUrl !== false;");
    expect(playersPageSrc).toContain("const showMatchAvailability = fieldVisibility.matchAvailability !== false;");
  });

  it("conditionally renders Basic Information fields based on visibility", () => {
    expect(playersPageSrc).toContain("{showEmail && (");
    expect(playersPageSrc).toContain("{showCity && (");
    expect(playersPageSrc).toContain("{showAge && (");
    expect(playersPageSrc).toContain("{showGender && (");
  });

  it("conditionally renders Uniform & Kit Sizing and its sub-fields", () => {
    expect(playersPageSrc).toContain("{showJersey && (");
    expect(playersPageSrc).toContain("{showJerseyNumber && (");
    expect(playersPageSrc).toContain("{showJerseySize && (");
    expect(playersPageSrc).toContain("{showLowerSize && (");
  });

  it("conditionally renders Photo & Profile Details section and CricHero URL", () => {
    expect(playersPageSrc).toContain("{showPhotoProfileSection && (");
    expect(playersPageSrc).toContain("{showPhoto && (");
    expect(playersPageSrc).toContain("{showAchievements && (");
    expect(playersPageSrc).toContain("{showCrichero && (");
    expect(playersPageSrc).toContain("{showMatchAvailability && (");
  });

  it("accurately handles user tournament settings (Hidden: city, age, lowerSize, cricheroUrl)", () => {
    const rawConfig = {
      hidden: ["city", "age", "lowerSize", "cricheroUrl"],
      required: ["photo", "role", "email"],
    };
    const regConfig = parseRegistrationFieldsConfig(rawConfig);
    const visibility = buildRegistrationFieldVisibility(regConfig, "cricket");
    const requirements = buildRegistrationFieldRequirements(regConfig, "cricket");

    // Hidden fields must be false
    expect(visibility.city).toBe(false);
    expect(visibility.age).toBe(false);
    expect(visibility.lowerSize).toBe(false);
    expect(visibility.cricheroUrl).toBe(false);

    // Visible fields must be true
    expect(visibility.photo).toBe(true);
    expect(visibility.role).toBe(true);
    expect(visibility.email).toBe(true);
    expect(visibility.gender).toBe(true);
    expect(visibility.jerseyNumber).toBe(true);
    expect(visibility.jerseySize).toBe(true);
    expect(visibility.achievements).toBe(true);
    expect(visibility.matchAvailability).toBe(true);

    // Required flags
    expect(requirements.photo).toBe(true);
    expect(requirements.role).toBe(true);
    expect(requirements.email).toBe(true);

    // Optional flags
    expect(requirements.gender).toBe(false);
    expect(requirements.jerseyNumber).toBe(false);
    expect(requirements.jerseySize).toBe(false);
    expect(requirements.achievements).toBe(false);
    expect(requirements.matchAvailability).toBe(false);

    // Hidden fields can never be required
    expect(requirements.city).toBe(false);
    expect(requirements.age).toBe(false);
    expect(requirements.lowerSize).toBe(false);
    expect(requirements.cricheroUrl).toBe(false);
  });
});
