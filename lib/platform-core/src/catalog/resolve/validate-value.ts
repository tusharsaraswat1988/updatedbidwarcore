import type { ConcreteRuleValue, RuleDefinitionEntry } from "../types.ts";
import type { ValidationIssue } from "./types.ts";

function typeMatches(type: RuleDefinitionEntry["type"], value: ConcreteRuleValue): boolean {
  if (value === null) return true;
  switch (type) {
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "decimal":
    case "percentage":
    case "duration":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "string":
    case "enum":
      return typeof value === "string";
    case "list":
      return Array.isArray(value);
    case "object":
    case "custom":
      return typeof value === "object";
    default:
      return true;
  }
}

export function validateConcreteValue(
  definition: RuleDefinitionEntry,
  value: ConcreteRuleValue,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = definition.id;

  if (definition.validation?.required && (value === null || value === undefined)) {
    issues.push({
      severity: "ERROR",
      code: "VALUE_REQUIRED",
      message: `Rule ${definition.id} is required`,
      path,
    });
    return issues;
  }

  if (value === null) return issues;

  if (!typeMatches(definition.type, value)) {
    issues.push({
      severity: "ERROR",
      code: "VALUE_TYPE",
      message: `Rule ${definition.id} expects type ${definition.type}`,
      path,
    });
    return issues;
  }

  if (definition.allowedValues && definition.allowedValues.length > 0) {
    const allowed = definition.allowedValues.some((a) => Object.is(a, value));
    if (!allowed) {
      issues.push({
        severity: "ERROR",
        code: "VALUE_NOT_ALLOWED",
        message: `Rule ${definition.id} value is not in allowedValues`,
        path,
      });
    }
  }

  if (typeof value === "number") {
    const { min, max } = definition.validation ?? {};
    if (typeof min === "number" && value < min) {
      issues.push({
        severity: "ERROR",
        code: "VALUE_MIN",
        message: `Rule ${definition.id} is below minimum ${min}`,
        path,
      });
    }
    if (typeof max === "number" && value > max) {
      issues.push({
        severity: "ERROR",
        code: "VALUE_MAX",
        message: `Rule ${definition.id} is above maximum ${max}`,
        path,
      });
    }
  }

  return issues;
}
