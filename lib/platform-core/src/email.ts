/** Pragmatic email shape check — aligned with notification-service isValidEmail. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseOptionalEmail(
  value: unknown,
): { ok: true; email: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, email: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Please enter a valid email address" };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, email: null };
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "Please enter a valid email address" };
  }
  return { ok: true, email: trimmed.toLowerCase() };
}
