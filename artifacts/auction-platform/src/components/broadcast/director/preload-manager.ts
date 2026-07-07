/** Image preload registry — avoids duplicate fetches across frames. */
export class BroadcastPreloadManager {
  private loaded = new Set<string>();
  private pending = new Set<string>();
  hits = 0;
  misses = 0;

  schedule(urls: string[]): string[] {
    const fresh: string[] = [];
    for (const url of urls) {
      if (!url) continue;
      if (this.loaded.has(url) || this.pending.has(url)) {
        this.hits += 1;
        continue;
      }
      this.misses += 1;
      this.pending.add(url);
      fresh.push(url);
    }
    return fresh;
  }

  markLoaded(url: string): void {
    this.pending.delete(url);
    this.loaded.add(url);
  }

  has(url: string): boolean {
    return this.loaded.has(url) || this.pending.has(url);
  }

  flush(urls: string[]): void {
    for (const url of urls) {
      if (url) this.loaded.add(url);
    }
  }

  reset(): void {
    this.loaded.clear();
    this.pending.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

const globalPreloaded = new Set<string>();

export function preloadUrlsInBrowser(urls: string[], onLoaded?: (url: string) => void): void {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url || globalPreloaded.has(url)) continue;
    globalPreloaded.add(url);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => onLoaded?.(url);
    img.onerror = () => globalPreloaded.delete(url);
    img.src = url;
  }
}
