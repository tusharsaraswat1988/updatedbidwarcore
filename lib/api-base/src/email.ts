import { z } from "zod";

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
  const result = z.string().email().safeParse(trimmed);
  if (!result.success) {
    return { ok: false, error: "Please enter a valid email address" };
  }
  return { ok: true, email: trimmed.toLowerCase() };
}
