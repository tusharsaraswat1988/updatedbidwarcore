import { describe, expect, it } from "vitest";
import { LOWER_SIZE_VALUES, isLowerSize, normalizeLowerSize } from "@workspace/api-base/lower-size";
import { sanitizeRegistrationInputByVisibility } from "../lib/registration-field-validation.js";
import {
  REGISTRATION_CONFIGURABLE_FIELD_KEYS,
  REGISTRATION_PERMANENT_MANDATORY_FIELD_KEYS,
  buildRegistrationFieldRequirements,
  buildRegistrationFieldVisibility,
  isRegistrationFieldRequired,
  isRegistrationFieldVisible,
  parseRegistrationFieldsConfig,
  serializeRegistrationFieldsConfig,
  validateRegistrationFieldsUpdate,
  validatePlayerRegistrationRequirements,
  validateMandatoryRegistrationFields,
  type RegistrationCustomQuestion,
  type RegistrationFieldsConfig,
} from "@workspace/api-base/registration-fields";

describe("BIDWAR — Configurable Registration Fields (Mandatory / Optional / Hidden)", () => {
  // 1 & 2: Name, Mobile Number, and WhatsApp Consent cannot be optional
  describe("1 & 2: Permanently mandatory fields (Name, Mobile, and WhatsApp Consent)", () => {
    it("never allows Name to be optional or hidden", () => {
      expect(isRegistrationFieldRequired("name", null)).toBe(true);
      expect(isRegistrationFieldRequired("name", { required: [] })).toBe(true);
      expect(isRegistrationFieldRequired("name", { hidden: ["name" as any], required: [] })).toBe(true);

      const parsed = parseRegistrationFieldsConfig({ hidden: ["name"], required: [] });
      expect(parsed.hidden).not.toContain("name");

      const updateVal = validateRegistrationFieldsUpdate({ hidden: ["name"] });
      expect(updateVal.ok).toBe(false);
      if (!updateVal.ok) {
        expect(updateVal.error).toContain("cannot be hidden");
      }

      const res = validatePlayerRegistrationRequirements(
        { mobileNumber: "9876543210", whatsappConsent: true },
        { required: [] },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe("name");
        expect(res.error).toBe("Full name is required.");
      }
    });

    it("never allows Mobile Number to be optional or hidden", () => {
      expect(isRegistrationFieldRequired("mobile", null)).toBe(true);
      expect(isRegistrationFieldRequired("mobile", { required: [] })).toBe(true);
      expect(isRegistrationFieldRequired("mobile", { hidden: ["mobile" as any], required: [] })).toBe(true);

      const parsed = parseRegistrationFieldsConfig({ hidden: ["mobile"], required: [] });
      expect(parsed.hidden).not.toContain("mobile");

      const updateVal = validateRegistrationFieldsUpdate({ hidden: ["mobile"] });
      expect(updateVal.ok).toBe(false);
      if (!updateVal.ok) {
        expect(updateVal.error).toContain("cannot be hidden");
      }

      const res = validatePlayerRegistrationRequirements(
        { name: "Sachin", whatsappConsent: true },
        { required: [] },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe("mobileNumber");
        expect(res.error).toBe("Mobile number is required.");
      }
    });

    it("never allows WhatsApp Consent to be optional or hidden", () => {
      expect(isRegistrationFieldRequired("whatsappConsent", null)).toBe(true);
      expect(isRegistrationFieldRequired("whatsappConsent", { required: [] })).toBe(true);
      expect(isRegistrationFieldRequired("whatsappConsent", { hidden: ["whatsappConsent" as any], required: [] })).toBe(true);

      const parsed = parseRegistrationFieldsConfig({ hidden: ["whatsappConsent" as any], required: [] });
      expect(parsed.hidden).not.toContain("whatsappConsent");

      const updateVal = validateRegistrationFieldsUpdate({ hidden: ["whatsappConsent" as any] });
      expect(updateVal.ok).toBe(false);
      if (!updateVal.ok) {
        expect(updateVal.error).toContain("cannot be hidden");
      }

      const res = validatePlayerRegistrationRequirements(
        { name: "Sachin", mobileNumber: "9876543210", whatsappConsent: false },
        { required: [] },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe("whatsappConsent");
        expect(res.error).toBe("WhatsApp consent is required to complete registration.");
      }
    });
  });

  // 3 & 4: Photo required vs optional
  describe("3 & 4: Photo configuration", () => {
    it("rejects missing photo when photo is required", () => {
      const config: RegistrationFieldsConfig = { required: ["photo"] };
      const res = validatePlayerRegistrationRequirements(
        { name: "Player", mobileNumber: "9876543210", role: "Batsman", whatsappConsent: true },
        config,
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe("photoUrl");
        expect(res.error).toBe("Player photo is required.");
      }
    });

    it("accepts missing photo when photo is configured as optional", () => {
      const config: RegistrationFieldsConfig = { required: ["role"] }; // photo is optional
      const res = validatePlayerRegistrationRequirements(
        { name: "Player", mobileNumber: "9876543210", role: "Batsman", whatsappConsent: true },
        config,
      );
      expect(res.ok).toBe(true);
    });
  });

  // 5 & 6: Role required vs optional
  describe("5 & 6: Role configuration", () => {
    it("rejects missing role when role is required", () => {
      const config: RegistrationFieldsConfig = { required: ["role"] };
      const res = validatePlayerRegistrationRequirements(
        { name: "Player", mobileNumber: "9876543210", photoUrl: "https://cdn.example.com/p.jpg", whatsappConsent: true },
        config,
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe("role");
        expect(res.error).toBe("Role is required.");
      }
    });

    it("accepts missing role when role is configured as optional", () => {
      const config: RegistrationFieldsConfig = { required: ["photo"] }; // role is optional
      const res = validatePlayerRegistrationRequirements(
        { name: "Player", mobileNumber: "9876543210", photoUrl: "https://cdn.example.com/p.jpg", whatsappConsent: true },
        config,
      );
      expect(res.ok).toBe(true);
    });
  });

  // 7: Every supported optional profile field can be configured as required
  describe("7: Every supported profile field can be configured as required", () => {
    const baseValid = {
      name: "Virat",
      mobileNumber: "9876543210",
      photoUrl: "https://cdn.example.com/v.jpg",
      role: "Batsman",
      whatsappConsent: true,
    };

    it("enforces required email", () => {
      const config: RegistrationFieldsConfig = { required: ["email"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, email: "virat@example.com" }, config).ok).toBe(true);
    });

    it("enforces required city", () => {
      const config: RegistrationFieldsConfig = { required: ["city"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, city: "Delhi" }, config).ok).toBe(true);
    });

    it("enforces required age", () => {
      const config: RegistrationFieldsConfig = { required: ["age"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, age: 35 }, config).ok).toBe(true);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, age: 0 }, config).ok).toBe(false);
    });

    it("enforces required gender", () => {
      const config: RegistrationFieldsConfig = { required: ["gender"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, gender: "M" }, config).ok).toBe(true);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, gender: "Invalid" }, config).ok).toBe(false);
    });

    it("enforces required jerseyNumber", () => {
      const config: RegistrationFieldsConfig = { required: ["jerseyNumber"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, jerseyNumber: "18" }, config).ok).toBe(true);
    });

    it("enforces required jerseySize", () => {
      const config: RegistrationFieldsConfig = { required: ["jerseySize"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, jerseySize: "L" }, config).ok).toBe(true);
    });

    it("enforces required lowerSize", () => {
      const config: RegistrationFieldsConfig = { required: ["lowerSize"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, lowerSize: "32" }, config).ok).toBe(true);
    });

    it("enforces required achievements", () => {
      const config: RegistrationFieldsConfig = { required: ["achievements"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, achievements: "Top scorer" }, config).ok).toBe(true);
    });

    it("enforces required cricheroUrl in cricket", () => {
      const config: RegistrationFieldsConfig = { required: ["cricheroUrl"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config, { sportId: "cricket" }).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, cricheroUrl: "https://cricheroes.in/p/1" }, config, { sportId: "cricket" }).ok).toBe(true);
    });

    it("enforces required matchAvailability when match dates exist", () => {
      const config: RegistrationFieldsConfig = { required: ["matchAvailability"] };
      expect(validatePlayerRegistrationRequirements(baseValid, config, { hasMatchDates: true }).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements({ ...baseValid, availabilityDates: "2026-11-01,2026-11-02" }, config, { hasMatchDates: true }).ok).toBe(true);
    });

    it("ensures whatsappConsent is permanently mandatory and cannot be configured", () => {
      // Configuration cannot mark whatsappConsent as a configurable required field
      const updateVal = validateRegistrationFieldsUpdate({ required: ["whatsappConsent"] });
      expect(updateVal.ok).toBe(false);
      if (!updateVal.ok) {
        expect(updateVal.error).toContain("is permanently mandatory");
      }

      // Even if legacy config had it, parser strips it out
      const parsed = parseRegistrationFieldsConfig({ required: ["whatsappConsent"] });
      expect(parsed.required).not.toContain("whatsappConsent");

      // buildRegistrationFieldRequirements always returns true for whatsappConsent
      const reqs = buildRegistrationFieldRequirements({ required: [] });
      expect(reqs.whatsappConsent).toBe(true);

      // Player registration without whatsappConsent is rejected
      expect(validatePlayerRegistrationRequirements({ ...baseValid, whatsappConsent: false }, { required: [] }).ok).toBe(false);
      expect(validatePlayerRegistrationRequirements(baseValid, { required: [] }).ok).toBe(true);
    });
  });

  // 8: Optional fields accept empty values
  describe("8: Optional fields accept empty values", () => {
    it("accepts empty optional fields when not configured as required", () => {
      const config: RegistrationFieldsConfig = { required: [] }; // all optional
      const res = validatePlayerRegistrationRequirements(
        {
          name: "Rohit",
          mobileNumber: "9876543210",
          photoUrl: "",
          role: "",
          email: "",
          city: "",
          age: null,
          gender: "",
          jerseyNumber: "",
          jerseySize: "",
          lowerSize: "",
          achievements: "",
          cricheroUrl: "",
          availabilityDates: "",
          whatsappConsent: true,
        },
        config,
      );
      expect(res.ok).toBe(true);
    });
  });

  // 9: Hidden fields cannot be required
  describe("9: Hidden fields cannot be required", () => {
    it("rejects configuration update if a hidden field is also marked required", () => {
      const res = validateRegistrationFieldsUpdate({
        hidden: ["city"],
        required: ["city", "email"],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('Hidden fields cannot be required: "city"');
      }
    });

    it("ensures buildRegistrationFieldRequirements returns false for hidden fields", () => {
      const config: RegistrationFieldsConfig = {
        hidden: ["city"],
        required: ["city", "email"],
      };
      const reqs = buildRegistrationFieldRequirements(config);
      expect(reqs.city).toBe(false);
      expect(reqs.email).toBe(true);
    });

    it("filters out hidden fields from required during serialization", () => {
      const serialized = serializeRegistrationFieldsConfig(["city"], ["city", "email"]);
      expect(serialized.hidden).toEqual(["city"]);
      expect(serialized.required).toEqual(["email"]);
    });
  });

  // 10: Sport-inapplicable fields are handled correctly
  describe("10: Sport-inapplicable fields", () => {
    it("does not enforce cricheroUrl in non-cricket sports even if in required list", () => {
      const config: RegistrationFieldsConfig = { required: ["cricheroUrl"] };
      const res = validatePlayerRegistrationRequirements(
        {
          name: "Saina",
          mobileNumber: "9876543210",
          photoUrl: "https://cdn.example.com/s.jpg",
          role: "Singles",
          whatsappConsent: true,
        },
        config,
        { sportId: "badminton" },
      );
      expect(res.ok).toBe(true);
    });

    it("does not enforce matchAvailability if tournament has no match dates", () => {
      const config: RegistrationFieldsConfig = { required: ["matchAvailability"] };
      const res = validatePlayerRegistrationRequirements(
        {
          name: "Saina",
          mobileNumber: "9876543210",
          photoUrl: "https://cdn.example.com/s.jpg",
          role: "Singles",
          whatsappConsent: true,
        },
        config,
        { hasMatchDates: false },
      );
      expect(res.ok).toBe(true);
    });
  });

  // 11: Backward compatibility for existing configurations
  describe("11: Backward compatibility for existing configurations", () => {
    it("defaults to photo and role being required when required property is undefined", () => {
      const legacyConfig: RegistrationFieldsConfig = {
        hidden: ["jerseyNumber", "achievements"],
      };

      const reqs = buildRegistrationFieldRequirements(legacyConfig);
      expect(reqs.photo).toBe(true);
      expect(reqs.role).toBe(true);
      expect(reqs.email).toBe(false);
      expect(reqs.city).toBe(false);
      expect(reqs.age).toBe(false);
      expect(reqs.gender).toBe(false);
      expect(reqs.jerseyNumber).toBe(false);
      expect(reqs.achievements).toBe(false);

      expect(isRegistrationFieldRequired("photo", legacyConfig)).toBe(true);
      expect(isRegistrationFieldRequired("role", legacyConfig)).toBe(true);
      expect(isRegistrationFieldRequired("email", legacyConfig)).toBe(false);
      expect(isRegistrationFieldRequired("name", legacyConfig)).toBe(true);
      expect(isRegistrationFieldRequired("mobile", legacyConfig)).toBe(true);
    });

    it("legacy validateMandatoryRegistrationFields preserves photo and role requirement when config omitted", () => {
      const res = validateMandatoryRegistrationFields({
        name: "Player",
        mobileNumber: "9876543210",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe("photoUrl");
      }
    });

    it("legacy validateMandatoryRegistrationFields honors optional photo and role when config provided", () => {
      const config: RegistrationFieldsConfig = { required: [] };
      const res = validateMandatoryRegistrationFields(
        {
          name: "Player",
          mobileNumber: "9876543210",
        },
        config,
      );
      expect(res.ok).toBe(true);
    });
  });

  // 13: Pre-fixed Lower Size options and visibility behavior
  describe("13: Pre-fixed Lower Size options and visibility behavior", () => {
    it("provides the exact pre-fixed lower size values (24 to 44)", () => {
      expect(LOWER_SIZE_VALUES).toEqual([
        "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44",
      ]);
      expect(REGISTRATION_CONFIGURABLE_FIELD_KEYS).toContain("lowerSize");
    });

    it("normalizes and validates lower size values correctly", () => {
      expect(isLowerSize("32")).toBe(true);
      expect(isLowerSize("24")).toBe(true);
      expect(isLowerSize("44")).toBe(true);
      expect(isLowerSize("50")).toBe(false);
      expect(isLowerSize("invalid")).toBe(false);

      expect(normalizeLowerSize(" 32 ")).toBe("32");
      expect(normalizeLowerSize("28")).toBe("28");
      expect(normalizeLowerSize("99")).toBeNull();
      expect(normalizeLowerSize(null)).toBeNull();
    });

    it("sanitizes lowerSize when hidden by tournament organizer", () => {
      const visibleResult = sanitizeRegistrationInputByVisibility(
        { lowerSize: "32", name: "Player" } as any,
        { lowerSize: true } as any,
      );
      expect(visibleResult.lowerSize).toBe("32");

      const hiddenResult = sanitizeRegistrationInputByVisibility(
        { lowerSize: "32", name: "Player" } as any,
        { lowerSize: false } as any,
      );
      expect(hiddenResult.lowerSize).toBeUndefined();
    });
  });

  // 12: Custom questions still validate and persist correctly alongside required fields
  describe("12: Custom questions validation & persistence alongside required fields", () => {
    it("serializes and parses hidden fields, required fields, and custom questions seamlessly", () => {
      const questions: RegistrationCustomQuestion[] = [
        { id: "q1", label: "T-Shirt Size", type: "dropdown", required: true, options: ["M", "L", "XL"] },
        { id: "q2", label: "Experience (years)", type: "number", required: false },
      ];

      const serialized = serializeRegistrationFieldsConfig(
        ["jerseyNumber"],
        ["photo", "city"],
        questions,
      );

      expect(serialized.hidden).toEqual(["jerseyNumber"]);
      expect(serialized.required).toEqual(["photo", "city"]);
      expect(serialized.customQuestions).toEqual(questions);

      const parsed = parseRegistrationFieldsConfig(serialized);
      expect(parsed.hidden).toEqual(["jerseyNumber"]);
      expect(parsed.required).toEqual(["photo", "city"]);
      expect(parsed.customQuestions).toEqual(questions);
    });
  });
});
