import { describe, expect, it } from "vitest";
import {
  isBidWarManagedPublicId,
  parseCloudinaryPublicIdFromUrl,
  resolveCloudinaryPublicId,
} from "../cloudinary-media";

describe("cloudinary-media", () => {
  it("parses public_id from a standard Cloudinary delivery URL", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1234567890/bidwar/player_abc.webp";
    expect(parseCloudinaryPublicIdFromUrl(url)).toBe("bidwar/player_abc");
  });

  it("parses public_id when transformations are present", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/c_fill,w_400/v123/bidwar/team-logo.webp";
    expect(parseCloudinaryPublicIdFromUrl(url)).toBe("bidwar/team-logo");
  });

  it("prefers stored public_id over URL parsing", () => {
    expect(resolveCloudinaryPublicId({
      url: "https://res.cloudinary.com/demo/image/upload/v1/bidwar/old.webp",
      publicId: "bidwar/stored-id",
    })).toBe("bidwar/stored-id");
  });

  it("allows cleanup only for BidWar-managed folders", () => {
    expect(isBidWarManagedPublicId("bidwar/player_1")).toBe(true);
    expect(isBidWarManagedPublicId("bidwar/branding/logo")).toBe(true);
    expect(isBidWarManagedPublicId("other-folder/image")).toBe(false);
  });
});
