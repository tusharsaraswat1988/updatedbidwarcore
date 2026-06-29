/**
 * BMW Column Mapping Profiles — saved mappings for organizer-specific sheet formats.
 * Auto-applied on subsequent imports from the same source.
 */

export type MappingProfileField = {
  sourceColumn: string;
  targetField: string;
  targetSheet: string;
  transform?: "none" | "boolean" | "number" | "date" | "status" | "role";
};

export type WorkbookMappingProfile = {
  id?: number;
  name: string;
  organizerId?: number | null;
  tournamentId?: number | null;
  sourceLabel?: string;
  sport?: string;
  fields: MappingProfileField[];
  createdBy?: string;
  createdAt?: string;
  lastUsedAt?: string;
  useCount?: number;
};

/** Normalize column header for fuzzy matching */
export function normalizeColumnHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\s-]+/g, " ");
}

/** Apply a mapping profile to raw sheet headers → BMW canonical labels */
export function applyMappingProfile(
  headers: string[],
  rows: unknown[][],
  profile: WorkbookMappingProfile,
): { headers: string[]; rows: unknown[][] } {
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => headerIndex.set(normalizeColumnHeader(h), i));

  const mappedHeaders: string[] = [];
  const columnMap: Array<number | null> = [];

  for (const mapping of profile.fields) {
    const idx = headerIndex.get(normalizeColumnHeader(mapping.sourceColumn));
    if (idx != null) {
      mappedHeaders.push(mapping.targetField);
      columnMap.push(idx);
    }
  }

  const mappedRows = rows.map((row) =>
    columnMap.map((srcIdx) => (srcIdx != null ? row[srcIdx] : undefined)),
  );

  return { headers: mappedHeaders, rows: mappedRows };
}

/** Suggest mapping from unknown headers to BMW field labels */
export function suggestMappingProfile(
  sourceHeaders: string[],
  targetFields: Array<{ sheet: string; label: string }>,
): MappingProfileField[] {
  const suggestions: MappingProfileField[] = [];
  const usedTargets = new Set<string>();

  for (const header of sourceHeaders) {
    const normalized = normalizeColumnHeader(header);
    let bestMatch: { sheet: string; label: string; score: number } | null = null;

    for (const target of targetFields) {
      const targetNorm = normalizeColumnHeader(target.label);
      let score = 0;
      if (normalized === targetNorm) score = 100;
      else if (normalized.includes(targetNorm) || targetNorm.includes(normalized)) score = 70;
      else {
        const headerWords = normalized.split(" ");
        const targetWords = targetNorm.split(" ");
        const overlap = headerWords.filter((w) => targetWords.includes(w)).length;
        if (overlap > 0) score = overlap * 20;
      }
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { sheet: target.sheet, label: target.label, score };
      }
    }

    if (bestMatch && bestMatch.score >= 40 && !usedTargets.has(`${bestMatch.sheet}:${bestMatch.label}`)) {
      usedTargets.add(`${bestMatch.sheet}:${bestMatch.label}`);
      suggestions.push({
        sourceColumn: header,
        targetField: bestMatch.label,
        targetSheet: bestMatch.sheet,
      });
    }
  }

  return suggestions;
}

/** Collect all BMW target field labels from sheet definitions */
export function buildTargetFieldCatalog(
  sheets: Array<{ name: string; fields: Array<{ label: string }> }>,
): Array<{ sheet: string; label: string }> {
  const catalog: Array<{ sheet: string; label: string }> = [];
  for (const sheet of sheets) {
    for (const field of sheet.fields) {
      catalog.push({ sheet: sheet.name, label: field.label });
    }
  }
  return catalog;
}
