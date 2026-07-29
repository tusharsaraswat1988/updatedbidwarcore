import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormField } from "@/components/badminton/form-ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export type RegistrationPlayer = {
  id: number;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  franchiseName?: string | null;
};

export function playerDisplayName(p: RegistrationPlayer): string {
  return p.displayName?.trim() || `${p.firstName} ${p.lastName}`.trim();
}

export function PlayerNameWithTeam({
  player,
  layout = "inline",
}: {
  player: RegistrationPlayer;
  layout?: "inline" | "stack";
}) {
  const name = playerDisplayName(player);
  const team = player.franchiseName?.trim();
  if (!team) return <span className="truncate">{name}</span>;
  if (layout === "stack") {
    return (
      <span className="flex flex-col min-w-0 text-left">
        <span className="truncate font-medium text-foreground">{name}</span>
        <span className="truncate text-[11px] text-muted-foreground">{team}</span>
      </span>
    );
  }
  return (
    <span className="truncate text-left">
      <span className="font-medium text-foreground">{name}</span>
      <span className="text-muted-foreground"> · </span>
      <span className="text-muted-foreground text-xs">{team}</span>
    </span>
  );
}

export function formatPlayerEntryLabel(p: RegistrationPlayer): string {
  const name = playerDisplayName(p);
  const team = p.franchiseName?.trim();
  return team ? `${name} · ${team}` : name;
}

export function RegistrationPlayerSelect({
  label,
  required,
  value,
  onChange,
  players,
  excludePlayerIds = [],
  placeholder = "Select player…",
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (playerId: string) => void;
  players: RegistrationPlayer[];
  excludePlayerIds?: number[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const excludeSet = useMemo(() => new Set(excludePlayerIds), [excludePlayerIds]);
  const available = useMemo(
    () => players.filter((p) => !excludeSet.has(p.id)),
    [players, excludeSet],
  );
  const selected = players.find((p) => String(p.id) === value);

  return (
    <FormField label={label} required={required}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full h-11 justify-between px-3.5 font-normal rounded-lg border-border bg-background text-sm shadow-xs hover:bg-background",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="min-w-0 flex-1 text-left truncate">
              {selected ? <PlayerNameWithTeam player={selected} /> : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 z-[250]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search by player or team…" />
            <CommandList>
              <CommandEmpty>No player found.</CommandEmpty>
              {available.map((p) => {
                const name = playerDisplayName(p);
                const team = p.franchiseName?.trim() ?? "";
                return (
                  <CommandItem
                    key={p.id}
                    value={`${name} ${team} ${p.id}`}
                    onSelect={() => {
                      onChange(String(p.id));
                      setOpen(false);
                    }}
                    className="py-2.5"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === String(p.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <PlayerNameWithTeam player={p} layout="stack" />
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormField>
  );
}
