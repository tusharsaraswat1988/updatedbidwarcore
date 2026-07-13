"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TimePeriod = "AM" | "PM";

type ParsedTime = {
  hour12: number;
  minute: number;
  period: TimePeriod;
};

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parseTimeValue(value: string): ParsedTime | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour24) ||
    !Number.isInteger(minute) ||
    hour24 < 0 ||
    hour24 > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const period: TimePeriod = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

function to24HourValue(hour12: number, minute: number, period: TimePeriod): string {
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeLabel(value: string): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return "";
  return `${parsed.hour12}:${String(parsed.minute).padStart(2, "0")} ${parsed.period}`;
}

type TimePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

function TimePicker({
  value = "",
  onChange,
  placeholder = "Select time",
  disabled,
  className,
  id,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseTimeValue(value);
  const hour12 = parsed?.hour12 ?? 12;
  const minute = parsed?.minute ?? 0;
  const period = parsed?.period ?? "PM";

  function commit(next: Partial<ParsedTime>) {
    onChange(
      to24HourValue(
        next.hour12 ?? hour12,
        next.minute ?? minute,
        next.period ?? period,
      ),
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full justify-start rounded-md border border-input bg-secondary/40 px-3 py-1 text-base font-normal text-foreground shadow-sm transition-colors hover:bg-secondary/50 md:text-sm",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          {value && parsed ? formatTimeLabel(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-[260px] space-y-3 p-3" align="start">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Hour</p>
            <Select
              value={String(hour12)}
              onValueChange={(v) => commit({ hour12: Number(v) })}
            >
              <SelectTrigger className="h-9 bg-secondary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[110] max-h-56">
                {HOURS_12.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Minute</p>
            <Select
              value={String(minute).padStart(2, "0")}
              onValueChange={(v) => commit({ minute: Number(v) })}
            >
              <SelectTrigger className="h-9 bg-secondary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[110] max-h-56">
                {MINUTES.map((m) => {
                  const label = String(m).padStart(2, "0");
                  return (
                    <SelectItem key={m} value={label}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Period</p>
          <div className="grid grid-cols-2 gap-2">
            {(["AM", "PM"] as const).map((p) => (
              <Button
                key={p}
                type="button"
                variant={period === p ? "default" : "outline"}
                className={cn(
                  "h-9",
                  period !== p && "bg-secondary/40 hover:bg-secondary/50",
                )}
                onClick={() => commit({ period: p })}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { TimePicker, formatTimeLabel, parseTimeValue, to24HourValue };
