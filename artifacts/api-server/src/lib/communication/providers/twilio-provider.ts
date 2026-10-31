import crypto from "crypto";
import type { Request } from "express";
import { logger, maskPhoneNumber } from "../../logger";
import { getPublicOrigin } from "../../runtime-env";
import type {
  IWhatsAppProvider,
  WhatsAppSendInput,
  ProviderSendResult,
  NormalizedDeliveryReceipt,
  NormalizedInboundMessage,
} from "./types";

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  whatsappFrom?: string;
}

export class TwilioWhatsAppProvider implements IWhatsAppProvider {
  public readonly providerId = "twilio" as const;
  private config: TwilioConfig;

  constructor(customConfig?: Partial<TwilioConfig>) {
    this.config = {
      accountSid: customConfig?.accountSid ?? process.env.TWILIO_ACCOUNT_SID,
      authToken: customConfig?.authToken ?? process.env.TWILIO_AUTH_TOKEN,
      whatsappFrom: customConfig?.whatsappFrom ?? process.env.TWILIO_WHATSAPP_FROM,
    };
  }

  /**
   * Normalise a phone number to E.164 format (e.g. +91XXXXXXXXXX).
   */
  public toE164(mobile: string): string {
    const digits = mobile.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
    if (digits.startsWith("0") && digits.length === 11) return `+91${digits.slice(1)}`;
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  }

  /**
   * Validate required environment configuration for Twilio.
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const sid = this.config.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
    const token = this.config.authToken ?? process.env.TWILIO_AUTH_TOKEN;
    const from = this.config.whatsappFrom ?? process.env.TWILIO_WHATSAPP_FROM;

    if (!sid || sid.trim() === "") {
      errors.push("TWILIO_ACCOUNT_SID is missing");
    } else if (!sid.startsWith("AC") && process.env.NODE_ENV === "production") {
      errors.push("TWILIO_ACCOUNT_SID format appears invalid (should start with AC)");
    }

    if (!token || token.trim() === "") {
      errors.push("TWILIO_AUTH_TOKEN is missing");
    }

    if (!from || from.trim() === "") {
      errors.push("TWILIO_WHATSAPP_FROM is missing");
    } else if (!from.startsWith("whatsapp:") && process.env.NODE_ENV === "production") {
      errors.push("TWILIO_WHATSAPP_FROM must begin with 'whatsapp:'");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Verifies the X-Twilio-Signature header using HMAC-SHA1.
   */
  public verifyWebhookSignature(req: Request): boolean {
    const authToken = this.config.authToken ?? process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      if (process.env.NODE_ENV === "production") {
        logger.error("Twilio webhook rejected: TWILIO_AUTH_TOKEN missing in production (failing closed)");
        return false;
      }
      return true; // stub mode in non-production
    }

    const signature = req.headers["x-twilio-signature"] as string | undefined;
    if (!signature) return false;

    const rawProtoHeader = req.headers["x-forwarded-proto"];
    const rawProto = (Array.isArray(rawProtoHeader) ? rawProtoHeader[0] : (rawProtoHeader as string | undefined)) ?? "https";
    const proto = (rawProto.split(",")[0] ?? "").trim().toLowerCase() || "https";
    if (proto !== "https" && proto !== "http") {
      logger.warn({ proto }, "Twilio webhook rejected: invalid or malformed protocol header");
      return false;
    }

    const rawHostHeader = req.headers["x-forwarded-host"];
    const rawHost = (Array.isArray(rawHostHeader) ? rawHostHeader[0] : (rawHostHeader as string | undefined)) ?? req.headers.host ?? "";
    const host = (rawHost.split(",")[0] ?? "").trim();
    if (!host || !/^[a-zA-Z0-9.-]+(:[0-9]+)?$/.test(host)) {
      logger.warn({ host }, "Twilio webhook rejected: unable to determine valid host for signature verification");
      return false;
    }

    const url = `${proto}://${host}${req.originalUrl}`;
    const body = (req.body as Record<string, string>) || {};
    const params = Object.keys(body).sort().reduce((acc, key) => acc + key + (body[key] ?? ""), "");
    const str = url + params;

    const expected = crypto.createHmac("sha1", authToken).update(str).digest("base64");

