import type { CommunicationTemplate } from "@workspace/db";
import type { CommunicationPendingReason } from "./types.js";

function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.startsWith("eml:") || trimmed.startsWith("gid_")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export type ValidationResult = {
  canQueue: boolean;
  canRender: boolean;
  pendingReason: CommunicationPendingReason | null;
};

export function validateJobForSend(params: {
  recipientEmail?: string | null;
  template?: CommunicationTemplate | null;
  mergeData?: Record<string, unknown>;
}): ValidationResult {
  const { recipientEmail, template } = params;

  if (!template) {
    return { canQueue: false, canRender: false, pendingReason: "validation_failed" };
  }

  if (!template.isActive) {
    return { canQueue: false, canRender: true, pendingReason: "template_disabled" };
  }

  if (template.isDraft) {
    return { canQueue: false, canRender: true, pendingReason: "template_draft" };
  }

  if (!isValidEmail(recipientEmail)) {
    return { canQueue: false, canRender: true, pendingReason: "email_missing" };
  }

  if (!template.subject?.trim() || !template.htmlBody?.trim()) {
    return { canQueue: false, canRender: false, pendingReason: "validation_failed" };
  }

  return { canQueue: true, canRender: true, pendingReason: null };
}
