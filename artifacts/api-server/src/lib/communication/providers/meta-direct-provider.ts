import crypto from "crypto";
import type { Request } from "express";
import { logger, maskPhoneNumber } from "../../logger";
import type {
  IWhatsAppProvider,
  WhatsAppSendInput,
  ProviderSendResult,
  NormalizedDeliveryReceipt,
  NormalizedInboundMessage,
} from "./types";

export interface MetaDirectConfig {
  apiVersion?: string;
  phoneNumberId?: string;
  accessToken?: string;
  appSecret?: string;
  verifyToken?: string;
}

export class MetaDirectProvider implements IWhatsAppProvider {
  public readonly providerId = "meta_direct" as const;
  private config: MetaDirectConfig;

  constructor(customConfig?: Partial<MetaDirectConfig>) {
    this.config = {
      apiVersion: (
        customConfig?.apiVersion ??
        process.env.META_WA_API_VERSION ??
        "v19.0"
      ).replace(/^\/+/, ""),
      phoneNumberId:
        customConfig?.phoneNumberId ??
        process.env.META_DIRECT_PHONE_NUMBER_ID ??
        process.env.META_WA_PHONE_NUMBER_ID ??
        process.env.META_PHONE_NUMBER_ID,
      accessToken:
        customConfig?.accessToken ??
        process.env.META_DIRECT_ACCESS_TOKEN ??
        process.env.META_WA_ACCESS_TOKEN ??
        process.env.META_ACCESS_TOKEN,
      appSecret:
        customConfig?.appSecret ??
        process.env.META_DIRECT_APP_SECRET ??
        process.env.META_WA_APP_SECRET ??
        process.env.META_APP_SECRET,
      verifyToken:
        customConfig?.verifyToken ??
        process.env.META_DIRECT_VERIFY_TOKEN ??
        process.env.META_WA_VERIFY_TOKEN ??
        process.env.META_VERIFY_TOKEN,
    };
  }

  /**
   * Normalise phone number to 12-digit Indian MSISDN without '+' or 'whatsapp:' prefix
   */
  public normalizeMsisdn(mobile: string): string {
    const digits = mobile.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) return digits;
    if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  /**
   * Validate required environment configuration for Direct Meta Cloud API.
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const isProduction = process.env.NODE_ENV === "production";
    const phoneId =
      this.config.phoneNumberId ??
      process.env.META_DIRECT_PHONE_NUMBER_ID ??
      process.env.META_WA_PHONE_NUMBER_ID ??
      process.env.META_PHONE_NUMBER_ID;
    const token =
      this.config.accessToken ??
      process.env.META_DIRECT_ACCESS_TOKEN ??
      process.env.META_WA_ACCESS_TOKEN ??
      process.env.META_ACCESS_TOKEN;
    const appSecret =
      this.config.appSecret ??
      process.env.META_DIRECT_APP_SECRET ??
      process.env.META_WA_APP_SECRET ??
      process.env.META_APP_SECRET;
    const verifyToken =
      this.config.verifyToken ??
      process.env.META_DIRECT_VERIFY_TOKEN ??
      process.env.META_WA_VERIFY_TOKEN ??
      process.env.META_VERIFY_TOKEN;

    if (!phoneId || phoneId.trim() === "") {
      errors.push("META_DIRECT_PHONE_NUMBER_ID (or META_WA_PHONE_NUMBER_ID) is missing");
    }
    if (!token || token.trim() === "") {
      errors.push("META_DIRECT_ACCESS_TOKEN (or META_WA_ACCESS_TOKEN) is missing");
    }
    if (isProduction && (!appSecret || appSecret.trim() === "")) {
      errors.push("META_DIRECT_APP_SECRET (or META_WA_APP_SECRET) is required in production for secure webhook verification");
    }
    if (isProduction && (!verifyToken || verifyToken.trim() === "")) {
      errors.push("META_DIRECT_VERIFY_TOKEN (or META_WA_VERIFY_TOKEN) is required in production for webhook verification challenge");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate webhook X-Hub-Signature-256 using constant-time comparison.
   * Fails closed in production if appSecret is missing.
   */
  public verifyWebhookSignature(req: Request): boolean {
    const isTestEnv = process.env.NODE_ENV === "test";
    const allowInsecureTest = process.env.BIDWAR_ALLOW_INSECURE_TEST_WEBHOOK === "true";

    if (isTestEnv && allowInsecureTest) {
      return true;
    }

    const secret = this.config.appSecret ?? process.env.META_DIRECT_APP_SECRET ?? process.env.META_WA_APP_SECRET ?? process.env.META_APP_SECRET;
    if (!secret || secret.trim() === "") {
      logger.error("Meta Direct webhook rejected: App Secret missing (failing closed)");
      return false;
    }

    const sigHeader = (req.headers["x-hub-signature-256"] as string | undefined)?.trim();
    if (!sigHeader) {
      logger.warn("Meta Direct webhook rejected: Missing X-Hub-Signature-256 header");
      return false;
    }

    if (!sigHeader.startsWith("sha256=")) {
      logger.warn("Meta Direct webhook rejected: Header does not start with sha256=");
      return false;
    }

    const suppliedHex = sigHeader.slice(7).trim();
    if (!/^[0-9a-fA-F]{64}$/.test(suppliedHex)) {
      logger.warn("Meta Direct webhook rejected: Invalid hex signature format");
      return false;
    }

    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      logger.error("Meta Direct webhook rejected: Missing rawBody Buffer in request");
      return false;
    }

