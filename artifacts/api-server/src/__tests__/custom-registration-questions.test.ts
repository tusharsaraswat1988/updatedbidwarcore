import { describe, expect, it } from "vitest";
import {
  REGISTRATION_QUESTION_TYPES,
  type RegistrationCustomQuestion,
  validateCustomQuestionsDefinition,
  parseRegistrationCustomQuestions,
  validateCustomAnswers,
  serializeRegistrationFieldsConfig,
  parseRegistrationFieldsConfig,
} from "@workspace/api-base/registration-fields";
import { buildPlayerExportRows } from "@workspace/api-base/export-players-rows";
import {
  privatePlayerSerializer,
  publicPlayerSerializer,
  publicAuctionPlayerSerializer,
} from "../lib/serializers/player";
import { publicTournamentSerializer, privateTournamentSerializer } from "../lib/serializers/tournament";

describe("Custom Registration Questions — Definition & Parsing", () => {
  it("supports all 5 required question types", () => {
    expect(REGISTRATION_QUESTION_TYPES).toEqual([
      "short_text",
      "number",
      "single_choice",
      "multiple_choice",
      "dropdown",
    ]);
  });

  it("validates and parses valid custom questions of each type", () => {
    const rawQuestions = [
      { id: "q_shirt", label: "T-Shirt Size", type: "dropdown", required: true, options: ["S", "M", "L", "XL"] },
      { id: "q_exp", label: "Years of Experience", type: "number", required: false },
      { id: "q_pref", label: "Preferred Position", type: "single_choice", required: true, options: ["Opener", "Middle", "Finisher"] },
      { id: "q_skills", label: "Secondary Skills", type: "multiple_choice", required: false, options: ["Wicketkeeping", "Captaincy", "Umpiring"] },
      { id: "q_notes", label: "Special Dietary Needs", type: "short_text", required: false },
    ];

    const result = validateCustomQuestionsDefinition(rawQuestions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.questions).toHaveLength(5);
    expect(result.questions[0].id).toBe("q_shirt");
    expect(result.questions[0].options).toEqual(["S", "M", "L", "XL"]);
    expect(result.questions[1].type).toBe("number");
    expect(result.questions[3].options).toEqual(["Wicketkeeping", "Captaincy", "Umpiring"]);
  });

  it("rejects questions without a stable ID", () => {
    const result = validateCustomQuestionsDefinition([
      { label: "Missing ID", type: "short_text", required: false },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must have a stable ID");
    }
  });

  it("rejects duplicate question IDs", () => {
    const result = validateCustomQuestionsDefinition([
      { id: "q_dup", label: "Question 1", type: "short_text", required: false },
      { id: "q_dup", label: "Question 2", type: "short_text", required: false },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Duplicate question ID: "q_dup"');
    }
  });

  it("rejects choice-based questions with empty options", () => {
    const singleChoiceResult = validateCustomQuestionsDefinition([
      { id: "q_single", label: "Choice", type: "single_choice", required: true, options: [] },
    ]);
    expect(singleChoiceResult.ok).toBe(false);
    if (!singleChoiceResult.ok) {
      expect(singleChoiceResult.error).toContain("must have at least one option");
    }

    const dropdownResult = validateCustomQuestionsDefinition([
      { id: "q_drop", label: "Drop", type: "dropdown", required: true, options: ["   ", ""] },
    ]);
    expect(dropdownResult.ok).toBe(false);
    if (!dropdownResult.ok) {
      expect(dropdownResult.error).toContain("must have at least one option");
    }
  });

  it("preserves question reordering and sanitizes options", () => {
    const q1: RegistrationCustomQuestion = {
      id: "q_first",
      label: "First Question",
      type: "short_text",
      required: false,
    };
    const q2: RegistrationCustomQuestion = {
      id: "q_second",
      label: "Second Question",
      type: "single_choice",
      required: true,
      options: [" Option A ", "Option B", "Option A"], // Duplicate and whitespace
    };

    // Serialized in reordered order [q2, q1]
    const serialized = serializeRegistrationFieldsConfig(["email"], [q2, q1]);
    expect(serialized.customQuestions).toBeDefined();
    expect(serialized.customQuestions![0].id).toBe("q_second");
    expect(serialized.customQuestions![0].options).toEqual(["Option A", "Option B"]);
    expect(serialized.customQuestions![1].id).toBe("q_first");

    // Deserialization preserves order
    const parsed = parseRegistrationFieldsConfig(serialized);
    expect(parsed.customQuestions).toHaveLength(2);
    expect(parsed.customQuestions![0].id).toBe("q_second");
    expect(parsed.customQuestions![1].id).toBe("q_first");
  });
});

describe("Custom Registration Questions — Answer Validation", () => {
  const testQuestions: RegistrationCustomQuestion[] = [
    { id: "q_name_on_jersey", label: "Jersey Print Name", type: "short_text", required: true },
    { id: "q_matches", label: "Matches Played", type: "number", required: false },
    { id: "q_dominant_hand", label: "Dominant Hand", type: "single_choice", required: true, options: ["Left", "Right"] },
    { id: "q_kit_needed", label: "Kit Items Needed", type: "multiple_choice", required: true, options: ["Helmet", "Pads", "Gloves"] },
    { id: "q_transport", label: "Transportation Mode", type: "dropdown", required: false, options: ["Car", "Bike", "Public Transport"] },
  ];

  it("validates valid answers for all question types", () => {
    const validSubmission = {
      q_name_on_jersey: "  VIRAT  ",
      q_matches: 45,
      q_dominant_hand: "Right",
      q_kit_needed: ["Helmet", "Gloves"],
      q_transport: "Car",
    };

    const res = validateCustomAnswers(testQuestions, validSubmission);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.sanitizedAnswers).toEqual({
      q_name_on_jersey: "VIRAT",
      q_matches: 45,
      q_dominant_hand: "Right",
      q_kit_needed: ["Helmet", "Gloves"],
      q_transport: "Car",
    });
  });

  it("coerces numeric strings for number type questions", () => {
    const res = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Rahul",
      q_matches: "100",
      q_dominant_hand: "Right",
      q_kit_needed: ["Pads"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sanitizedAnswers.q_matches).toBe(100);
  });

  it("rejects non-numeric values for number type questions", () => {
    const res = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Rahul",
      q_matches: "ten matches",
      q_dominant_hand: "Right",
      q_kit_needed: ["Pads"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('"Matches Played" must be a valid number.');
      expect(res.field).toBe("customAnswers.q_matches");
    }
  });

  it("enforces required questions", () => {
    // Missing required short_text
    const res1 = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "",
      q_dominant_hand: "Right",
      q_kit_needed: ["Pads"],
    });
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.error).toBe('"Jersey Print Name" is required.');
      expect(res1.field).toBe("customAnswers.q_name_on_jersey");
    }

    // Missing required multiple_choice
    const res2 = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Dhoni",
      q_dominant_hand: "Right",
      q_kit_needed: [],
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error).toBe('"Kit Items Needed" is required.');
      expect(res2.field).toBe("customAnswers.q_kit_needed");
    }
  });

  it("permits omitting optional questions", () => {
    const res = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Rohit",
      q_dominant_hand: "Right",
      q_kit_needed: ["Gloves"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sanitizedAnswers.q_matches).toBeUndefined();
    expect(res.sanitizedAnswers.q_transport).toBeUndefined();
  });

  it("rejects invalid options for single-choice questions", () => {
    const res = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Rohit",
      q_dominant_hand: "Ambidextrous", // Not in ["Left", "Right"]
      q_kit_needed: ["Gloves"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Invalid option selected for "Dominant Hand".');
      expect(res.field).toBe("customAnswers.q_dominant_hand");
    }
  });

  it("rejects invalid options in multiple-choice questions", () => {
    const res = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Rohit",
      q_dominant_hand: "Right",
      q_kit_needed: ["Helmet", "Bat"], // "Bat" is not in ["Helmet", "Pads", "Gloves"]
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Invalid option selected for "Kit Items Needed".');
      expect(res.field).toBe("customAnswers.q_kit_needed");
    }
  });

  it("rejects invalid options for dropdown questions", () => {
    const res = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Rohit",
      q_dominant_hand: "Right",
      q_kit_needed: ["Gloves"],
      q_transport: "Helicopter",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Invalid option selected for "Transportation Mode".');
      expect(res.field).toBe("customAnswers.q_transport");
    }
  });

  it("rejects invalid question IDs not defined for the tournament", () => {
    const res = validateCustomAnswers(testQuestions, {
      q_name_on_jersey: "Rohit",
      q_dominant_hand: "Right",
      q_kit_needed: ["Gloves"],
      unregistered_hacker_field: "injected_data",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('Invalid question ID "unregistered_hacker_field"');
      expect(res.field).toBe("customAnswers.unregistered_hacker_field");
    }
  });

  it("succeeds when tournament has no custom questions and player submits no answers", () => {
    const res1 = validateCustomAnswers([], undefined);
    expect(res1.ok).toBe(true);

    const res2 = validateCustomAnswers(null, {});
    expect(res2.ok).toBe(true);
  });

  it("rejects extraneous answers when tournament has no custom questions configured", () => {
    const res = validateCustomAnswers([], { some_field: "value" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Invalid question ID "some_field".');
      expect(res.field).toBe("customAnswers.some_field");
    }
  });
});

