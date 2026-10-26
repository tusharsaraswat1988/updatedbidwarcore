import { describe, expect, it } from "vitest";
import {
  buildRegistrationFieldVisibility,
  buildRegistrationFieldRequirements,
  isRegistrationFieldRequired,
  parseRegistrationFieldsConfig,
  serializeRegistrationFieldsConfig,
  validateMandatoryRegistrationFields,
  validateCustomQuestionsDefinition,
  validateCustomAnswers,
  validateRegistrationFieldsUpdate,
  type RegistrationCustomQuestion,
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
      serializeRegistrationFieldsConfig(["city", "city", "bad" as any]),
    ).toEqual({ hidden: ["city"] });
  });

  it("serializes and parses custom questions seamlessly", () => {
    const questions: RegistrationCustomQuestion[] = [
      { id: "q1", label: "T-Shirt Size", type: "dropdown", required: true, options: ["M", "L", "XL"] },
      { id: "q2", label: "Years Experience", type: "number", required: false },
    ];
    const serialized = serializeRegistrationFieldsConfig(["email"], questions);
    expect(serialized.hidden).toEqual(["email"]);
    expect(serialized.customQuestions).toEqual(questions);

    const parsed = parseRegistrationFieldsConfig(serialized);
    expect(parsed.hidden).toEqual(["email"]);
    expect(parsed.customQuestions).toEqual(questions);
  });

  it("validates question definition with 5 types and option checking", () => {
    const valid = validateCustomQuestionsDefinition([
      { id: "q_text", label: "Bio", type: "short_text", required: false },
      { id: "q_num", label: "Age", type: "number", required: true },
      { id: "q_single", label: "Role", type: "single_choice", required: true, options: ["A", "B"] },
      { id: "q_multi", label: "Hobbies", type: "multiple_choice", required: false, options: ["X", "Y"] },
      { id: "q_drop", label: "City", type: "dropdown", required: true, options: ["Delhi", "Mumbai"] },
    ]);
    expect(valid.ok).toBe(true);

    const invalid = validateCustomQuestionsDefinition([
      { id: "q_single", label: "Role", type: "single_choice", required: true, options: [] },
    ]);
    expect(invalid.ok).toBe(false);
  });

  it("validates answers against questions", () => {
    const questions: RegistrationCustomQuestion[] = [
      { id: "q_req", label: "Required Question", type: "short_text", required: true },
      { id: "q_opt", label: "Optional Choice", type: "single_choice", required: false, options: ["Yes", "No"] },
    ];

    expect(validateCustomAnswers(questions, {}).ok).toBe(false);
    expect(validateCustomAnswers(questions, { q_req: "My answer", q_opt: "Yes" }).ok).toBe(true);
    expect(validateCustomAnswers(questions, { q_req: "My answer", q_opt: "Invalid" }).ok).toBe(false);
  });

  it("requires name, mobile, photo, and role by default", () => {
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

  it("supports organizer-controlled mandatory and optional fields", () => {
    const config = {
      hidden: ["jerseyNumber" as const],
      required: ["city" as const, "email" as const],
    };
    const reqs = buildRegistrationFieldRequirements(config);
    expect(reqs.city).toBe(true);
    expect(reqs.email).toBe(true);
    expect(reqs.photo).toBe(false);
    expect(reqs.role).toBe(false);
    expect(reqs.jerseyNumber).toBe(false); // hidden fields cannot be required

    expect(isRegistrationFieldRequired("name", config)).toBe(true);
    expect(isRegistrationFieldRequired("mobile", config)).toBe(true);
    expect(isRegistrationFieldRequired("city", config)).toBe(true);
    expect(isRegistrationFieldRequired("photo", config)).toBe(false);
  });

  it("rejects configuration where a hidden field is marked required", () => {
    const res = validateRegistrationFieldsUpdate({
      hidden: ["city"],
      required: ["city"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('Hidden fields cannot be required: "city"');
    }
  });
});
