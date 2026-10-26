import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPlayersQueryKey,
  useUpdatePlayer,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type PlayerCategoryOption = { id: number; name: string; colorCode?: string | null };

export function PlayerCategorySelect({
  tournamentId,
  playerId,
  categoryId,
  categories,
  noneLabel = "—",
  triggerClassName,
}: {
  tournamentId: number;
  playerId: number;
  categoryId: number | null | undefined;
  categories: PlayerCategoryOption[];
  noneLabel?: string;
  triggerClassName?: string;
}) {
  const updatePlayer = useUpdatePlayer();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleChange(value: string) {
    const nextId = value === "none" ? null : parseInt(value, 10);
    if (nextId === (categoryId ?? null)) return;
    setSaving(true);
    try {
      await updatePlayer.mutateAsync({
        tournamentId,
        playerId,
        data: { categoryId: nextId } as Parameters<typeof updatePlayer.mutateAsync>[0]["data"],
      });
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (err as { message?: string })?.message
        || "Please try again";
      toast({ title: "Could not save category", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const selectedCat = categoryId ? categories.find((c) => c.id === categoryId) : null;

  return (
    <Select
      value={categoryId ? String(categoryId) : "none"}
      onValueChange={handleChange}
      disabled={saving}
    >
      <SelectTrigger
        className={cn("h-8 min-w-[120px] max-w-[168px] text-xs border-border/60", triggerClassName)}
        style={selectedCat?.colorCode ? { borderColor: `${selectedCat.colorCode}66` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {saving ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saving…
          </span>
        ) : (
          <SelectValue placeholder="Select…" />
        )}
      </SelectTrigger>
      <SelectContent className="dark" onClick={(e) => e.stopPropagation()}>
        <SelectItem value="none">{noneLabel}</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