describe("Privacy & Serializer Isolation", () => {
  const dummyPlayerRow: any = {
    id: 101,
    serialNo: 1,
    tournamentId: 5,
    categoryId: 2,
    teamId: null,
    name: "Sachin Tendulkar",
    city: "Mumbai",
    role: "Batsman",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right-arm spin",
    specialization: "Top Order",
    age: 28,
    gender: "M",
    photoUrl: "https://example.com/sachin.jpg",
    basePrice: 100000,
    selectedBidValue: null,
    bidValueSource: null,
    soldPrice: null,
    retainedPrice: null,
    status: "available",
    jerseyNumber: "10",
    jerseySize: "L",
    achievements: "Legend",
    mobileNumber: "9876543210",
    email: "sachin@example.com",
    cricheroUrl: null,
    availabilityDates: null,
    playerTag: null,
    playerTagTeamId: null,
    isNonPlayingMember: false,
    registrationPaymentStatus: "approved",
    utrNumber: "UTR123456789",
    paymentScreenshotUrl: "https://example.com/pay.jpg",
    paymentSubmittedAt: new Date(),
    customAnswersJson: {
      q_shirt: "L",
      q_medical_note: "Asthma inhaler in kit bag",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("exposes custom answers to organizer in privatePlayerSerializer", () => {
    const privateView = privatePlayerSerializer(dummyPlayerRow);
    expect(privateView).toHaveProperty("customAnswers");
    expect(privateView.customAnswers).toEqual({
      q_shirt: "L",
      q_medical_note: "Asthma inhaler in kit bag",
    });
    expect(privateView.mobileNumber).toBe("9876543210");
  });

  it("strips custom answers in publicPlayerSerializer for privacy", () => {
    const publicView = publicPlayerSerializer(dummyPlayerRow);
    expect((publicView as any).customAnswers).toBeUndefined();
    expect((publicView as any).customAnswersJson).toBeUndefined();
    expect((publicView as any).mobileNumber).toBeUndefined();
    expect((publicView as any).email).toBeUndefined();
  });

  it("strips custom answers in publicAuctionPlayerSerializer for auction live screen", () => {
    const auctionView = publicAuctionPlayerSerializer(dummyPlayerRow);
    expect((auctionView as any).customAnswers).toBeUndefined();
    expect((auctionView as any).customAnswersJson).toBeUndefined();
  });

  it("public tournament serializer exposes question definitions but zero player answers", () => {
    const dummyTournamentRow: any = {
      id: 5,
      name: "Premier League",
      sport: "cricket",
      status: "setup",
      createdAt: new Date(),
      registrationFieldsJson: {
        hidden: ["cricheroUrl"],
        customQuestions: [
          { id: "q_shirt", label: "T-Shirt Size", type: "dropdown", required: true, options: ["M", "L"] },
        ],
      },
    };

    const serialized = publicTournamentSerializer(dummyTournamentRow);
    expect(serialized.registrationFields.customQuestions).toEqual([
      { id: "q_shirt", label: "T-Shirt Size", type: "dropdown", required: true, options: ["M", "L"] },
    ]);
  });
});

describe("Export Rows Integration", () => {
  it("includes custom question headers and player answers in buildPlayerExportRows", () => {
    const customQuestions: RegistrationCustomQuestion[] = [
      { id: "q_shirt", label: "Jersey Size", type: "dropdown", required: true, options: ["M", "L"] },
      { id: "q_food", label: "Dietary Preference", type: "single_choice", required: false, options: ["Veg", "Non-Veg"] },
      { id: "q_gear", label: "Provided Gear", type: "multiple_choice", required: false, options: ["Cap", "Bottle"] },
    ];

    const players = [
      {
        id: 1,
        serialNo: 1,
        name: "Player One",
        status: "available",
        customAnswers: {
          q_shirt: "L",
          q_food: "Veg",
          q_gear: ["Cap", "Bottle"],
        },
      },
      {
        id: 2,
        serialNo: 2,
        name: "Player Two",
        status: "available",
        customAnswers: {
          q_shirt: "M",
        },
      },
    ];

    const rows = buildPlayerExportRows(players, {}, {}, "cricket", customQuestions);
    expect(rows).toHaveLength(2);

    // Player 1 has all answers
    expect(rows[0]["Jersey Size"]).toBe("L");
    expect(rows[0]["Dietary Preference"]).toBe("Veg");
    expect(rows[0]["Provided Gear"]).toBe("Cap, Bottle");

    // Player 2 has missing optional answers which cleanly map to empty string
    expect(rows[1]["Jersey Size"]).toBe("M");
    expect(rows[1]["Dietary Preference"]).toBe("");
    expect(rows[1]["Provided Gear"]).toBe("");
  });
});
