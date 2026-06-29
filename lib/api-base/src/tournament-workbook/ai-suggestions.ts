/**
 * BMW AI-Ready Import Suggestions — intelligent value corrections before commit.
 * Architecture supports future LLM integration; current implementation uses synonym maps.
 */

export type ImportSuggestion = {
  sheet: string;
  row: number;
  field: string;
  originalValue: string;
  suggestedValue: string;
  confidence: number;
  reason: string;
  autoApply: boolean;
};

type SynonymRule = {
  field?: string;
  patterns: RegExp[];
  canonical: string;
  reason: string;
  confidence: number;
  autoApply?: boolean;
};

const GLOBAL_SYNONYMS: SynonymRule[] = [
  { patterns: [/^male?s?$/i, /^m$/i], canonical: "Male", reason: "Normalized gender value", confidence: 0.95, autoApply: true },
  { patterns: [/^female?s?$/i, /^f$/i], canonical: "Female", reason: "Normalized gender value", confidence: 0.95, autoApply: true },
  { patterns: [/^yes$/i, /^y$/i, /^true$/i, /^1$/], canonical: "Yes", reason: "Normalized boolean", confidence: 0.98, autoApply: true },
  { patterns: [/^no$/i, /^n$/i, /^false$/i, /^0$/], canonical: "No", reason: "Normalized boolean", confidence: 0.98, autoApply: true },
  { patterns: [/^available$/i, /^avail$/i], canonical: "Available", reason: "Normalized status", confidence: 0.9, autoApply: true },
  { patterns: [/^sold$/i], canonical: "Sold", reason: "Normalized status", confidence: 0.95, autoApply: true },
  { patterns: [/^unsold$/i, /^not sold$/i], canonical: "Unsold", reason: "Normalized status", confidence: 0.9, autoApply: true },
  { patterns: [/^retained$/i, /^rtm$/i], canonical: "Retained", reason: "Normalized status", confidence: 0.9, autoApply: true },
];

const ROLE_SYNONYMS: SynonymRule[] = [
  { field: "Role", patterns: [/^keeper$/i, /^wk$/i, /^wicket keeper$/i, /^wicket-keeper$/i], canonical: "Wicket-Keeper", reason: "Cricket role alias", confidence: 0.92, autoApply: true },
  { field: "Role", patterns: [/^all rounder$/i, /^all-rounder$/i, /^ar$/i], canonical: "All-Rounder", reason: "Cricket role alias", confidence: 0.92, autoApply: true },
  { field: "Role", patterns: [/^bat(?:sman|ter)?$/i, /^bat$/i], canonical: "Batsman", reason: "Cricket role alias", confidence: 0.9, autoApply: true },
  { field: "Role", patterns: [/^bowl(?:er)?$/i], canonical: "Bowler", reason: "Cricket role alias", confidence: 0.9, autoApply: true },
  { field: "Role", patterns: [/^gk$/i, /^goalie$/i, /^goalkeeper$/i], canonical: "Goalkeeper", reason: "Football role alias", confidence: 0.88, autoApply: false },
];

const TAG_SYNONYMS: SynonymRule[] = [
  { field: "Special Tags", patterns: [/^elite player$/i, /^elite$/i], canonical: "Elite", reason: "Player tag alias", confidence: 0.85, autoApply: true },
  { field: "Special Tags", patterns: [/^icon$/i, /^icon player$/i], canonical: "Icon", reason: "Player tag alias", confidence: 0.85, autoApply: true },
  { field: "Special Tags", patterns: [/^marquee$/i], canonical: "Marquee", reason: "Player tag alias", confidence: 0.85, autoApply: true },
];

const ALL_RULES = [...GLOBAL_SYNONYMS, ...ROLE_SYNONYMS, ...TAG_SYNONYMS];

function matchRule(value: string, field: string, rule: SynonymRule): boolean {
  if (rule.field && rule.field.toLowerCase() !== field.toLowerCase()) return false;
  return rule.patterns.some((p) => p.test(value.trim()));
}

export function suggestCorrection(
  sheet: string,
  row: number,
  field: string,
  rawValue: unknown,
): ImportSuggestion | null {
  if (rawValue == null || rawValue === "") return null;
  const originalValue = String(rawValue).trim();
  if (!originalValue) return null;

  for (const rule of ALL_RULES) {
    if (matchRule(originalValue, field, rule)) {
      if (originalValue === rule.canonical) return null;
      return {
        sheet,
        row,
        field,
        originalValue,
        suggestedValue: rule.canonical,
        confidence: rule.confidence,
        reason: rule.reason,
        autoApply: rule.autoApply ?? false,
      };
    }
  }

  return null;
}

export function generateImportSuggestions(
  sheets: Record<string, Record<string, unknown>[]>,
): ImportSuggestion[] {
  const suggestions: ImportSuggestion[] = [];

  for (const [sheetName, rows] of Object.entries(sheets)) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      for (const [field, value] of Object.entries(row)) {
        const suggestion = suggestCorrection(sheetName, i + 2, field, value);
        if (suggestion) suggestions.push(suggestion);
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/** Apply auto-apply suggestions to workbook rows (returns mutated copy) */
export function applyAutoSuggestions(
  sheets: Record<string, Record<string, unknown>[]>,
  suggestions: ImportSuggestion[],
): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const [name, rows] of Object.entries(sheets)) {
    result[name] = rows.map((r) => ({ ...r }));
  }

  for (const s of suggestions) {
    if (!s.autoApply) continue;
    const rows = result[s.sheet];
    if (!rows) continue;
    const rowIdx = s.row - 2;
    if (rowIdx < 0 || rowIdx >= rows.length) continue;
    rows[rowIdx]![s.field] = s.suggestedValue;
  }

  return result;
}

/** Hook for future LLM integration */
export type AiSuggestionProvider = (
  sheet: string,
  field: string,
  value: string,
  context: Record<string, unknown>,
) => Promise<ImportSuggestion | null>;

let aiProvider: AiSuggestionProvider | null = null;

export function registerAiSuggestionProvider(provider: AiSuggestionProvider): void {
  aiProvider = provider;
}

export async function generateImportSuggestionsWithAi(
  sheets: Record<string, Record<string, unknown>[]>,
  context: Record<string, unknown> = {},
): Promise<ImportSuggestion[]> {
  const base = generateImportSuggestions(sheets);
  if (!aiProvider) return base;

  const aiSuggestions: ImportSuggestion[] = [];
  for (const [sheetName, rows] of Object.entries(sheets)) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      for (const [field, value] of Object.entries(row)) {
        if (value == null || value === "") continue;
        const suggestion = await aiProvider(sheetName, field, String(value), {
          ...context,
          row: i + 2,
          rowData: row,
        });
        if (suggestion) aiSuggestions.push(suggestion);
      }
    }
  }

  const seen = new Set(base.map((s) => `${s.sheet}:${s.row}:${s.field}`));
  for (const s of aiSuggestions) {
    const key = `${s.sheet}:${s.row}:${s.field}`;
    if (!seen.has(key)) {
      base.push(s);
      seen.add(key);
    }
  }

  return base.sort((a, b) => b.confidence - a.confidence);
}
