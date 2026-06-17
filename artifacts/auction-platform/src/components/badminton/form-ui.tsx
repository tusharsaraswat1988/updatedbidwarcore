import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { BadmintonOrganizerShell } from "@/components/badminton/bidwar-badminton-branding";
import { BadmintonHubNav } from "@/components/badminton/badminton-hub-nav";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";



/** Shared form tokens — inherits BidWar auction design system */

export const inputClass =

  "w-full h-11 px-3.5 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-xs transition-colors focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-50 disabled:cursor-not-allowed";



export const labelClass =

  "block text-muted-foreground text-xs font-semibold mb-2 uppercase tracking-wider";



export const selectTriggerClass =

  "h-11 w-full rounded-lg border-border bg-background text-foreground text-sm shadow-xs focus:ring-2 focus:ring-primary/15 focus:border-primary/50 data-[placeholder]:text-muted-foreground";



export const selectContentClass =

  "z-[200] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden";



export const selectItemClass =

  "rounded-md py-2.5 pl-3 pr-9 text-sm focus:bg-accent focus:text-accent-foreground cursor-pointer";



/** Standard hub card — matches auction `Card` */

export const hubCardClass =

  "rounded-xl border bg-card border-border text-card-foreground shadow";



export const hubPanelClass = cn(hubCardClass, "p-5");



export function HubPageShell({

  children,

  className,

  tournamentId,

}: {

  children: React.ReactNode;

  className?: string;

  /** Links “Auction Hub” in the BidWar brand bar back to the main tournament dashboard. */

  tournamentId?: number;

}) {

  return (

    <BadmintonOrganizerShell className={className} tournamentId={tournamentId}>

      {tournamentId ? <BadmintonHubNav tournamentId={tournamentId} /> : null}

      {children}

    </BadmintonOrganizerShell>

  );

}



export function FormField({ label, children }: { label: string; children: React.ReactNode }) {

  return (

    <div>

      <label className={labelClass}>{label}</label>

      {children}

    </div>

  );

}



export function DarkSelect({

  value,

  onValueChange,

  placeholder,

  options,

  disabled,

  className,

}: {

  value: string;

  onValueChange: (value: string) => void;

  placeholder?: string;

  options: { value: string; label: string }[];

  disabled?: boolean;

  className?: string;

}) {

  return (

    <Select value={value} onValueChange={onValueChange} disabled={disabled}>

      <SelectTrigger className={cn(selectTriggerClass, className)}>

        <SelectValue placeholder={placeholder} />

      </SelectTrigger>

      <SelectContent className={selectContentClass}>

        {options.map((opt) => (

          <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>

            {opt.label}

          </SelectItem>

        ))}

      </SelectContent>

    </Select>

  );

}



export function FormError({ message }: { message?: string }) {

  if (!message) return null;

  return (

    <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-destructive text-sm">

      {message}

    </p>

  );

}



export function FormActions({

  onCancel,

  onSubmit,

  submitLabel,

  cancelLabel = "Cancel",

  saving,

  disabled,

}: {

  onCancel: () => void;

  onSubmit: () => void;

  submitLabel: string;

  cancelLabel?: string;

  saving?: boolean;

  disabled?: boolean;

}) {

  return (

    <div className="flex gap-3 pt-1">

      <button

        type="button"

        onClick={onCancel}

        className="flex-1 h-11 rounded-lg border border-border bg-secondary text-secondary-foreground font-semibold text-sm hover-elevate active-elevate-2 transition-colors"

      >

        {cancelLabel}

      </button>

      <button

        type="button"

        onClick={onSubmit}

        disabled={saving || disabled}

        className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground border border-primary-border font-bold text-sm shadow-[var(--shadow-glow)] hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"

      >

        {saving ? "Saving…" : submitLabel}

      </button>

    </div>

  );

}



export function FormModal({

  title,

  subtitle,

  onClose,

  children,

  size = "md",

  footer,

}: {

  title: string;

  subtitle?: string;

  onClose: () => void;

  children: React.ReactNode;

  size?: "sm" | "md" | "lg" | "xl";

  footer?: React.ReactNode;

}) {

  const maxW = {

    sm: "max-w-md",

    md: "max-w-lg",

    lg: "max-w-xl",

    xl: "max-w-2xl",

  }[size];



  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">

      <div

        className={cn(

          "w-full rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",

          maxW,

        )}

      >

        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card/95 px-6 py-4 backdrop-blur-sm">

          <div className="min-w-0">

            <h2 className="text-foreground font-display font-bold text-lg tracking-tight">{title}</h2>

            {subtitle && <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>}

          </div>

          <button

            type="button"

            onClick={onClose}

            aria-label="Close"

            className="flex-none w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent text-xl leading-none transition-colors"

          >

            ×

          </button>

        </div>



        <div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div>



        {footer && (

          <div className="sticky bottom-0 border-t border-border bg-card/95 px-6 py-4 backdrop-blur-sm">

            {footer}

          </div>

        )}

      </div>

    </div>

  );

}