    try {
      const suppliedBuffer = Buffer.from(suppliedHex, "hex");
      const expectedBuffer = crypto.createHmac("sha256", secret).update(rawBody).digest();

      if (suppliedBuffer.length !== expectedBuffer.length || expectedBuffer.length !== 32) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
    } catch (err) {
      logger.error({ err }, "Exception in Meta Direct webhook timingSafeEqual comparison");
      return false;
    }
  }

  /**
   * Verify GET challenge handshake for Meta Cloud API webhook subscription.
   */
  public verifyWebhookChallenge(req: Request): {
    isValid: boolean;
    challenge?: string;
  } {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const expectedToken = this.config.verifyToken ?? process.env.META_DIRECT_VERIFY_TOKEN ?? process.env.META_WA_VERIFY_TOKEN ?? process.env.META_VERIFY_TOKEN;
    if (!expectedToken || expectedToken.trim() === "") {
      logger.error("Meta Direct webhook challenge verification failed: Verify Token missing");
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
    const errorMessage = metaError?.message ?? errorPayload?.message ?? `HTTP ${statusCode}`;

    // Rate limits (429 or Meta rate limit error codes: 4, 80007, 130429)
    if (statusCode === 429 || errorCode === 4 || errorCode === 80007 || errorCode === 130429) {
      return { retryable: true, message: `Rate limited: ${errorMessage}` };
    }

    // 5xx Server errors
    if (statusCode >= 500) {
      return { retryable: true, message: `Meta server error: ${errorMessage}` };
    }

    // Explicit non-retryable client errors
    if (errorCode === 131026) {
      return { retryable: false, message: `Recipient not on WhatsApp (131026): ${errorMessage}` };
    }
    if (errorCode === 132000) {
      return { retryable: false, message: `Template parameter error (132000): ${errorMessage}` };
    }
    if (errorCode === 190) {
      return { retryable: false, message: `Authentication token invalid/expired (190): ${errorMessage}` };
    }

    return { retryable: false, message: errorMessage };
  }

  /**
   * Send WhatsApp message via native Meta Graph API.
   */
  public async send(input: WhatsAppSendInput): Promise<ProviderSendResult> {
    const phoneNumberId = this.config.phoneNumberId;
    const accessToken = this.config.accessToken;
    const isProduction = process.env.NODE_ENV === "production";
    const toMsisdn = this.normalizeMsisdn(input.to);

    if (!phoneNumberId || !accessToken) {
      if (isProduction) {
        logger.error({ to: maskPhoneNumber(toMsisdn) }, "Meta Direct credentials missing in production");
        return {
          success: false,
          retryable: false,
          error: "Meta Direct WhatsApp provider credentials not configured",
        };
      }
      logger.warn({ to: maskPhoneNumber(toMsisdn) }, "Meta Direct credentials missing — stub mode");
      return {
        success: true,
        stub: true,
        messageId: `stub_meta_direct_${Date.now()}`,
        retryable: false,
      };
    }

    const url = `https://graph.facebook.com/${this.config.apiVersion}/${phoneNumberId}/messages`;

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
      const STOP_FOOTER = "\n\nReply STOP to unsubscribe.";
      const rawText = input.textBody ?? "";
      const finalBody = rawText.toUpperCase().includes("STOP") ? rawText : `${rawText}${STOP_FOOTER}`;

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
        const { retryable, message } = this.classifyError(res.status, responseData);
        logger.error(
          { to: maskPhoneNumber(toMsisdn), status: res.status, retryable, error: message },
          "Meta Direct WhatsApp send failed",
        );
        return {
          success: false,
          statusCode: res.status,
          error: message,
          retryable,
          rawResponse: responseData,
        };
      }

      const messageId = responseData?.messages?.[0]?.id ?? `meta_accepted_${Date.now()}`;
      logger.info({ to: maskPhoneNumber(toMsisdn), messageId }, "Meta Direct WhatsApp sent successfully");

      return {
        success: true,
        messageId,
        retryable: false,
        rawResponse: responseData,
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      const errorMessage = err instanceof Error ? err.message : "Unknown network exception";

      logger.error(
        { to: maskPhoneNumber(toMsisdn), err: errorMessage, isTimeout },
        "Meta Direct WhatsApp dispatch network exception",
      );

      return {
        success: false,
        error: isTimeout ? "Provider network timeout" : errorMessage,
        retryable: true,
      };
    }
  }

  /**
   * Normalize an incoming webhook payload from Meta Cloud API.
   */
  public normalizeWebhookPayload(body: any): {
    statuses: NormalizedDeliveryReceipt[];
    messages: NormalizedInboundMessage[];
  } {
    const statuses: NormalizedDeliveryReceipt[] = [];
    const messages: NormalizedInboundMessage[] = [];

    if (!body || typeof body !== "object") return { statuses, messages };

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Delivery receipts
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
              errorMessage: s.errors?.[0]?.title ?? s.errors?.[0]?.message,
            });
          }
        }

        // Inbound messages
        if (Array.isArray(value.messages)) {
          for (const m of value.messages) {
            if (!m.id || !m.from) continue;
            const timestamp = m.timestamp
              ? new Date(parseInt(m.timestamp, 10) * 1000)
              : new Date();

            let text: string | undefined;
            if (m.type === "text" && m.text?.body) {
              text = m.text.body;
            } else if (m.type === "button" && m.button?.text) {
              text = m.button.text;
            } else if (m.type === "interactive") {
              text =
                m.interactive?.button_reply?.title ??
                m.interactive?.list_reply?.title;
            }

            messages.push({
              from: this.normalizeMsisdn(m.from),
              messageId: m.id,
              timestamp,
              type: m.type ?? "unknown",
              text,
              raw: m,
            });
          }
        }
      }
    }

    return { statuses, messages };
  }
}

export const metaDirectProvider = new MetaDirectProvider();
