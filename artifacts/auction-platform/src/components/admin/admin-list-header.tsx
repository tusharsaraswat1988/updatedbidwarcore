/**
 * Shared column-header row for the custom-grid list pattern used across
 * Tournaments, Organisers, Academy, Dashboard, Tournament Detail, Organiser
 * Detail, and Live Operations. Centralizing this removes the previously
 * duplicated (and slightly inconsistent) header markup so every list in the
 * admin panel shares one visual language for column headers, even though
 * each list still defines its own grid-template-columns per call site.
 *
 * `gridClassName` must be a literal string at each call site (e.g.
 * `"md:grid md:grid-cols-[1fr_120px] md:gap-4"`) so Tailwind's build-time
 * scanner can see and generate the classes — do not construct it from
 * runtime variables.
 */
export function AdminListHeader({
  gridClassName,
  columns,
}: {
  gridClassName: string;
  columns: Array<{ label: string; align?: "right" }>;
}) {
  return (
    <div
      className={`hidden border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground ${gridClassName}`}
    >
      {columns.map((c) => (
        <span key={c.label} className={c.align === "right" ? "text-right" : undefined}>
          {c.label}
        </span>
      ))}
    </div>
  );
}
