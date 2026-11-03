/**
 * BidWar AI Output & Inbound Security Guardrails
 *
 * Enforces URL whitelisting, price consistency, prompt injection resistance,
 * and private data isolation for public WhatsApp interactions.
 */

import { AUTHORITATIVE_PRICES_NUMBERS, WHITELISTED_URLS } from "./knowledgebase";

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+(?:instructions|prompts|commands)/i,
  /you\s+are\s+now\s+(?:in\s+)?developer\s+mode/i,
  /bypass\s+(?:safety|rules|filters|guidelines)/i,
  /reveal\s+(?:your\s+)?(?:system\s+prompt|instructions)/i,
  /repeat\s+(?:the\s+words\s+above|the\s+instructions)/i,
  /\bDAN\s+mode\b/i,
  /\bjailbreak\b/i,
];

const PRIVATE_DATA_PATTERNS = [
  /\b(?:select\s+.*\s+from\s+|insert\s+into|drop\s+table|delete\s+from)\b/i,
  /\b(?:admin_password|session_secret|jwt_secret|database_url)\b/i,
];

export interface GuardrailResult {
  allowed: boolean;
  sanitizedText: string;
  flags: string[];
}

export class GuardrailsService {
  /**
   * Inspect inbound message for prompt injection or malicious attempts.
   */
  public inspectInbound(text: string): { isMalicious: boolean; reason?: string } {
    if (!text || text.trim() === "") {
      return { isMalicious: false };
    }

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          isMalicious: true,
          reason: "Prompt injection attempt detected",
        };
      }
    }

    for (const pattern of PRIVATE_DATA_PATTERNS) {
      if (pattern.test(text)) {
        return {
          isMalicious: true,
          reason: "Sensitive pattern or SQL injection detected",
        };
      }
    }

    return { isMalicious: false };
  }

  /**
   * Validate and sanitize AI-generated response before outbound WhatsApp dispatch.
   */
  public sanitizeOutbound(rawResponse: string): GuardrailResult {
    const flags: string[] = [];
    let text = rawResponse.trim();

    // 1. Sanitize URLs — only allow whitelisted BidWar URLs
    const urlRegex = /https?:\/\/[^\s)\]]+/gi;
    text = text.replace(urlRegex, (url) => {
      // Clean trailing punctuation
      const cleanUrl = url.replace(/[.,;!?]+$/, "");
      const isAllowed = WHITELISTED_URLS.some((w) => cleanUrl.startsWith(w)) ||
        cleanUrl.startsWith("https://wa.me/918707488250") ||
        cleanUrl.startsWith("https://bidwar.in") ||
        cleanUrl.startsWith("https://www.youtube.com/@bidwarofficial") ||
        cleanUrl.startsWith("https://youtube.com/@bidwarofficial");

      if (isAllowed) {
        return cleanUrl;
      }

      flags.push(`Unverified URL stripped: ${cleanUrl}`);
      return "https://bidwar.in";
    });

    // 2. Validate prices against authoritative pricing
    // Matches formats like ₹5,000, ₹ 6000, 5000 rs, Rs. 8000
    const priceRegex = /(?:₹|Rs\.?|INR)\s*([0-9]{1,2}(?:,[0-9]{3}|[0-9]{3})*)/gi;
    text = text.replace(priceRegex, (match, digits) => {
      const num = parseInt(digits.replace(/,/g, ""), 10);
      const isVerified = (AUTHORITATIVE_PRICES_NUMBERS as readonly number[]).includes(num);

      if (isVerified) {
        return match;
      }

      flags.push(`Unverified price detected and corrected: ${match}`);
      // Replace with link to pricing page if an unverified price is stated
      return "authoritative pricing (see https://bidwar.in/pricing)";
    });

    // 3. Ensure no leaked API keys or secrets
    if (/sk-[a-zA-Z0-9_-]{20,}/.test(text) || /AIza[a-zA-Z0-9_-]{20,}/.test(text) || /Bearer\s+[a-zA-Z0-9_-]{20,}/.test(text)) {
      flags.push("Secret leak blocked");
      text = "Namaste! Details ke liye https://bidwar.in visit karein ya +91 8707488250 pe call karein.";
    }

    // 4. Fallback if response was completely emptied
    if (!text || text.length < 5) {
      text = "Namaste! BidWar live sports auction platform ke baare mein janne ke liye https://bidwar.in pe jayein ya hamare support number +91 8707488250 pe WhatsApp karein.";
    }

    return {
      allowed: true,
      sanitizedText: text,
      flags,
    };
  }
}

export const guardrails = new GuardrailsService();
