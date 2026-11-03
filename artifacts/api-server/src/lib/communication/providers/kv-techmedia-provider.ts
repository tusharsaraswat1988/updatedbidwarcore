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
   * Also accepts verifyToken passed via query param or headers (standard for KV TechMedia custom webhook portals).
   */
  public verifyWebhookSignature(req: Request): boolean {
    const isTestEnv = process.env.NODE_ENV === "test";
    const allowInsecureTest =
      process.env.BIDWAR_ALLOW_INSECURE_TEST_WEBHOOK === "true";

    if (isTestEnv && allowInsecureTest) {
      return true;
    }

    const secret = this.config.appSecret ?? process.env.KV_META_APP_SECRET;
    const verifyToken = this.config.verifyToken ?? process.env.KV_WEBHOOK_VERIFY_TOKEN;

    // 1. Accept token in query param or header (standard for KV TechMedia webhook portals)
    const suppliedToken = (
      req.query?.["token"] ||
      req.query?.["verify_token"] ||
      req.headers?.["x-verify-token"] ||
      req.headers?.["authorization"]
    ) as string | undefined;

    if (verifyToken && suppliedToken) {
      const cleanToken = suppliedToken.replace(/^Bearer\s+/i, "").trim();
      if (cleanToken === verifyToken.trim()) {
        return true;
      }
      logger.warn("Webhook token validation failed: Invalid token provided");
      return false;
    }

    // 2. Accept HMAC-SHA256 signature in X-Hub-Signature-256 header (Meta Cloud API standard)
    const sigHeader = (
      req.headers["x-hub-signature-256"] as string | undefined
    )?.trim();

    if (sigHeader) {
      if (!secret || secret.trim() === "") {
        logger.error(
          "Webhook signature validation failed: KV_META_APP_SECRET missing (failing closed)",
        );
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

    // 3. Fallback when neither token nor signature header is present
    const isProduction = process.env.NODE_ENV === "production";
    const enforceAuth = process.env.KV_WEBHOOK_ENFORCE_AUTH === "true";

    if (isProduction && enforceAuth) {
      logger.error("Webhook rejected: Missing both signature header and verify token in production (enforceAuth=true)");
      return false;
    }

    // In production without enforceAuth, or in development/staging:
    // Allow webhook delivery from KVtMedia portal with audit warning so valid delivery reports are not dropped
    if (isProduction) {
      logger.warn("Webhook received without X-Hub-Signature-256 header or query token; proceeding with unverified webhook");
    }
    return true;
  }

  /**
   * Verify GET challenge handshake for Meta / KV TechMedia webhook registration.
   * Supports both Meta standard (hub.mode=subscribe&hub.challenge=...) and
   * KVtMedia custom webhook challenge query (req.query['challange'] or req.query['challenge'])
   * as specified in KVtMedia official user documentation.
   */
  public verifyWebhookChallenge(req: Request): {
    isValid: boolean;
    challenge?: string;
  } {
    const mode = req.query["hub.mode"];
    const token =
      req.query["hub.verify_token"] ||
      req.query["verify_token"] ||
      req.query["token"];
    // Note: KVtMedia documentation explicitly documents query parameter 'challange' (with an 'a'),
    // while standard Meta uses 'hub.challenge' and standard English is 'challenge'.
    const hubChallenge = req.query["hub.challenge"];
    const kvChallenge = req.query["challange"] || req.query["challenge"];
    const challenge = kvChallenge || hubChallenge;

    const expectedToken =
      this.config.verifyToken ?? process.env.KV_WEBHOOK_VERIFY_TOKEN;

    // 1. Meta standard challenge verification (hub.mode=subscribe)
    if (mode === "subscribe" || hubChallenge) {
      if (!expectedToken || expectedToken.trim() === "") {
        logger.error(
          "Webhook challenge verification failed: KV_WEBHOOK_VERIFY_TOKEN missing",
        );
        return { isValid: false };
      }
      if (mode === "subscribe" && token === expectedToken && hubChallenge) {
        return { isValid: true, challenge: String(hubChallenge) };
      }
      return { isValid: false };
    }

    // 2. KVtMedia custom webhook challenge verification (as specified in KVtMedia official docs:
    // "Make sure your server URL responds with the challenge query, otherwise verification will fail")
    if (kvChallenge) {
      if (token && expectedToken && token !== expectedToken) {
        logger.warn(
          "Webhook challenge rejected: provided token did not match KV_WEBHOOK_VERIFY_TOKEN",
        );
        return { isValid: false };
      }
      return { isValid: true, challenge: String(kvChallenge) };
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
    const errorCode = typeof metaError === "object" ? metaError?.code : undefined;
    const errorString =
      typeof metaError === "string"
        ? metaError
        : metaError?.message ?? errorPayload?.message;
    const errorMessage = errorString ?? `HTTP ${statusCode}`;

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

    // Explicit authentication errors (HTTP 401, Meta code 190, or BSP token invalidated string)
    if (
      statusCode === 401 ||
      errorCode === 190 ||
      (errorString && /token.*invalid|unauthoriz/i.test(errorString))
    ) {
      return {
        retryable: false,
        message: `Authentication token invalid/expired: ${errorMessage}`,
      };
    }

    // Explicit non-retryable Meta client errors
    // 131026: Receiver is incapable of receiving this message (not on WhatsApp)
    // 132000: Template param count mismatch or template not approved
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
   * Handles nested Meta format, top-level arrays, flat BSP objects, and custom envelopes.
   */
  public normalizeWebhookPayload(body: any): {
    statuses: NormalizedDeliveryStatus[];
    messages: NormalizedInboundMessage[];
  } {
    const statuses: NormalizedDeliveryStatus[] = [];
    const messages: NormalizedInboundMessage[] = [];

    if (!body || typeof body !== "object") return { statuses, messages };

    // Support top-level array: [ { id, status }, ... ] as well as single object
    const payloadItems = Array.isArray(body) ? body : [body];
    for (const item of payloadItems) {
      if (!item || typeof item !== "object") continue;

      const entries = Array.isArray(item.entry) ? item.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          // Extract delivery receipts
          if (Array.isArray(value.statuses)) {
            for (const s of value.statuses) {
              const msgId = s.id ?? s.message_id ?? s.wamid;
              if (!msgId || !s.status) continue;
              const mappedStatus =
                s.status === "sent"
                  ? "sent"
                  : s.status === "delivered"
                    ? "delivered"
                    : s.status === "read"
                      ? "read"
                      : "failed";

              const timestamp = s.timestamp
                ? (typeof s.timestamp === "number" || /^\d+$/.test(String(s.timestamp))
                    ? new Date(parseInt(String(s.timestamp), 10) * 1000)
                    : new Date(s.timestamp))
                : new Date();

              statuses.push({
                providerMessageId: msgId,
                status: mappedStatus,
                recipientId: s.recipient_id ?? s.to ?? s.recipient ?? "",
                timestamp,
                errorCode: s.errors?.[0]?.code ?? s.code,
                errorMessage: s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? s.error ?? s.message,
              });
            }
          }

          // Extract inbound messages
          if (Array.isArray(value.messages)) {
            for (const m of value.messages) {
              const msgId = m.id ?? m.message_id;
              const from = m.from ?? m.sender;
              if (!msgId || !from) continue;
              const timestamp = m.timestamp
                ? (typeof m.timestamp === "number" || /^\d+$/.test(String(m.timestamp))
                    ? new Date(parseInt(String(m.timestamp), 10) * 1000)
                    : new Date(m.timestamp))
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
                from,
                messageId: msgId,
                timestamp,
                type: m.type ?? "text",
                text: textContent,
                raw: m,
              });
            }
          }
        }
      }

      // Support direct / flat statuses payloads from BSP portals (KVtMedia custom webhooks)
      const rawStatuses = Array.isArray(item.statuses)
        ? item.statuses
        : (item.id || item.message_id || item.wamid) && (item.status || item.event)
          ? [item]
          : item.data && (item.data.id || item.data.message_id || item.data.wamid) && (item.data.status || item.event)
            ? [{ ...item.data, status: item.data.status || item.event }]
            : [];

      for (const s of rawStatuses) {
        const msgId = s.id ?? s.message_id ?? s.wamid;
        const rawStatus = String(s.status ?? s.event ?? "").toLowerCase().trim();
        if (!msgId || !rawStatus) continue;

        const mappedStatus =
          rawStatus === "sent"
            ? "sent"
            : rawStatus === "delivered"
              ? "delivered"
              : rawStatus === "read"
                ? "read"
                : "failed";

        const timestamp = s.timestamp
          ? (typeof s.timestamp === "number" || /^\d+$/.test(String(s.timestamp))
              ? new Date(parseInt(String(s.timestamp), 10) * 1000)
              : new Date(s.timestamp))
          : new Date();

        statuses.push({
          providerMessageId: msgId,
          status: mappedStatus,
          recipientId: s.recipient_id ?? s.to ?? s.recipient ?? "",
          timestamp,
          errorCode: s.errors?.[0]?.code ?? s.code,
          errorMessage: s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? s.error ?? s.message,
        });
      }

      // Check flat inbound messages from BSP portals
      if (item.from && (item.text || item.body || item.message) && (item.id || item.message_id)) {
        const msgId = item.id ?? item.message_id;
        const from = item.from;
        const text = typeof item.text === "string" ? item.text : item.text?.body ?? item.body ?? item.message ?? "";
        messages.push({
          from,
          messageId: msgId,
          timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
          type: item.type ?? "text",
          text,
          raw: item,
        });
      }
    }

    return { statuses, messages };
  }
}

export const kvTechMediaProvider = new KVTechMediaProvider();
