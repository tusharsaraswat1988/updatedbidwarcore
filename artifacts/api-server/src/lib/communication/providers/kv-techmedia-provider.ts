import crypto from "crypto";
import type { Request } from "express";
import { logger, maskPhoneNumber } from "../../logger";
import type { IWhatsAppProvider } from "./types";

export interface KVTechMediaConfig {
  baseUrl: string;
  apiVersion: string;
  phoneNumberId?: string;
  accessToken?: string;
  appSecret?: string;
  verifyToken?: string;
}

export interface SendWhatsAppInput {
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

export interface NormalizedDeliveryStatus {
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

export class KVTechMediaProvider implements IWhatsAppProvider {
  private config: KVTechMediaConfig;

  public readonly providerId = "kv_techmedia" as const;

  /**
   * Validate required environment configuration for KV TechMedia.
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const isProduction = process.env.NODE_ENV === "production";
    const phoneId = this.config.phoneNumberId ?? process.env.KV_META_PHONE_NUMBER_ID;
    const token = this.config.accessToken ?? process.env.KV_META_ACCESS_TOKEN;
    const appSecret = this.config.appSecret ?? process.env.KV_META_APP_SECRET;
    const verifyToken = this.config.verifyToken ?? process.env.KV_WEBHOOK_VERIFY_TOKEN;

    if (!phoneId || phoneId.trim() === "") {
      errors.push("KV_META_PHONE_NUMBER_ID is missing");
    }
    if (!token || token.trim() === "") {
      errors.push("KV_META_ACCESS_TOKEN is missing");
    }
    if (isProduction && (!appSecret || appSecret.trim() === "")) {
      errors.push("KV_META_APP_SECRET is required in production for secure webhook verification");
    }
    if (isProduction && (!verifyToken || verifyToken.trim() === "")) {
      errors.push("KV_WEBHOOK_VERIFY_TOKEN is required in production for webhook verification challenge");
    }

    return { valid: errors.length === 0, errors };
  }

  constructor(customConfig?: Partial<KVTechMediaConfig>) {
    this.config = {
      baseUrl: (
        customConfig?.baseUrl ??
        process.env.KV_META_BASE_URL ??
        "https://crmapi.kvtmedia.com/api/meta"
      ).replace(/\/+$/, ""),
      apiVersion: (
        customConfig?.apiVersion ??
        process.env.KV_META_API_VERSION ??
        "v19.0"
      ).replace(/^\/+/, ""),
      phoneNumberId:
        customConfig?.phoneNumberId ?? process.env.KV_META_PHONE_NUMBER_ID,
      accessToken:
        customConfig?.accessToken ?? process.env.KV_META_ACCESS_TOKEN,
      appSecret: customConfig?.appSecret ?? process.env.KV_META_APP_SECRET,
      verifyToken:
        customConfig?.verifyToken ?? process.env.KV_WEBHOOK_VERIFY_TOKEN,
    };
  }

  /** Normalise phone number to 12-digit Indian MSISDN without '+' or 'whatsapp:' prefix */
  public normalizeMsisdn(mobile: string): string {
    const digits = mobile.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) return digits;
    if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  /**
   * Validate webhook X-Hub-Signature-256 using constant-time comparison.
   * Fails closed in production if appSecret is missing.
   */
  public verifyWebhookSignature(req: Request): boolean {
    const isTestEnv = process.env.NODE_ENV === "test";
    const allowInsecureTest =
      process.env.BIDWAR_ALLOW_INSECURE_TEST_WEBHOOK === "true";

    if (isTestEnv && allowInsecureTest) {
      return true;
    }

    const secret = this.config.appSecret ?? process.env.KV_META_APP_SECRET;
    if (!secret || secret.trim() === "") {
      logger.error(
        "Webhook signature validation failed: KV_META_APP_SECRET missing (failing closed)",
      );
      return false;
    }

    const sigHeader = (
      req.headers["x-hub-signature-256"] as string | undefined
    )?.trim();
    if (!sigHeader) {
      logger.warn("Webhook signature validation failed: Missing X-Hub-Signature-256 header");
      return false;
    }

    if (!sigHeader.startsWith("sha256=")) {
      logger.warn("Webhook signature validation failed: Header does not start with sha256=");
      return false;
    }

    const suppliedHex = sigHeader.slice(7).trim();
    // 64 hex characters correspond to exactly 32 bytes for SHA-256
    if (!/^[0-9a-fA-F]{64}$/.test(suppliedHex)) {
      logger.warn("Webhook signature validation failed: Invalid hex signature length/format");
      return false;
    }

    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      logger.error("Webhook signature validation failed: Missing rawBody Buffer in request");
      return false;
    }

