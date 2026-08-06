import { ASSET_EPOCH, type ConcreteRuleValue, type RuleDefinitionEntry } from "../types.ts";

export function def(input: {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  sportId: string;
  type: RuleDefinitionEntry["type"];
  defaultValue: ConcreteRuleValue;
  allowedValues?: readonly ConcreteRuleValue[];
  validation?: RuleDefinitionEntry["validation"];
  dependencies?: readonly string[];
  conflicts?: readonly string[];
  futureCompatible?: boolean;
  status?: RuleDefinitionEntry["status"];
  version?: string;
}): RuleDefinitionEntry {
  return {
    id: input.id,
    version: input.version ?? "1.0.0",
    status: input.status ?? "active",
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
    sportId: input.sportId,
    type: input.type,
    defaultValue: input.defaultValue,
    allowedValues: input.allowedValues,
    validation: input.validation,
    dependencies: input.dependencies,
    conflicts: input.conflicts,
    futureCompatible: input.futureCompatible ?? true,
    createdAt: ASSET_EPOCH,
    updatedAt: ASSET_EPOCH,
  };
}

export function value(
  definitionId: string,
  concrete: ConcreteRuleValue | "inherit",
  definitionVersion = "1.0.0",
) {
  return { definitionId, definitionVersion, value: concrete } as const;
}
