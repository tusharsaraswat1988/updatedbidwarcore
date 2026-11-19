/**
 * Canonical Streaming Utilities & Provider Parsers
 *
 * Supports YouTube, Twitch, and direct HLS/custom video URLs.
 * Identifies and suppresses test/demo media (e.g. Rickroll dQw4w9WgXcQ).
 */

export interface ParsedStreamEmbed {
  type: "youtube" | "twitch" | "custom";
  embedUrl: string | null;
  directUrl: string;
  providerLabel: string;
  isValid: boolean;
}

export type StreamPresentationStatus = "live" | "configured" | "scheduled" | "unavailable";

/**
 * Audit and detect test / probe / demo media URLs that should never be presented
 * as genuine tournament broadcasts.
 */
export function isTestStreamUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed === "" ||
    trimmed.includes("dqw4w9wgxcq") || // Rick Astley test video
    trimmed.includes("example.com") ||
    trimmed.includes("test.com") ||
    trimmed.includes("demo.com") ||
    trimmed.includes("probe") ||
    trimmed.includes("localhost") ||
    trimmed.includes("127.0.0.1")
  ) {
    return true;
  }
  return false;
}

/**
 * Parse a stream URL into an embeddable iframe URL and direct player link.
 */
export function parseStreamEmbed(url: string | null | undefined): ParsedStreamEmbed {
  if (!url || isTestStreamUrl(url)) {
    return {
      type: "custom",
      embedUrl: null,
      directUrl: "",
      providerLabel: "Unavailable",
      isValid: false,
    };
  }

  const directUrl = url.trim();

  try {
    const u = new URL(directUrl);
    const host = u.hostname.toLowerCase();

    // YouTube
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      let videoId: string | null = null;
      if (host.includes("youtu.be")) {
        videoId = u.pathname.slice(1);
      } else if (u.pathname.startsWith("/watch")) {
        videoId = u.searchParams.get("v");
      } else if (u.pathname.startsWith("/live/")) {
        videoId = u.pathname.replace("/live/", "");
      } else if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.replace("/embed/", "");
      }

      if (videoId) {
        videoId = videoId.split("&")[0].split("?")[0].split("#")[0];
        if (videoId && !videoId.includes("dQw4w9WgXcQ")) {
          return {
            type: "youtube",
            embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`,
            directUrl,
            providerLabel: "YouTube",
            isValid: true,
          };
        }
      }
    }

    // Twitch
    if (host.includes("twitch.tv")) {
      const channel = u.pathname.slice(1).split("/")[0];
      if (channel) {
        const parentHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
        return {
          type: "twitch",
          embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parentHost)}&autoplay=true`,
          directUrl,
          providerLabel: "Twitch",
          isValid: true,
        };
      }
    }

    // Direct / Generic Web Video Link
    return {
      type: "custom",
      embedUrl: null,
      directUrl,
      providerLabel: "Live Stream",
      isValid: true,
    };
  } catch {
    return {
      type: "custom",
      embedUrl: null,
      directUrl: "",
      providerLabel: "Invalid Link",
      isValid: false,
    };
  }
}

/**
 * Authoritatively resolve stream presentation status:
 * - "live": Stream configured AND actual tournament action is ongoing (auction/match live)
 * - "configured": Stream link saved and verified, ready for broadcast
 * - "scheduled": Tournament starting soon / scheduled date
 * - "unavailable": No stream or test link
 */
export function resolveStreamStatus(
  streamUrl: string | null | undefined,
  streamEnabled: boolean | null | undefined,
  isEventLive: boolean,
  isScheduled?: boolean,
): StreamPresentationStatus {
  if (!streamEnabled || !streamUrl || isTestStreamUrl(streamUrl)) {
    return "unavailable";
  }

  const parsed = parseStreamEmbed(streamUrl);
  if (!parsed.isValid) {
    return "unavailable";
  }

  if (isEventLive) {
    return "live";
  }

  if (isScheduled) {
    return "scheduled";
  }

  return "configured";
}
