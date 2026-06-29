/**
 * BMW Workbook Health Score — overall data quality metric (0–100%).
 */

import type { WorkbookIssue, WorkbookPreviewSummary } from "./types.ts";

export type HealthCategory =
  | "duplicates"
  | "missing_photos"
  | "unknown_categories"
  | "broken_urls"
  | "empty_teams"
  | "invalid_roles"
  | "validation_errors"
  | "validation_warnings"
  | "suggestions";

export type HealthBreakdown = {
  category: HealthCategory;
  label: string;
  count: number;
  severity: "error" | "warning" | "suggestion";
  penalty: number;
};

export type WorkbookHealthScore = {
  score: number;
  grade: "excellent" | "good" | "fair" | "poor" | "critical";
  errors: number;
  warnings: number;
  suggestions: number;
  breakdown: HealthBreakdown[];
};

const CATEGORY_PATTERNS: Array<{
  category: HealthCategory;
  label: string;
  pattern: RegExp;
  severity: "error" | "warning" | "suggestion";
  penalty: number;
}> = [
  { category: "duplicates", label: "Duplicate identities", pattern: /duplicate/i, severity: "error", penalty: 5 },
  { category: "missing_photos", label: "Missing photos", pattern: /missing photo|no photo|photo.*not found/i, severity: "warning", penalty: 1 },
  { category: "unknown_categories", label: "Unknown categories", pattern: /category.*not found|unknown category/i, severity: "error", penalty: 3 },
  { category: "broken_urls", label: "Broken or invalid URLs", pattern: /url|download failed|not a valid url/i, severity: "warning", penalty: 2 },
  { category: "empty_teams", label: "Empty teams", pattern: /empty team|team.*required|no players.*team/i, severity: "warning", penalty: 2 },
  { category: "invalid_roles", label: "Invalid roles for sport", pattern: /invalid role|role.*not valid/i, severity: "error", penalty: 3 },
  { category: "validation_errors", label: "Validation errors", pattern: /required|must be|invalid/i, severity: "error", penalty: 4 },
];

function gradeFromScore(score: number): WorkbookHealthScore["grade"] {
  if (score >= 95) return "excellent";
  if (score >= 85) return "good";
  if (score >= 70) return "fair";
  if (score >= 50) return "poor";
  return "critical";
}

export function computeHealthScore(
  issues: WorkbookIssue[],
  summary: WorkbookPreviewSummary,
  suggestions: string[] = [],
): WorkbookHealthScore {
  const breakdownMap = new Map<HealthCategory, HealthBreakdown>();

  for (const issue of issues) {
    let matched = false;
    for (const rule of CATEGORY_PATTERNS) {
      if (rule.pattern.test(issue.message)) {
        const existing = breakdownMap.get(rule.category);
        if (existing) {
          existing.count++;
        } else {
          breakdownMap.set(rule.category, {
            category: rule.category,
            label: rule.label,
            count: 1,
            severity: issue.severity === "error" ? "error" : rule.severity,
            penalty: rule.penalty,
          });
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      const key = issue.severity === "error" ? "validation_errors" : "validation_warnings";
      const existing = breakdownMap.get(key as HealthCategory);
      if (existing) {
        existing.count++;
      } else {
        breakdownMap.set(key as HealthCategory, {
          category: key as HealthCategory,
          label: issue.severity === "error" ? "Other errors" : "Other warnings",
          count: 1,
          severity: issue.severity,
          penalty: issue.severity === "error" ? 4 : 1,
        });
      }
    }
  }

  if (suggestions.length > 0) {
    breakdownMap.set("suggestions", {
      category: "suggestions",
      label: "AI suggestions available",
      count: suggestions.length,
      severity: "suggestion",
      penalty: 0,
    });
  }

  let totalPenalty = 0;
  for (const item of breakdownMap.values()) {
    totalPenalty += item.count * item.penalty;
  }

  const rowFactor = summary.rowsTotal > 0 ? Math.min(summary.rowsTotal / 100, 10) : 1;
  const adjustedPenalty = totalPenalty / rowFactor;
  const score = Math.max(0, Math.min(100, Math.round(100 - adjustedPenalty)));

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return {
    score,
    grade: gradeFromScore(score),
    errors,
    warnings,
    suggestions: suggestions.length,
    breakdown: [...breakdownMap.values()],
  };
}
