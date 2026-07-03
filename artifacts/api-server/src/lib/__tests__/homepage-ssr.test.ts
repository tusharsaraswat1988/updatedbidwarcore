import { describe, expect, it, vi, beforeEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import {
  injectSsrHomepageDocument,
  loadIndexHtml,
} from "../html-meta-injector.js";
import {
  resetHomepageSsrRendererForTests,
  setHomepageSsrRendererForTests,
  trySendHomepageSsr,
} from "../homepage-ssr.js";

const fetchHomepagePageData = vi.fn();

vi.mock("../homepage-data.js", () => ({
  fetchHomepagePageData: (...args: unknown[]) => fetchHomepagePageData(...args),
}));

vi.mock("../page-meta.js", () => ({
  getPageMeta: () => ({
    title: "BidWar",
    description: "Test",
    canonical: "https://bidwar.in/",
    ogTitle: "BidWar",
    ogDescription: "Test",
    twitterTitle: "BidWar",
    twitterDescription: "Test",
    schemas: [],
  }),
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auctionDist = path.resolve(__dirname, "../../../../auction-platform/dist/public");

describe("homepage SSR", () => {
  beforeEach(() => {
    resetHomepageSsrRendererForTests();
    fetchHomepagePageData.mockReset();
    loadIndexHtml(auctionDist);
  });

  it("injectSsrHomepageDocument replaces boot splash inside #root", () => {
    const shell =
      '<html><body><div id="root"><div id="bidwar-boot-splash"><div class="bidwar-boot-spinner"></div></div></div></body></html>';
    const html = injectSsrHomepageDocument(
      shell,
      "<main>Home</main>",
      { auctions: [], showcaseEvents: [], branding: {}, generatedAt: "2026-01-01T00:00:00.000Z" },
      { mutations: [], queries: [] },
    );

    expect(html).toContain('<div id="root"><main>Home</main></div>');
    expect(html).not.toContain("bidwar-boot-splash");
  });

  it("injectSsrHomepageDocument embeds root markup and hydration payloads", () => {
    const shell = '<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
    const html = injectSsrHomepageDocument(
      shell,
      "<main>Home</main>",
      { auctions: [], showcaseEvents: [], branding: {}, generatedAt: "2026-01-01T00:00:00.000Z" },
      { mutations: [], queries: [] },
    );

    expect(html).toContain('<div id="root"><main>Home</main></div>');
    expect(html).toContain("window.__BIDWAR_INITIAL_DATA__=");
    expect(html).toContain("window.__REACT_QUERY_DEHYDRATED__=");
    expect(html.indexOf("window.__BIDWAR_INITIAL_DATA__=")).toBeLessThan(
      html.indexOf('<script type="module"'),
    );
  });

  it("fail-open serves SPA shell when renderer is unavailable", async () => {
    setHomepageSsrRendererForTests(null);
    fetchHomepagePageData.mockResolvedValue({
      cacheHit: false,
      data: {
        auctions: [],
        showcaseEvents: [],
        branding: { brandName: "BidWar" },
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const res = {
      headers: {} as Record<string, string>,
      body: "",
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      send(payload: string) {
        this.body = payload;
      },
    };

    const sent = await trySendHomepageSsr(res);
    expect(sent).toBe(true);
    expect(res.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(res.body).toContain('id="root"');
    expect(res.body).toContain("<title>BidWar</title>");
    expect(res.body).not.toContain("window.__BIDWAR_INITIAL_DATA__=");
  });
});
