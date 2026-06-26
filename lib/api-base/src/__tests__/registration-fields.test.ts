import { describe, expect, it } from "vitest";
import {
  buildRegistrationFieldVisibility,
  parseRegistrationFieldsConfig,
  serializeRegistrationFieldsConfig,
  validateMandatoryRegistrationFields,
} from "../registration-fields";

describe("registration-fields", () => {
  it("defaults all optional fields to visible", () => {
    const visibility = buildRegistrationFieldVisibility(null);
    expect(visibility.email).toBe(true);
    expect(visibility.city).toBe(true);
    expect(visibility.whatsappConsent).toBe(true);
  });

  it("parses hidden optional fields", () => {
    const config = parseRegistrationFieldsConfig({
      hidden: ["email", "city", "invalid"],
    });
    expect(config.hidden).toEqual(["email", "city"]);
    expect(buildRegistrationFieldVisibility(config).email).toBe(false);
    expect(buildRegistrationFieldVisibility(config).age).toBe(true);
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
