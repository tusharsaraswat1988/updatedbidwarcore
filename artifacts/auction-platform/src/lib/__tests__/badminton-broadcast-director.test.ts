import { describe, expect, it } from "vitest";
import {
  isVenueMomentScene,
  parseVenueScene,
  shouldShowVenueLiveBoard,
} from "@/lib/badminton-broadcast-director";

describe("badminton broadcast director venue scenes", () => {
  it("parses new venue moment scenes", () => {
    expect(parseVenueScene("intro")).toBe("intro");
    expect(parseVenueScene("winner")).toBe("winner");
    expect(parseVenueScene("sponsor")).toBe("sponsor");
    expect(parseVenueScene("next")).toBe("next");
    expect(parseVenueScene("nope")).toBe("auto");
  });

  it("identifies moment scenes", () => {
    expect(isVenueMomentScene("intro")).toBe(true);
    expect(isVenueMomentScene("next")).toBe(true);
    expect(isVenueMomentScene("live_score")).toBe(false);
    expect(isVenueMomentScene("auto")).toBe(false);
  });

  it("hides live board for moment and standby scenes", () => {
    expect(shouldShowVenueLiveBoard("intro", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("winner", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("sponsor", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("next", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("standby", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("multi", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("auto", true)).toBe(true);
    expect(shouldShowVenueLiveBoard("live_score", true)).toBe(true);
    expect(shouldShowVenueLiveBoard("auto", false)).toBe(false);
  });
});
