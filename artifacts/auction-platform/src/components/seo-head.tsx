import { useEffect } from "react";

interface SeoHeadProps {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

const DEFAULT_TITLE = "BidWar — Live Sports Auction Software | Cricket, Football & Franchise Auctions India";

export function SeoHead({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
}: SeoHeadProps) {
  useEffect(() => {
    document.title = title;

    function setMeta(selector: string, attr: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        const [k, v] = attr.split("=");
        el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    }

    function setCanonical(href: string) {
      let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!el) {
        el = document.createElement("link");
        el.rel = "canonical";
        document.head.appendChild(el);
      }
      el.href = href;
    }

    setMeta('meta[name="description"]', "name=description", description);
    setMeta('meta[name="robots"]', "name=robots", "index, follow");
    setMeta('meta[property="og:type"]', "property=og:type", ogType);
    setMeta('meta[property="og:title"]', "property=og:title", ogTitle || title);
    setMeta('meta[property="og:description"]', "property=og:description", ogDescription || description);
    setMeta('meta[property="og:url"]', "property=og:url", canonical);
    setMeta('meta[name="twitter:card"]', "name=twitter:card", ogImage ? "summary_large_image" : "summary");
    setMeta('meta[name="twitter:title"]', "name=twitter:title", ogTitle || title);
    setMeta('meta[name="twitter:description"]', "name=twitter:description", ogDescription || description);
    if (ogImage) {
      setMeta('meta[property="og:image"]', "property=og:image", ogImage);
      setMeta('meta[name="twitter:image"]', "name=twitter:image", ogImage);
    }
    setCanonical(canonical);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogImage, ogType]);

  return null;
}
