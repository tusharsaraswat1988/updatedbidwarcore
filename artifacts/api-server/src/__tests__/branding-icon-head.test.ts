import { describe, it, expect } from "vitest";
import { buildBrandingIconHeadLinks, injectBrandingIconsIntoHtml } from "@workspace/api-base/branding-icon-head";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
<!-- BRANDING_ICONS_START -->
<link rel="icon" href="/favicon.ico" />
<!-- BRANDING_ICONS_END -->
</head>
</html>`;

describe("branding-icon-head", () => {
  it("injects version query params into favicon links", () => {
    const result = injectBrandingIconsIntoHtml(SAMPLE_HTML, 3);
    expect(result).toContain('href="/favicon.ico?v=3"');
    expect(result).toContain('href="/favicon-32x32.png?v=3"');
  });

  it("omits query param when version is zero", () => {
    const block = buildBrandingIconHeadLinks(0);
    expect(block).toContain('href="/favicon.ico"');
    expect(block).not.toContain("?v=");
  });
});
