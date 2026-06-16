import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Shared dark-theme form tokens for badminton hub data entry */
export const inputClass =
  "w-full h-11 px-3.5 rounded-xl bg-[#121c34] border border-white/12 text-white text-sm placeholder:text-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus:outline-none focus:border-[#4fc3f7]/45 focus:ring-2 focus:ring-[#4fc3f7]/15 disabled:opacity-50 disabled:cursor-not-allowed";

export const labelClass =
  "block text-white/45 text-[11px] font-bold mb-2 uppercase tracking-[0.14em]";

export const selectTriggerClass =
  "h-11 w-full rounded-xl border-white/12 bg-[#121c34] text-white text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:ring-2 focus:ring-[#4fc3f7]/15 focus:border-[#4fc3f7]/45 data-[placeholder]:text-white/30 [&>svg]:text-white/40";

export const selectContentClass =
  "z-[200] rounded-xl border border-white/12 bg-[#0c1428] text-white shadow-2xl shadow-black/60 overflow-hidden";

export const selectItemClass =
  "rounded-lg py-2.5 pl-3 pr-9 text-sm text-white/85 focus:bg-[#1a2847] focus:text-white cursor-pointer";

export function HubPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-screen bg-[#060c1a] text-white antialiased", className)}>
      {children}
    </div>
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
    <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-red-300 text-sm">
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
        className="flex-1 h-12 rounded-xl border border-white/12 bg-white/[0.06] text-white/65 font-semibold text-sm hover:bg-white/10 hover:text-white/80 transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving || disabled}
        className="flex-1 h-12 rounded-xl bg-gradient-to-b from-[#0084ff] to-[#0060d3] text-white font-bold text-sm shadow-lg shadow-[#0070f3]/25 hover:from-[#0090ff] hover:to-[#006ee8] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
          "w-full rounded-2xl border border-white/10 bg-[#0a1224] shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[90vh]",
          maxW,
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/8 bg-[#0a1224]/95 px-6 py-4 backdrop-blur-sm">
          <div className="min-w-0">
            <h2 className="text-white font-black text-lg tracking-tight">{title}</h2>
            {subtitle && <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-none w-9 h-9 rounded-lg text-white/40 hover:text-white hover:bg-white/8 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div>

        {footer && (
          <div className="sticky bottom-0 border-t border-white/8 bg-[#0a1224]/95 px-6 py-4 backdrop-blur-sm">
            {footer}
          </div>
        )}
      </div>
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
        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none"
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
        "flex items-start gap-3 rounded-xl border border-white/10 bg-[#121c34]/80 px-3.5 py-3 cursor-pointer transition-colors hover:border-white/16",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded accent-[#0070f3] shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-white/85 text-sm font-medium">{label}</span>
        {description && <span className="block text-white/35 text-xs mt-0.5">{description}</span>}
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
          "group w-full h-12 px-3.5 rounded-xl border text-sm font-medium transition-all",
          empty
            ? "border-white/12 bg-[#121c34] text-white/45 hover:border-[#4fc3f7]/35 hover:text-white/70 hover:bg-[#152038]"
            : "border-[#4fc3f7]/25 bg-[#152038] text-white/80",
        )}
      >
        <span className="flex items-center justify-center gap-2">
          <span className="text-[#4fc3f7] group-hover:scale-110 transition-transform">+</span>
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
        "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0084ff] to-[#0060d3] px-4 py-2.5 font-semibold text-sm text-white shadow-lg shadow-[#0070f3]/20 hover:from-[#0090ff] hover:to-[#006ee8] disabled:opacity-50 transition-all",
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
        "inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 font-semibold text-sm text-white/75 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
