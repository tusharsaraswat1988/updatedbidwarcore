import { getPageMeta, type PageMeta } from "./page-meta.js";
import {
  getSpaIndexHtml,
  injectAcademySsrDocument,
  injectPageMeta,
  sendInjectedHtml,
} from "./html-meta-injector.js";
import { getNotFoundPageMeta } from "./seo-route-policy.js";
import {
  isAcademyPublicPath,
  parseAcademyLessonSlug,
  resolveAcademyPageMeta,
} from "./academy-page-meta.js";
import { buildAcademyHeadHints, trimAcademyFontPreloads } from "./academy-head-hints.js";
import {
  buildAcademyIndexMarkup,
  buildAcademyLessonMarkup,
} from "./academy-ssr-markup.js";
import {
  fetchAcademyIndexPageData,
  fetchAcademyLessonPageData,
  type PublicAcademyPageData,
} from "./academy-public-service.js";
import { logger } from "./logger.js";

export async function trySendAcademyPage(
  res: { status: (code: number) => typeof res; setHeader: (k: string, v: string) => void; send: (body: string) => void },
  pathname: string,
): Promise<boolean> {
  if (!isAcademyPublicPath(pathname)) return false;

  try {
    let pageData: PublicAcademyPageData | null = null;
    let meta: PageMeta | null = null;
    let markup = "";

    if (pathname === "/academy") {
      pageData = await fetchAcademyIndexPageData();
      meta = await resolveAcademyPageMeta("/academy");
      markup = buildAcademyIndexMarkup(pageData);
    } else {
      const slug = parseAcademyLessonSlug(pathname);
      if (!slug) return false;
      const lessonData = await fetchAcademyLessonPageData(slug);
      if (!lessonData) {
        sendInjectedHtml(res, getNotFoundPageMeta(), 404);
        return true;
      }
      pageData = lessonData;
      meta = await resolveAcademyPageMeta(pathname);
      markup = buildAcademyLessonMarkup(lessonData.lesson);
    }

    if (!meta) {
      sendInjectedHtml(res, getNotFoundPageMeta(), 404);
      return true;
    }

    const shell = injectPageMeta(meta) ?? getSpaIndexHtml();
    if (!shell) return false;

    const headHints = buildAcademyHeadHints(pageData);
    let html = injectAcademySsrDocument(shell, markup, pageData, headHints);
    html = trimAcademyFontPreloads(html);
    res.status(200);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);
    return true;
  } catch (err) {
    logger.warn({ err, pathname }, "Academy SSR failed — falling back to meta-only shell");
    const meta = getPageMeta("/academy") ?? (await resolveAcademyPageMeta(pathname));
    if (meta && sendInjectedHtml(res, meta, pathname === "/academy" ? 200 : 404)) return true;
    return false;
  }
}
