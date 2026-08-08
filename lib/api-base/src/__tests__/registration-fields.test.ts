import { describe, expect, it } from "vitest";
import {
  buildRegistrationFieldVisibility,
  parseRegistrationFieldsConfig,
  serializeRegistrationFieldsConfig,
  validateMandatoryRegistrationFields,
} from "../registration-fields";

describe("registration-fields", () => {
  it("defaults optional fields to visible for cricket including CricHero", () => {
    const visibility = buildRegistrationFieldVisibility(null, "cricket");
    expect(visibility.email).toBe(true);
    expect(visibility.city).toBe(true);
    expect(visibility.whatsappConsent).toBe(true);
    expect(visibility.cricheroUrl).toBe(true);
  });

  it("hides CricHero for badminton even when organizer did not hide it", () => {
    expect(buildRegistrationFieldVisibility(null, "badminton").cricheroUrl).toBe(false);
  });

  it("parses hidden optional fields", () => {
    const config = parseRegistrationFieldsConfig({
      hidden: ["email", "city", "invalid"],
    });
    expect(config.hidden).toEqual(["email", "city"]);
    expect(buildRegistrationFieldVisibility(config, "cricket").email).toBe(false);
    expect(buildRegistrationFieldVisibility(config, "cricket").age).toBe(true);
  });

  it("serializes hidden field list", () => {
    expect(
      serializeRegistrationFieldsConfig(["city", "city", "bad"]),
    ).toEqual({ hidden: ["city"] });
  });

  it("requires name, mobile, photo, and role", () => {
    expect(
      validateMandatoryRegistrationFields({
        name: "Player",
        mobileNumber: "9876543210",
        photoUrl: "https://cdn.example/p.png",
        role: "Batsman",
      }).ok,
    ).toBe(true);

    expect(
      validateMandatoryRegistrationFields({
        name: "Player",
        mobileNumber: "9876543210",
        role: "Batsman",
      }),
    ).toEqual({
      ok: false,
      error: "Player photo is required.",
      field: "photoUrl",
    });
  });
});
