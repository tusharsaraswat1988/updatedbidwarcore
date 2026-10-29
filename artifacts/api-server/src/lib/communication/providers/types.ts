import type { Request } from "express";

export type WhatsAppProviderId =
  | "kv_techmedia"
  | "twilio"
  | "meta_direct"
  | "mock"
  | "none";

export interface WhatsAppSendInput {
  to: string;
  type?: "template" | "text";
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<{
    type: "header" | "body" | "button";
    sub_type?: string;
    index?: string | number;
    parameters: Array<{
      type: "text" | "currency" | "date_time" | "image" | "document" | "video";
      text?: string;
      image?: { link: string };
      document?: { link: string; filename?: string };
    }>;
  }>;
  templateSid?: string; // Twilio-specific content SID
  textBody?: string;
  previewUrl?: boolean;
}

export interface ProviderSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable: boolean;
  statusCode?: number;
  rawResponse?: unknown;
  stub?: boolean;
}

export interface NormalizedDeliveryReceipt {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipientId: string;
  timestamp: Date;
  errorCode?: number;
  errorMessage?: string;
}

export interface NormalizedInboundMessage {
  from: string;
  messageId: string;
  timestamp: Date;
  type: string;
  text?: string;
  raw: unknown;
}

export interface ProviderValidationResult {
  valid: boolean;
  provider: WhatsAppProviderId;
  errors: string[];
  details?: Record<string, string>;
}

export interface IWhatsAppProvider {
  readonly providerId: WhatsAppProviderId;
  validateConfig(): { valid: boolean; errors: string[] };
  send(input: WhatsAppSendInput): Promise<ProviderSendResult>;
  verifyWebhookSignature(req: Request): boolean;
  verifyWebhookChallenge?(req: Request): { isValid: boolean; challenge?: string };
  normalizeWebhookPayload(body: unknown): {
    statuses: NormalizedDeliveryReceipt[];
    messages: NormalizedInboundMessage[];
  };
}
