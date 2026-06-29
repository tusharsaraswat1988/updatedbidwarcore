/**
 * BMW field-level diff — preview old → new values before commit.
 */

export type FieldDiff = {
  sheet: string;
  row: number;
  field: string;
  identity?: string;
  entityType?: string;
  entityId?: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: "create" | "update" | "delete" | "unchanged";
};

export type DiffSummary = {
  total: number;
  creates: number;
  updates: number;
  deletes: number;
  unchanged: number;
  bySheet: Record<string, number>;
};

function serializeDiffValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function buildFieldDiffs(
  currentRecords: Array<{
    sheet: string;
    row: number;
    identity?: string;
    entityType?: string;
    entityId?: string;
    fields: Record<string, unknown>;
  }>,
  stagedRecords: Array<{
    sheet: string;
    row: number;
    identity?: string;
    entityType?: string;
    entityId?: string;
    fields: Record<string, unknown>;
    isNew?: boolean;
  }>,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const currentByIdentity = new Map<string, typeof currentRecords[0]>();

  for (const rec of currentRecords) {
    const key = `${rec.sheet}:${rec.identity ?? rec.row}`;
    currentByIdentity.set(key, rec);
  }

  for (const staged of stagedRecords) {
    const key = `${staged.sheet}:${staged.identity ?? staged.row}`;
    const current = currentByIdentity.get(key);

    if (staged.isNew || !current) {
      for (const [field, newVal] of Object.entries(staged.fields)) {
        const serialized = serializeDiffValue(newVal);
        if (serialized == null) continue;
        diffs.push({
          sheet: staged.sheet,
          row: staged.row,
          field,
          identity: staged.identity,
          entityType: staged.entityType,
          entityId: staged.entityId,
          oldValue: null,
          newValue: serialized,
          changeType: "create",
        });
      }
      continue;
    }

    const allFields = new Set([...Object.keys(current.fields), ...Object.keys(staged.fields)]);
    for (const field of allFields) {
      const oldVal = serializeDiffValue(current.fields[field]);
      const newVal = serializeDiffValue(staged.fields[field]);
      if (oldVal === newVal) {
        diffs.push({
          sheet: staged.sheet,
          row: staged.row,
          field,
          identity: staged.identity,
          entityType: staged.entityType,
          entityId: staged.entityId,
          oldValue: oldVal,
          newValue: newVal,
          changeType: "unchanged",
        });
      } else if (newVal == null && oldVal != null) {
        diffs.push({
          sheet: staged.sheet,
          row: staged.row,
          field,
          identity: staged.identity,
          oldValue: oldVal,
          newValue: null,
          changeType: "delete",
        });
      } else {
        diffs.push({
          sheet: staged.sheet,
          row: staged.row,
          field,
          identity: staged.identity,
          entityType: staged.entityType,
          entityId: staged.entityId,
          oldValue: oldVal,
          newValue: newVal,
          changeType: "update",
        });
      }
    }
  }

  return diffs;
}

export function summarizeDiffs(diffs: FieldDiff[]): DiffSummary {
  const bySheet: Record<string, number> = {};
  let creates = 0;
  let updates = 0;
  let deletes = 0;
  let unchanged = 0;

  for (const d of diffs) {
    if (d.changeType === "unchanged") {
      unchanged++;
      continue;
    }
    bySheet[d.sheet] = (bySheet[d.sheet] ?? 0) + 1;
    if (d.changeType === "create") creates++;
    else if (d.changeType === "update") updates++;
    else if (d.changeType === "delete") deletes++;
  }

  return {
    total: creates + updates + deletes,
    creates,
    updates,
    deletes,
    unchanged,
    bySheet,
  };
}

/** Filter to only actionable diffs for preview UI */
export function getActionableDiffs(diffs: FieldDiff[]): FieldDiff[] {
  return diffs.filter((d) => d.changeType !== "unchanged");
}