    try {
      const expectedBuf = Buffer.from(expected, "utf8");
      const signatureBuf = Buffer.from(signature, "utf8");
      if (expectedBuf.length !== signatureBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  /**
   * Send WhatsApp message via Twilio Messages REST API.
   */
  public async send(input: WhatsAppSendInput): Promise<ProviderSendResult> {
    const sid = this.config.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
    const token = this.config.authToken ?? process.env.TWILIO_AUTH_TOKEN;
    const from = this.config.whatsappFrom ?? process.env.TWILIO_WHATSAPP_FROM;
    const isProduction = process.env.NODE_ENV === "production";
    const e164 = this.toE164(input.to);
    const maskedTo = maskPhoneNumber(e164);

    if (!sid || !token || !from) {
      if (isProduction) {
        logger.error({ to: maskedTo }, "Twilio WhatsApp credentials missing in production");
        return {
          success: false,
          retryable: false,
          error: "Twilio credentials missing in production",
        };
      }
      logger.warn({ to: maskedTo }, "Twilio WhatsApp not configured — stub mode");
      return {
        success: true,
        stub: true,
        messageId: `stub_twilio_wa_${Date.now()}`,
        retryable: false,
      };
    }

    // Append STOP footer if not already present (compliance requirement)
    const STOP_FOOTER = "\n\nReply STOP to unsubscribe.";
    const rawText = input.textBody ?? "";
    const finalBody = rawText.toUpperCase().includes("STOP") ? rawText : `${rawText}${STOP_FOOTER}`;

    const params: Record<string, string> = {
      To: `whatsapp:${e164}`,
      From: from,
      Body: finalBody,
    };
    if (input.templateSid) {
      params["ContentSid"] = input.templateSid;
    }

    let publicOrigin = process.env.APP_URL?.trim() || "";
    if (!publicOrigin) {
      try {
        publicOrigin = getPublicOrigin() || "";
      } catch {
        publicOrigin = "";
      }
    }
    publicOrigin = publicOrigin.replace(/\/+$/, "");
    if (publicOrigin.startsWith("http")) {
      params["StatusCallback"] = `${publicOrigin}/webhooks/comm-delivery`;
    }

    const authHeader = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(10_000),
      });

      let responseData: any;
      try {
        responseData = await res.json();
      } catch {
        responseData = null;
      }

      if (!res.ok) {
        const errorMessage = responseData?.message ?? responseData?.error_message ?? `Twilio API HTTP ${res.status}`;
        const isRetryable = res.status >= 500 || res.status === 429;

        logger.error(
          { to: maskedTo, status: res.status, error: errorMessage, retryable: isRetryable },
          "Twilio WhatsApp send failed",
        );

        return {
          success: false,
          statusCode: res.status,
          error: errorMessage,
          retryable: isRetryable,
          rawResponse: responseData,
        };
      }

      const messageId = responseData?.sid ?? `twilio_${Date.now()}`;
      logger.info({ to: maskedTo, messageId }, "Twilio WhatsApp sent successfully");

      return {
        success: true,
        messageId,
        retryable: false,
        rawResponse: responseData,
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      const errorMessage = err instanceof Error ? err.message : "Twilio network exception";

      logger.error({ to: maskedTo, err: errorMessage, isTimeout }, "Twilio WhatsApp dispatch exception");

      return {
        success: false,
        error: isTimeout ? "Provider network timeout" : errorMessage,
        retryable: true,
      };
    }
  }

  /**
   * Normalise Twilio webhook payloads (both inbound messages and delivery status callbacks).
   */
  public normalizeWebhookPayload(body: any): {
    statuses: NormalizedDeliveryReceipt[];
    messages: NormalizedInboundMessage[];
  } {
    const statuses: NormalizedDeliveryReceipt[] = [];
    const messages: NormalizedInboundMessage[] = [];

    if (!body || typeof body !== "object") return { statuses, messages };

    const b = body as Record<string, string>;

    // 1. Delivery Receipt
    const status = b.MessageStatus ?? b.SmsStatus;
    const sid = b.MessageSid ?? b.SmsSid;
    if (status && sid) {
      const statusMap: Record<string, "sent" | "delivered" | "read" | "failed"> = {
        queued: "sent",
        sent: "sent",
        delivered: "delivered",
        read: "read",
        failed: "failed",
        undelivered: "failed",
      };
      statuses.push({
        providerMessageId: sid,
        status: statusMap[status.toLowerCase()] ?? "failed",
        recipientId: (b.To ?? "").replace(/^whatsapp:/i, "").replace(/^\+/, ""),
        timestamp: new Date(),
        errorCode: b.ErrorCode ? parseInt(b.ErrorCode, 10) : undefined,
        errorMessage: b.ErrorMessage,
      });
      return { statuses, messages };
    }

    // 2. Inbound Message
    const from = b.From ?? b.from;
    const text = (b.Body ?? b.body ?? "").trim();
    if (from) {
      messages.push({
        from: from.replace(/^whatsapp:/i, "").replace(/^\+/, ""),
        messageId: sid ?? `twilio_inbound_${Date.now()}`,
        timestamp: new Date(),
        type: "text",
        text,
        raw: b,
      });
    }

    return { statuses, messages };
  }
}

export const twilioWhatsAppProvider = new TwilioWhatsAppProvider();
