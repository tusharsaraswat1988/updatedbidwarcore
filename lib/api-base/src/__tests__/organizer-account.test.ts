import { describe, expect, it } from "vitest";
import {
  isOrganizerAccountActive,
  isOrganizerAccountLocked,
  organizerAccessLabel,
} from "../organizer-account.ts";

describe("organizer account access", () => {
  it("treats suspended as locked", () => {
    expect(isOrganizerAccountLocked("suspended")).toBe(true);
    expect(isOrganizerAccountActive("suspended")).toBe(false);
    expect(organizerAccessLabel("suspended")).toBe("locked");
  });

  it("treats active and legacy pending as active", () => {
    expect(isOrganizerAccountLocked("active")).toBe(false);
    expect(isOrganizerAccountLocked("pending")).toBe(false);
    expect(organizerAccessLabel("active")).toBe("active");
    expect(organizerAccessLabel("pending")).toBe("active");
  });
});
