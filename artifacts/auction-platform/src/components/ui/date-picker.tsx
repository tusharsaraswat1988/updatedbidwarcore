"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import {
  getIstTodayDateString,
  parseAuctionDateString,
} from "@workspace/api-base/auction-date";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string): string {
  const date = parseAuctionDateString(value);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type DatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** When true, only today (IST) and future dates can be selected. */
  disablePastDates?: boolean;
  minDate?: string;
};

function DatePicker({
  value = "",
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  id,
  disablePastDates = false,
  minDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseAuctionDateString(value) : undefined;
  const minSelectableDate = React.useMemo(() => {
    const minStr = disablePastDates ? (minDate ?? getIstTodayDateString()) : minDate;
    return minStr ? parseAuctionDateString(minStr) : undefined;
  }, [disablePastDates, minDate]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full justify-start rounded-md border border-input/70 bg-muted/10 px-3 py-1 text-base font-normal shadow-sm transition-colors hover:bg-muted/10 md:text-sm",
            !value && "text-muted-foreground/60",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          {value ? formatDateLabel(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          disabled={minSelectableDate ? { before: minSelectableDate } : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatDateValue(date));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker, formatDateValue, parseAuctionDateString as parseDateValue };
