import { describe, expect, it } from "vitest";
import { findUnknownVariables, renderMergeTemplate } from "../merge-variables.js";

describe("renderMergeTemplate", () => {
  it("replaces simple merge variables", () => {
    const html = renderMergeTemplate("Hello {{player_name}}!", {
      player_name: "Virat",
    });
    expect(html).toBe("Hello Virat!");
  });

  it("hides conditional blocks when value is empty", () => {
    const html = renderMergeTemplate(
      "Start{{#team_name}} Team: {{team_name}}{{/team_name}} End",
      { team_name: "" },
    );
    expect(html).toBe("Start End");
  });

  it("renders conditional blocks when value is present", () => {
    const html = renderMergeTemplate(
      "Start{{#team_name}} Team: {{team_name}}{{/team_name}} End",
      { team_name: "Warriors" },
    );
    expect(html).toBe("Start Team: Warriors End");
  });

  it("supports organiser contact conditionals independently", () => {
    const template = "{{#organiser_phone}}Phone: {{organiser_phone}}{{/organiser_phone}}{{#organiser_email}} Email: {{organiser_email}}{{/organiser_email}}";
    expect(renderMergeTemplate(template, { organiser_phone: "+91 99999 99999" })).toBe(
      "Phone: +91 99999 99999",
    );
    expect(renderMergeTemplate(template, { organiser_email: "org@example.com" })).toBe(
      " Email: org@example.com",
    );
  });
});

describe("findUnknownVariables", () => {
  it("recognizes player registration merge variables", () => {
    const unknown = findUnknownVariables(
      "{{bidwar_logo}} {{tournament_logo}} {{sport_name}} {{registration_id}}",
    );
    expect(unknown).toEqual([]);
  });
});
