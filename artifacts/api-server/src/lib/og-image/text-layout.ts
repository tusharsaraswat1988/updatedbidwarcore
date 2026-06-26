function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap tournament names into readable lines without overflow. */
export function wrapTitleLines(title: string, maxLines = 4): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["Tournament"];

  const maxChars =
    words.length === 1 && words[0].length > 28 ? 18 : words.some((w) => w.length > 16) ? 22 : 26;

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : `${last}…`;
  }

  return lines;
}

export function titleFontSize(lineCount: number): number {
  if (lineCount <= 1) return 68;
  if (lineCount === 2) return 56;
  if (lineCount === 3) return 46;
  return 38;
}

export function formatRegistrationDeadline(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return `Register by ${trimmed}`;

  const formatted = parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `Register by ${formatted}`;
}

export function escapeSvgText(value: string): string {
  return escapeXml(value);
}