    try {
      const suppliedBuffer = Buffer.from(suppliedHex, "hex");
      const expectedBuffer = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest();

      if (
        suppliedBuffer.length !== expectedBuffer.length ||
        expectedBuffer.length !== 32
      ) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
    } catch (err) {
      logger.error({ err }, "Exception in webhook timingSafeEqual comparison");
      return false;
    }
  }

  /**
   * Verify GET challenge handshake for Meta / KV TechMedia webhook registration.
   */
  public verifyWebhookChallenge(req: Request): {
    isValid: boolean;
    challenge?: string;
  } {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const expectedToken =
      this.config.verifyToken ?? process.env.KV_WEBHOOK_VERIFY_TOKEN;

    if (!expectedToken || expectedToken.trim() === "") {
      logger.error(
        "Webhook challenge verification failed: KV_WEBHOOK_VERIFY_TOKEN missing",
      );
      return { isValid: false };
    }

    if (mode === "subscribe" && token === expectedToken && challenge) {
      return { isValid: true, challenge: String(challenge) };
    }

    return { isValid: false };
  }

  /**
   * Classify an HTTP response / Meta error object into retryable vs non-retryable.
   */
  public classifyError(
    statusCode: number,
    errorPayload?: any,
  ): { retryable: boolean; message: string } {
    const metaError = errorPayload?.error;
    const errorCode = metaError?.code;
    const errorMessage =
      metaError?.message ?? errorPayload?.message ?? `HTTP ${statusCode}`;

    // Rate limits (429 or Meta rate limit error codes: 4, 80007, 130429)
    if (
      statusCode === 429 ||
      errorCode === 4 ||
      errorCode === 80007 ||
      errorCode === 130429
    ) {
      return { retryable: true, message: `Rate limited: ${errorMessage}` };
    }

    // 5xx Server errors (KV TechMedia or Meta downstream 500/502/503/504)
    if (statusCode >= 500) {
      return { retryable: true, message: `Gateway server error: ${errorMessage}` };
    }

    // Explicit non-retryable Meta client errors
    // 131026: Receiver is incapable of receiving this message (not on WhatsApp)
    // 132000: Template param count mismatch or template not approved
    // 190: Access token expired
    if (errorCode === 131026) {
      return {
        retryable: false,
        message: `Recipient not on WhatsApp (131026): ${errorMessage}`,
      };
    }
    if (errorCode === 132000) {
      return {
        retryable: false,
        message: `Template parameter error (132000): ${errorMessage}`,
      };
    }
    if (errorCode === 190) {
      return {
        retryable: false,
        message: `Authentication token invalid/expired (190): ${errorMessage}`,
      };
    }

    // Other 4xx client errors are non-retryable by default
    if (statusCode >= 400 && statusCode < 500) {
      return { retryable: false, message: errorMessage };
    }

    return { retryable: false, message: errorMessage };
  }

