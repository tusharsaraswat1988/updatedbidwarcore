/** Parse organizer declaration text (one point per line) into trimmed non-empty points. */
export function parseRegistrationDeclarationPoints(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Serialize declaration points back to stored text (one point per line). */
export function formatRegistrationDeclarationPoints(points: string[]): string {
  return points.map((p) => p.trim()).filter(Boolean).join("\n");
}
