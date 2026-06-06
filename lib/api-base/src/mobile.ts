export type IndianMobileResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/** Strip non-digits while typing; caps at 10 digits (Indian mobile without country code). */
export function sanitizeMobileInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

/**
 * Parse and validate an Indian mobile number.
 * Accepts optional +91 / 91 / leading 0; stores normalized 10-digit form.
 */
export function parseIndianMobile(raw: string): IndianMobileResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Mobile number is required." };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return { ok: false, error: "Mobile number cannot contain letters." };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Enter a valid 10-digit mobile number." };
  }

  let ten = "";
  if (digits.length === 10) {
    ten = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    ten = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    ten = digits.slice(1);
  } else if (digits.length > 10) {
    ten = digits.slice(-10);
  } else {
    return { ok: false, error: "Enter a valid 10-digit mobile number." };
  }

  if (!/^[6-9]\d{9}$/.test(ten)) {
    return {
      ok: false,
      error: "Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9.",
    };
  }

  return { ok: true, normalized: ten };
}

/** Compare two mobiles after normalization (ignores +91 / leading 0 formatting). */
export function mobilesMatch(a: string, b: string): boolean {
  const pa = parseIndianMobile(a);
  const pb = parseIndianMobile(b);
  return pa.ok && pb.ok && pa.normalized === pb.normalized;
}

/** Pseudo mobiles for email/Google-only organizer accounts — not Indian mobiles. */
export function isPlaceholderOrganizerMobile(mobile: string): boolean {
  return mobile.startsWith("eml:") || mobile.startsWith("gid_");
}