  /**
   * Send WhatsApp message via Meta v19.0 endpoint through KV TechMedia.
   */
  public async send(input: SendWhatsAppInput): Promise<ProviderSendResult> {
    const phoneNumberId =
      this.config.phoneNumberId ?? process.env.KV_META_PHONE_NUMBER_ID;
    const accessToken =
      this.config.accessToken ?? process.env.KV_META_ACCESS_TOKEN;
    const isProduction = process.env.NODE_ENV === "production";

    const toMsisdn = this.normalizeMsisdn(input.to);

    if (!phoneNumberId || !accessToken) {
      if (isProduction) {
        logger.error(
          { to: maskPhoneNumber(toMsisdn) },
          "KV TechMedia credentials missing in production environment",
        );
        return {
          success: false,
          retryable: false,
          error: "KV TechMedia provider credentials not configured",
        };
      }
      logger.warn(
        { to: maskPhoneNumber(toMsisdn) },
        "KV TechMedia credentials missing in non-production — returning stub result",
      );
      return {
        success: true,
        stub: true,
        messageId: `stub_kv_wa_${Date.now()}`,
        retryable: false,
      };
    }

    const url = `${this.config.baseUrl}/${this.config.apiVersion}/${phoneNumberId}/messages`;

    let payload: Record<string, unknown>;

    if (input.type === "template" && input.templateName) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toMsisdn,
        type: "template",
        template: {
          name: input.templateName,
          language: {
            code: input.templateLanguage ?? "en",
          },
          ...(input.templateComponents && input.templateComponents.length > 0
            ? { components: input.templateComponents }
            : {}),
        },
      };
    } else {
      // Freeform text message (requires active 24h conversation window)
      const STOP_FOOTER = "\n\nReply STOP to unsubscribe.";
      const rawText = input.textBody ?? "";
      const finalBody = rawText.toUpperCase().includes("STOP")
        ? rawText
        : `${rawText}${STOP_FOOTER}`;

      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toMsisdn,
        type: "text",
        text: {
          preview_url: input.previewUrl ?? false,
          body: finalBody,
        },
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      let responseData: any;
      try {
        responseData = await res.json();
      } catch {
        responseData = null;
      }

      if (!res.ok) {
        const { retryable, message } = this.classifyError(
          res.status,
          responseData,
        );
        logger.error(
          {
            to: maskPhoneNumber(toMsisdn),
            status: res.status,
            retryable,
            error: message,
          },
          "KV TechMedia WhatsApp send failed",
        );
        return {
          success: false,
          statusCode: res.status,
          error: message,
          retryable,
          rawResponse: responseData,
        };
      }

      const messageId = responseData?.messages?.[0]?.id;
      if (!messageId) {
        logger.warn(
          { to: maskPhoneNumber(toMsisdn), responseData },
          "KV TechMedia response missing messages[0].id",
        );
        return {
          success: true,
          messageId: `kv_accepted_${Date.now()}`,
          retryable: false,
          rawResponse: responseData,
        };
      }

      logger.info(
        { to: maskPhoneNumber(toMsisdn), messageId },
        "KV TechMedia WhatsApp sent successfully",
      );

      return {
        success: true,
        messageId,
        retryable: false,
        rawResponse: responseData,
      };
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");
      const errorMessage =
        err instanceof Error ? err.message : "Unknown network exception";

      logger.error(
        { to: maskPhoneNumber(toMsisdn), err: errorMessage, isTimeout },
        "KV TechMedia WhatsApp dispatch network exception",
      );

      return {
        success: false,
        error: isTimeout ? "Provider network timeout" : errorMessage,
        retryable: true, // Network timeouts or connection drops are retryable
      };
    }
  }

  /**
   * Normalize an incoming webhook payload from Meta / KV TechMedia.
   */
  public normalizeWebhookPayload(body: any): {
    statuses: NormalizedDeliveryStatus[];
    messages: NormalizedInboundMessage[];
  } {
    const statuses: NormalizedDeliveryStatus[] = [];
    const messages: NormalizedInboundMessage[] = [];

    if (!body || typeof body !== "object") return { statuses, messages };

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Extract delivery receipts
        if (Array.isArray(value.statuses)) {
          for (const s of value.statuses) {
            if (!s.id || !s.status) continue;
            const mappedStatus =
              s.status === "sent"
                ? "sent"
                : s.status === "delivered"
                  ? "delivered"
                  : s.status === "read"
                    ? "read"
                    : "failed";

            const timestamp = s.timestamp
              ? new Date(parseInt(s.timestamp, 10) * 1000)
              : new Date();

            statuses.push({
              providerMessageId: s.id,
              status: mappedStatus,
              recipientId: s.recipient_id ?? "",
              timestamp,
              errorCode: s.errors?.[0]?.code,
              errorMessage: s.errors?.[0]?.message ?? s.errors?.[0]?.title,
            });
          }
        }

        // Extract inbound messages
        if (Array.isArray(value.messages)) {
          for (const m of value.messages) {
            if (!m.id || !m.from) continue;
            const timestamp = m.timestamp
              ? new Date(parseInt(m.timestamp, 10) * 1000)
              : new Date();

            let textContent: string | undefined;
            if (m.type === "text" && m.text?.body) {
              textContent = m.text.body;
            } else if (m.type === "button" && m.button?.text) {
              textContent = m.button.text;
            } else if (
              m.type === "interactive" &&
              m.interactive?.button_reply?.title
            ) {
              textContent = m.interactive.button_reply.title;
            } else if (
              m.type === "interactive" &&
              m.interactive?.list_reply?.title
            ) {
              textContent = m.interactive.list_reply.title;
            }

            messages.push({
              from: m.from,
              messageId: m.id,
              timestamp,
              type: m.type ?? "unknown",
              text: textContent,
              raw: m,
            });
          }
        }
      }
    }

    return { statuses, messages };
  }
}

export const kvTechMediaProvider = new KVTechMediaProvider();
