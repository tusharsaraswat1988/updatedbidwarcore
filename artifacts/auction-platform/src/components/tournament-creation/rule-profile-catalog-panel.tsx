import {
  CatalogRegistry,
  type RuleProfileCatalogEntry,
  type RuleProfileValueEntry,
} from "@workspace/platform-core/catalog";
import { cn } from "@/lib/utils";

type RuleProfileCatalogPanelProps = {
  profile: RuleProfileCatalogEntry | null;
};

/**
 * Read-only Product Catalog inspection for a selected Rule Profile.
 * Architecture allows future search / compare / changelog — not implemented here.
 */
export function RuleProfileCatalogPanel({ profile }: RuleProfileCatalogPanelProps) {
  if (!profile) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a rule profile to inspect its product definition.
      </p>
    );
  }

  const categories = CatalogRegistry.listRuleCategories();
  const byCategory = new Map<string, RuleProfileValueEntry[]>();
  for (const entry of profile.values) {
    const def = CatalogRegistry.getRuleDefinition(entry.definitionId, entry.definitionVersion);
    const categoryId = def?.categoryId ?? "match";
    const list = byCategory.get(categoryId) ?? [];
    list.push(entry);
    byCategory.set(categoryId, list);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm">{profile.displayName}</p>
          <StatusBadge status={profile.status} />
          <span className="text-[10px] font-mono text-muted-foreground">
            {profile.familyId}@{profile.version}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{profile.description}</p>
        {profile.tags.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Tags: {profile.tags.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
        {categories.map((category) => {
          const values = byCategory.get(category.id);
          if (!values || values.length === 0) return null;
          return (
            <div key={category.id} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {category.displayName}
              </p>
              <ul className="space-y-1">
                {values.map((entry) => {
                  const def = CatalogRegistry.getRuleDefinition(
                    entry.definitionId,
                    entry.definitionVersion,
                  );
                  return (
                    <li
                      key={`${entry.definitionId}@${entry.definitionVersion}`}
                      className="flex items-baseline justify-between gap-3 text-xs"
                    >
                      <span className="text-foreground/90">
                        {def?.name ?? entry.definitionId}
                      </span>
                      <span className="font-mono text-muted-foreground shrink-0">
                        {entry.value === "inherit" ? "inherit" : formatValue(entry.value)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
        status === "active" && "bg-emerald-500/15 text-emerald-400",
        status === "beta" && "bg-sky-500/15 text-sky-400",
        status === "deprecated" && "bg-amber-500/15 text-amber-400",
        status === "legacy" && "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
