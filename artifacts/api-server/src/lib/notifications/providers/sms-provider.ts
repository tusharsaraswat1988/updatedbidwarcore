import { sendSms } from "../../comm-sender";
import type { ProviderSendResult } from "../types";

/**
 * SMS provider — thin wrapper around the existing BulkSMS Gateway implementation.
 * Preserves all existing SMS behaviour and stub-mode semantics.
 */
export async function sendNotificationSms(to: string, body: string): Promise<ProviderSendResult> {
  const result = await sendSms(to, body);
  return {
    success: result.success,
    messageId: result.messageSid,
    error: result.error,
    stub: result.stub,
    raw: result,
  };
}
