/**
 * BIDWAR — Broadcast URL Validator & SSRF Protection
 *
 * Validates organizer-supplied broadcast and stream URLs.
 * Strictly enforces HTTPS schemes, rejects private/internal network destinations (SSRF defense),
 * identifies supported streaming platforms (YouTube, Facebook, Twitch, Other),
 * and produces normalized, safe external links.
 */

export type BroadcastPlatform = "youtube" | "facebook" | "twitch" | "other";

export interface BroadcastUrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  platform?: BroadcastPlatform;
  error?: string;
}

/**
 * Common private/internal IP ranges and hostnames blocked for SSRF defense:
 * - IPv4 Loopback: 127.0.0.0/8
 * - IPv4 Private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - IPv4 Link-Local / Cloud Metadata: 169.254.0.0/16 (e.g. 169.254.169.254)
 * - IPv4 Current network / broadcast: 0.0.0.0/8, 255.255.255.255
 * - IPv4 Shared Address / Carrier-grade NAT: 100.64.0.0/10
 * - IPv6 Loopback / Local: ::1, fe80::/10, fc00::/7
 */
function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  // Strip brackets from IPv6 literal if present
  const unbracketed = host.replace(/^\[|\]$/g, "");

  // Hostnames and internal domains
  if (
    host === "localhost" ||
    host === "localhost.localdomain" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home") ||
    host.endsWith(".corp")
  ) {
    return true;
  }

  // IPv6 loopback and link-local
  if (
    unbracketed === "::1" ||
    unbracketed === "0:0:0:0:0:0:0:1" ||
    unbracketed.startsWith("fe80:") ||
    unbracketed.startsWith("fc00:") ||
    unbracketed.startsWith("fd00:")
  ) {
    return true;
  }

  // IPv4 dotted-decimal check
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(unbracketed);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);
    const o3 = parseInt(ipv4Match[3], 10);
    const o4 = parseInt(ipv4Match[4], 10);

    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
      return true; // Malformed IP
    }

    // 0.0.0.0/8
    if (o1 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return true;
    // 10.0.0.0/8 (Private)
    if (o1 === 10) return true;
    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (o1 === 192 && o2 === 168) return true;
    // 169.254.0.0/16 (Link-Local / AWS/GCP/Azure Cloud Metadata: 169.254.169.254)
    if (o1 === 169 && o2 === 254) return true;
    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;
    // 255.255.255.255 (Broadcast)
    if (o1 === 255 && o2 === 255 && o3 === 255 && o4 === 255) return true;
  }

  return false;
}

/**
 * Detect streaming platform from hostname.
 */
export function detectBroadcastPlatform(hostname: string): BroadcastPlatform {
  const host = hostname.toLowerCase();

  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be"
  ) {
    return "youtube";
  }

  if (
    host === "facebook.com" ||
    host === "www.facebook.com" ||
    host === "m.facebook.com" ||
    host === "fb.watch" ||
    host === "fb.com" ||
    host === "web.facebook.com"
  ) {
    return "facebook";
  }

  if (
    host === "twitch.tv" ||
    host === "www.twitch.tv" ||
    host === "m.twitch.tv"
  ) {
    return "twitch";
  }

  return "other";
}

/**
 * Validate and sanitize an organizer-provided broadcast URL.
 *
 * Rules:
 * 1. Must be a non-empty string <= 500 characters.
 * 2. Protocol MUST be 'https:' (no plaintext 'http:', 'javascript:', 'data:', 'file:', etc.).
 * 3. Must parse cleanly with standard URL parser.
 * 4. Destination hostname must NOT be a private or internal network address (SSRF protection).
 * 5. Destination hostname must contain at least one dot (valid FQDN) and valid TLD.
 */
export function validateBroadcastUrl(rawUrl: unknown): BroadcastUrlValidationResult {
  if (typeof rawUrl !== "string") {
    return { valid: false, error: "Broadcast URL must be a string" };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: "Broadcast URL cannot be empty" };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: "Broadcast URL exceeds maximum length of 500 characters" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL syntax" };
  }

  // Scheme enforcement — HTTPS ONLY
  if (parsed.protocol.toLowerCase() !== "https:") {
    return {
      valid: false,
      error: `Unsupported protocol '${parsed.protocol}'. Only secure 'https://' URLs are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { valid: false, error: "Invalid URL: missing host" };
  }

  // SSRF Protection
  if (isPrivateOrLocalHost(hostname)) {
    return {
      valid: false,
      error: "Private, local, or cloud metadata network destinations are strictly prohibited.",
    };
  }

  // Ensure hostname has at least a domain and TLD (e.g. example.com, not just 'myhost')
  if (!hostname.includes(".") || hostname.startsWith(".") || hostname.endsWith(".")) {
    return {
      valid: false,
      error: "Host must be a fully qualified domain name.",
    };
  }

  const platform = detectBroadcastPlatform(hostname);

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    platform,
  };
}
