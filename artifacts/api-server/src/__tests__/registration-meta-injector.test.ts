import { describe, expect, it } from "vitest";
import { injectPageMeta, loadIndexHtml } from "../lib/html-meta-injector.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auctionDist = path.resolve(__dirname, "../../../auction-platform");

describe("html-meta-injector registration metadata", () => {
  it("injects tournament-specific OG tags including image and canonical URL", () => {
    loadIndexHtml(auctionDist);
    const html = injectPageMeta({
      title: "Varanasi Premier League | Player Registration",
      description: "Player registrations are now open.\n\nTournament:\nVaranasi Premier League\n\nRegister now.",
      canonical: "https://bidwar.in/register/VN410108",
      ogTitle: "Varanasi Premier League | Player Registration",
      ogDescription: "Player registrations are now open.",
      ogImage: "https://cdn.example/logo.png",
      twitterTitle: "Varanasi Premier League | Player Registration",
      twitterDescription: "Player registrations are now open.",
      robots: "noindex, follow",
      schemas: [],
    });

    expect(html).toBeTruthy();
    expect(html).toContain("<title>Varanasi Premier League | Player Registration</title>");
    expect(html).toContain('property="og:title" content="Varanasi Premier League | Player Registration"');
    expect(html).toContain('property="og:url" content="https://bidwar.in/register/VN410108"');
    expect(html).toContain('rel="canonical" href="https://bidwar.in/register/VN410108"');
    expect(html).toContain('property="og:image" content="https://cdn.example/logo.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('name="twitter:image" content="https://cdn.example/logo.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toContain("Run professional IPL-style player auctions live");
  });
});
