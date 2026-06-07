import { logger } from "../../logger";
import type { ProviderSendResult } from "../types";

const RESEND_API = "https://api.resend.com/emails";

export function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

function getMailFrom(): string | null {
  const from = process.env.MAIL_FROM?.trim();
  return from || null;
}

/**
 * Send transactional email via Resend REST API.
 * Returns stub success when EMAIL_ENABLED is false or credentials are missing.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<ProviderSendResult> {
  if (!isEmailEnabled()) {
    logger.debug({ to: params.to, subject: params.subject }, "Email disabled — stub mode");
    return { success: true, stub: true, messageId: `stub_email_${Date.now()}` };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getMailFrom();

  if (!apiKey || !from) {
    logger.warn(
      { missing: [!apiKey && "RESEND_API_KEY", !from && "MAIL_FROM"].filter(Boolean) },
      "Email provider not configured — stub mode",
    );
    return { success: true, stub: true, messageId: `stub_email_${Date.now()}` };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await res.json().catch(() => ({})) as { id?: string; message?: string };

    if (res.ok && body.id) {
      logger.info({ to: params.to, messageId: body.id }, "Resend email sent");
      return { success: true, messageId: body.id, raw: body };
    }

    const error = body.message ?? `Resend API error (${res.status})`;
    logger.error({ to: params.to, status: res.status, error }, "Resend email failed");
    return { success: false, error, raw: body };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown email error";
    logger.error({ to: params.to, err }, "Resend email exception");
    return { success: false, error };
  }
}