/** Centered spinner + message while async data is loading. */
export function AsyncLoadingPanel({
  message,
  compact = false,
  tone = "default",
}: {
  message: string;
  compact?: boolean;
  tone?: "default" | "inverse";
}) {
  const textClass = tone === "inverse" ? "text-white/45" : "text-muted-foreground";
  const iconClass = tone === "inverse" ? "text-[#4fc3f7]" : "text-primary";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3",
        compact ? "py-8" : "py-12",
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn("animate-spin shrink-0", compact ? "w-6 h-6" : "w-8 h-8", iconClass)} />
      <p className={cn("text-sm max-w-xs", textClass)}>{message}</p>
    </div>
  );
}

/** Inline spinner + message for dropdowns and compact rows. */
export function AsyncLoadingInline({
  message,
  tone = "default",
}: {
  message: string;
  tone?: "default" | "inverse";
}) {
  const textClass = tone === "inverse" ? "text-white/45" : "text-muted-foreground";
  const iconClass = tone === "inverse" ? "text-[#4fc3f7]" : "text-primary";

  return (
    <div className="flex items-center justify-center gap-2.5 px-3 py-4 text-sm" role="status" aria-live="polite">
      <Loader2 className={cn("w-4 h-4 animate-spin shrink-0", iconClass)} />
      <span className={textClass}>{message}</span>
    </div>
  );
}

export function SearchInput({

  value,

  onChange,

  placeholder,

  className,

}: {

  value: string;

  onChange: (value: string) => void;

  placeholder?: string;

  className?: string;

}) {

  return (

    <div className={cn("relative", className)}>

      <svg

        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"

        fill="none"

        viewBox="0 0 24 24"

        stroke="currentColor"

      >

        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />

      </svg>

      <input

        type="text"

        value={value}

        onChange={(e) => onChange(e.target.value)}

        placeholder={placeholder}

        className={cn(inputClass, "h-12 pl-11")}

      />

    </div>

  );

}



export function CheckboxRow({

  checked,

  onChange,

  label,

  description,

  disabled,

}: {

  checked: boolean;

  onChange: (checked: boolean) => void;

  label: string;

  description?: string;

  disabled?: boolean;

}) {

  return (

    <label

      className={cn(

        "flex items-start gap-3 rounded-lg border border-border bg-card/50 px-3.5 py-3 cursor-pointer transition-colors hover:border-primary/25",

        disabled && "opacity-50 cursor-not-allowed",

      )}

    >

      <input

        type="checkbox"

        checked={checked}

        disabled={disabled}

        onChange={(e) => onChange(e.target.checked)}

        className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0"

      />

      <span className="min-w-0">

        <span className="block text-foreground text-sm font-medium">{label}</span>

        {description && <span className="block text-muted-foreground text-xs mt-0.5">{description}</span>}

      </span>

    </label>

  );

}



export function PickerTrigger({

  onClick,

  label,

  empty = true,

}: {

  onClick: () => void;

  label: string;

  empty?: boolean;

}) {

  return (

    <div className="space-y-2">

      <p className={labelClass}>{label}</p>

      <button

        type="button"

        onClick={onClick}

        className={cn(

          "group w-full h-11 px-3.5 rounded-lg border text-sm font-medium transition-all",

          empty

            ? "border-border bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground"

            : "border-primary/30 bg-primary/5 text-foreground",

        )}

      >

        <span className="flex items-center justify-center gap-2">

          <span className="text-primary group-hover:scale-110 transition-transform">+</span>

          Select player

        </span>

      </button>

    </div>

  );

}



export function BtnPrimary({

  children,

  onClick,

  disabled,

  className,

  type = "button",

}: {

  children: React.ReactNode;

  onClick?: () => void;

  disabled?: boolean;

  className?: string;

  type?: "button" | "submit";

}) {

  return (

    <button

      type={type}

      onClick={onClick}

      disabled={disabled}

      className={cn(

        "inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground border border-primary-border px-4 py-2.5 font-semibold text-sm shadow-[var(--shadow-glow)] hover-elevate active-elevate-2 disabled:opacity-50 transition-all",

        className,

      )}

    >

      {children}

    </button>

  );

}



export function BtnSecondary({

  children,

  onClick,

  disabled,

  className,

  type = "button",

}: {

  children: React.ReactNode;

  onClick?: () => void;

  disabled?: boolean;

  className?: string;

  type?: "button" | "submit";

}) {

  return (

    <button

      type={type}

      onClick={onClick}

      disabled={disabled}

      className={cn(

        "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-secondary-foreground px-4 py-2.5 font-semibold text-sm hover-elevate active-elevate-2 disabled:opacity-50 transition-colors",

        className,

      )}

    >

      {children}

    </button>

  );

}


