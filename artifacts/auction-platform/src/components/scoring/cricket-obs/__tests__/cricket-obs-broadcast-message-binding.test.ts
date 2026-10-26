import { describe, expect, it } from "vitest";
import { bindBroadcastTemplateDraft } from "../cricket-obs-broadcast-message-binding";

const amaira = { id: 1, name: "AMAIRA SARASWAT", details: "ANCHOR" };
const templates = [amaira];

describe("bindBroadcastTemplateDraft", () => {
  it("keeps a saved template selected while the draft still matches", () => {
    expect(
      bindBroadcastTemplateDraft(
        { selectedTemplateId: 1, replaceTemplateId: null },
        { name: "AMAIRA SARASWAT", details: "ANCHOR" },
        templates,
      ),
    ).toEqual({ selectedTemplateId: 1, replaceTemplateId: null });
  });

  it("unbinds as soon as a new person is typed so save does not overwrite the old template", () => {
    expect(
      bindBroadcastTemplateDraft(
        { selectedTemplateId: 1, replaceTemplateId: null },
        { name: "ANSHUMAN RANJEET SINGH", details: "FOUNDER -" },
        templates,
      ),
    ).toEqual({ selectedTemplateId: null, replaceTemplateId: 1 });
  });

  it("reattaches when the draft is changed back to the previous template", () => {
    expect(
      bindBroadcastTemplateDraft(
        { selectedTemplateId: null, replaceTemplateId: 1 },
        { name: "  AMAIRA SARASWAT  ", details: "ANCHOR" },
        templates,
      ),
    ).toEqual({ selectedTemplateId: 1, replaceTemplateId: null });
  });

  it("leaves a fresh draft unbound", () => {
    expect(
      bindBroadcastTemplateDraft(
        { selectedTemplateId: null, replaceTemplateId: null },
        { name: "ANSHUMAN RANJEET SINGH", details: "FOUNDER -" },
        templates,
      ),
    ).toEqual({ selectedTemplateId: null, replaceTemplateId: null });
  });
});
