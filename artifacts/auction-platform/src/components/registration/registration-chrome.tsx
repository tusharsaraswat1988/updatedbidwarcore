import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Passed to portaled select menus so they inherit the registration palette. */
export const registrationSelectContentClass = "registration-portal max-h-[min(50dvh,320px)]";

export function RegSection({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = `reg-section-${step}`;
  return (
    <section className="reg-section" aria-labelledby={headingId}>
      <div className="reg-section-head">
        <span className="reg-step" aria-hidden="true">{step}</span>
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="reg-fields">{children}</div>
    </section>
  );
}

export function RegLabel({
  htmlFor,
  children,
  marker,
  locked,
}: {
  htmlFor?: string;
  children: ReactNode;
  marker?: "required" | "optional";
  locked?: boolean;
}) {
  return (
    <div className="reg-label-row">
      <Label htmlFor={htmlFor} className="inline-flex items-center gap-2">
        {children}
        {locked ? <span className="reg-badge reg-badge--lock">Locked</span> : null}
      </Label>
      {marker === "required" ? (
        <span className="reg-badge reg-badge--req">Required</span>
      ) : marker === "optional" ? (
        <span className="reg-badge reg-badge--opt">Optional</span>
      ) : null}
    </div>
  );
}

export function RegNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "pending";
  children: ReactNode;
}) {
  return (
    <div className={`reg-notice reg-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
