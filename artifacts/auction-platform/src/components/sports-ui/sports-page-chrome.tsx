import React, { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useInSportsShell } from "@/components/sports-shell";

export { hubCardClass, hubPanelClass } from "@/components/platform/platform-surface";
export { EmptyState } from "@/components/platform/empty-state";
export { HubKpiCard } from "@/components/platform/platform-card";
export { HubSectionHeader } from "@/components/platform/section-header";

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
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
}) {
  const maxW = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-xl",
    xl: "max-w-2xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-2 sm:p-4 sm:items-center bg-black/75 backdrop-blur-md">
      <div
        className={cn(
          "my-auto flex w-full max-h-[min(94dvh,100%)] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl",
          maxW,
        )}
      >
        <div className="z-10 flex shrink-0 items-start justify-between gap-3 sm:gap-4 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-foreground font-display font-bold text-base sm:text-lg tracking-tight">{title}</h2>
            {subtitle && <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-none min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">{children}</div>

        {footer && (
          <div className="z-10 shrink-0 border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full h-11 px-3.5 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-xs transition-colors focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-50 disabled:cursor-not-allowed";

export const labelClass =
  "block text-muted-foreground text-xs font-semibold mb-2 uppercase tracking-wider";

export function FormField({
  label,
  children,
  required,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
        {required ? (
          <>
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {required ? (
        <p className="text-muted-foreground text-[10px] mb-2 -mt-1 normal-case tracking-normal font-normal">
          Required
        </p>
      ) : null}
      {children}
    </div>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const selectTriggerClass =
  "h-11 w-full rounded-lg border-border bg-background text-foreground text-sm shadow-xs focus:ring-2 focus:ring-primary/15 focus:border-primary/50 data-[placeholder]:text-muted-foreground";

export const selectContentClass =
  "z-[300] max-h-[min(18rem,var(--radix-select-content-available-height))] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg";

export const selectItemClass =
  "rounded-md py-2.5 pl-3 pr-9 text-sm focus:bg-accent focus:text-accent-foreground cursor-pointer";

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
        className="flex-1 h-11 rounded-lg border border-border bg-secondary text-secondary-foreground font-semibold text-sm hover-elevate active-elevate-2 transition-colors cursor-pointer"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving || disabled}
        className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground border border-primary-border font-bold text-sm shadow-[var(--shadow-glow)] hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
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
        className={cn(
          "w-full h-11 pl-11 pr-4 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-xs transition-colors focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15",
          className,
        )}
      />
    </div>
  );
}

export const btnPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm h-11 px-5 shadow-[var(--shadow-glow)] hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer";

export const btnSecondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-secondary-foreground font-semibold text-sm h-11 px-5 hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer";

export const btnCompactClass = "h-9 px-3.5 text-xs rounded-md";

function BtnLink({
  href,
  className,
  title,
  external,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  external?: boolean;
  children: ReactNode;
}) {
  const isHttp = external || href.startsWith("http://") || href.startsWith("https://");
  if (isHttp) {
    return (
      <a
        href={href}
        className={className}
        title={title}
        {...(isHttp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}

export const BtnPrimary = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: string;
    external?: boolean;
  }
>(({ children, onClick, disabled, className, type = "button", href, title, external, ...props }, ref) => {
  const classes = cn(btnPrimaryClass, className);
  if (href) {
    if (disabled) {
      return (
        <span className={cn(classes, "opacity-50 pointer-events-none")} title={title} aria-disabled>
          {children}
        </span>
      );
    }
    return (
      <BtnLink href={href} className={classes} title={title} external={external}>
        {children}
      </BtnLink>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      title={title}
      {...props}
    >
      {children}
    </button>
  );
});
BtnPrimary.displayName = "BtnPrimary";

export const BtnSecondary = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: string;
    external?: boolean;
  }
>(({ children, onClick, disabled, className, type = "button", href, title, external, ...props }, ref) => {
  const classes = cn(btnSecondaryClass, className);
  if (href) {
    if (disabled) {
      return (
        <span className={cn(classes, "opacity-50 pointer-events-none")} title={title} aria-disabled>
          {children}
        </span>
      );
    }
    return (
      <BtnLink href={href} className={classes} title={title} external={external}>
        {children}
      </BtnLink>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      title={title}
      {...props}
    >
      {children}
    </button>
  );
});
BtnSecondary.displayName = "BtnSecondary";

export function SportsPageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  badge,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  eyebrow?: string;
  badge?: string;
  tournamentId?: number;
  showBrandMark?: boolean;
}) {
  return (
    <div className="border-b border-border px-3.5 py-3.5 sm:px-6 sm:py-5">
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {eyebrow}
              </p>
            ) : null}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
                {title}
              </h1>
              {badge ? <Badge variant="secondary">{badge}</Badge> : null}
            </div>
            {subtitle ? <div className="text-xs sm:text-sm text-muted-foreground">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
