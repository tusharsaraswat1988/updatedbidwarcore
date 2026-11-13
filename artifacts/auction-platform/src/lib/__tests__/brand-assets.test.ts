import { describe, expect, it } from "vitest";
import {
  getPublicBrandLogoSrc,
  getOrganizationLogoUrl,
  isBrandLogoPlaceholderSrc,
} from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import {
  resolvePlatformLogoPathForOrder,
  resolvePlatformPrimaryLogoPath,
} from "@workspace/api-base/branding-assets";

describe("brand-assets production logo strategy", () => {
  it("uses stable platform paths for public navbar and schema", () => {
    expect(getPublicBrandLogoSrc(["main", "mainReverse", "mini", "appIcon"], 3)).toBe(
      "/bidwar-primary-logo.png?v=3",
    );
    expect(getOrganizationLogoUrl(2)).toBe("https://bidwar.in/bidwar-primary-logo.png?v=2");
    expect(isBrandLogoPlaceholderSrc(getPublicBrandLogoSrc(["main"], 0))).toBe(false);
  });

  it("prefers reverse platform path when order starts with mainReverse", () => {
    expect(getPublicBrandLogoSrc(["mainReverse", "main"], 0)).toBe("/bidwar-reverse-logo.png");
    expect(resolvePlatformLogoPathForOrder(["mainReverse", "main"], 1)).toBe(
      "/bidwar-reverse-logo.png?v=1",
    );
    expect(resolvePlatformPrimaryLogoPath(0)).toBe("/bidwar-primary-logo.png");
  });

  it("maps light design surfaces to PRIMARY_LOGO and dark design to REVERSE_LOGO", () => {
    const organizerAuth = getBrandSurfacePreset("organizer-auth");
    expect(organizerAuth.logoAsset).toBe("PRIMARY_LOGO");
    expect(organizerAuth.logoOrder[0]).toBe("main");
    expect(organizerAuth.darkBackground).toBe(false);

    const adminLogin = getBrandSurfacePreset("auth-login");
    expect(adminLogin.logoAsset).toBe("REVERSE_LOGO");
    expect(adminLogin.logoOrder[0]).toBe("mainReverse");
    expect(adminLogin.darkBackground).toBe(true);

    const regHeader = getBrandSurfacePreset("registration-header");
    expect(regHeader.logoAsset).toBe("PRIMARY_LOGO");
    expect(regHeader.logoOrder[0]).toBe("main");
    expect(regHeader.darkBackground).toBe(false);
  });
});
