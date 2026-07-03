import { describe, expect, it } from "vitest";
import { injectPageMeta, loadIndexHtml } from "../html-meta-injector.js";
import type { PageMeta } from "../page-meta.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auctionDist = path.resolve(__dirname, "../../../../auction-platform/dist/public");

describe("html-meta-injector omitCanonical", () => {
  it("omits canonical and og:url when omitCanonical is true", () => {
    loadIndexHtml(auctionDist);
    const meta: PageMeta = {
      title: "Page Not Found | BidWar",
      description: "Missing page",
      robots: "noindex, follow",
      omitCanonical: true,
      schemas: [],
    };
    const html = injectPageMeta(meta);
    expect(html).toBeTruthy();
    expect(html).toContain("noindex, follow");
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("og:url");
  });
});
