import { sendWhatsApp } from "../../comm-sender";
import type { ProviderSendResult } from "../types";

/**
 * WhatsApp provider — thin wrapper around the existing Twilio implementation.
 * Preserves all existing WhatsApp behaviour and stub-mode semantics.
 */
export async function sendNotificationWhatsApp(to: string, body: string): Promise<ProviderSendResult> {
  const result = await sendWhatsApp(to, body);
  return {
    success: result.success,
    messageId: result.messageSid,
    error: result.error,
    stub: result.stub,
    raw: result,
  };
}
