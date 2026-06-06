import { AdminTournamentRow } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LiveTournamentPicker({
  tournaments,
  selectedId,
  basePath,
  label = "Tournament",
  preferLive = true,
}: {
  tournaments: AdminTournamentRow[];
  selectedId: number | null;
  basePath: string;
  label?: string;
  preferLive?: boolean;
}) {
  const sorted = [...tournaments].sort((a, b) => {
    const aLive = a.licenseStatus === "active" && !a.adminLocked ? 1 : 0;
    const bLive = b.licenseStatus === "active" && !b.adminLocked ? 1 : 0;
    if (preferLive && aLive !== bLive) return bLive - aLive;
    return a.name.localeCompare(b.name);
  });

  if (!sorted.length) {
    return (
      <div className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
        No tournaments available.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <Select
        value={selectedId ? String(selectedId) : undefined}
        onValueChange={(value) => {
          window.location.href = `${basePath}/${value}`;
        }}
      >
        <SelectTrigger className="h-9 w-full min-w-0 sm:w-[280px]">
          <SelectValue placeholder="Choose tournament" />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>
              {t.name} · #{t.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!selectedId && sorted[0] && (
        <Button size="sm" variant="outline" onClick={() => { window.location.href = `${basePath}/${sorted[0].id}`; }}>
          Open first
        </Button>
      )}
    </div>
  );
}
