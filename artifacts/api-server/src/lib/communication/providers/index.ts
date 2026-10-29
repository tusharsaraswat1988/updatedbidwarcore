import { logger } from "../../logger";
import { KVTechMediaProvider, kvTechMediaProvider } from "./kv-techmedia-provider";
import { TwilioWhatsAppProvider, twilioWhatsAppProvider } from "./twilio-provider";
import { MetaDirectProvider, metaDirectProvider } from "./meta-direct-provider";
import { MockWhatsAppProvider, mockWhatsAppProvider } from "./mock-provider";
import type {
  IWhatsAppProvider,
  WhatsAppProviderId,
  ProviderValidationResult,
  WhatsAppSendInput,
  ProviderSendResult,
} from "./types";

export * from "./types";
export { KVTechMediaProvider, kvTechMediaProvider } from "./kv-techmedia-provider";
export { TwilioWhatsAppProvider, twilioWhatsAppProvider } from "./twilio-provider";
export { MetaDirectProvider, metaDirectProvider } from "./meta-direct-provider";
export { MockWhatsAppProvider, mockWhatsAppProvider } from "./mock-provider";

/**
 * Null provider used when no WhatsApp provider is configured.
 */
class NullWhatsAppProvider implements IWhatsAppProvider {
  public readonly providerId = "none" as const;

  public validateConfig(): { valid: boolean; errors: string[] } {
    return {
      valid: false,
      errors: ["No WhatsApp provider configured (WHATSAPP_PROVIDER is unset or none)"],
    };
  }

  public async send(input: WhatsAppSendInput): Promise<ProviderSendResult> {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      logger.error({ to: input.to }, "sendWhatsApp: No WhatsApp provider configured in production");
      return {
        success: false,
        error: "WhatsApp provider not configured",
        retryable: false,
      };
    }

    logger.warn({ to: input.to }, "sendWhatsApp: No WhatsApp provider configured — stub mode");
    return {
      success: true,
      stub: true,
      messageId: `stub_wa_${Date.now()}`,
      retryable: false,
    };
  }

  public verifyWebhookSignature(): boolean {
    return false;
  }

  public normalizeWebhookPayload() {
    return { statuses: [], messages: [] };
  }
}

export const nullWhatsAppProvider = new NullWhatsAppProvider();

/**
 * Resolve the active WhatsApp provider ID solely from the WHATSAPP_PROVIDER environment variable.
 * No UI selection, no database selection, and NO automatic credential-based detection.
 */
export function resolveWhatsAppProviderId(): WhatsAppProviderId {
  const raw = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase().trim();
  if (raw === "kv_techmedia" || raw === "kvtmedia" || raw === "kv") {
    return "kv_techmedia";
  }
  if (raw === "twilio") {
    return "twilio";
  }
  if (raw === "meta_direct" || raw === "meta" || raw === "meta_cloud") {
    return "meta_direct";
  }
  if (raw === "mock") {
    return "mock";
  }
  return "none";
}

/**
 * Get the provider instance for a specific provider identifier.
 */
export function getWhatsAppProvider(id: WhatsAppProviderId): IWhatsAppProvider {
  switch (id) {
    case "kv_techmedia":
      return kvTechMediaProvider;
    case "twilio":
      return twilioWhatsAppProvider;
    case "meta_direct":
      return metaDirectProvider;
    case "mock":
      return mockWhatsAppProvider;
    default:
      return nullWhatsAppProvider;
  }
}

/**
 * Get the active WhatsApp provider instance configured for this application process.
 */
export function getActiveWhatsAppProvider(): IWhatsAppProvider {
  const id = resolveWhatsAppProviderId();
  if (id === "none") {
    if (process.env.NODE_ENV === "test") {
      return mockWhatsAppProvider;
    }
    return nullWhatsAppProvider;
  }
  return getWhatsAppProvider(id);
}

/**
 * Validate the active WhatsApp provider configuration at application startup.
 * - In production: fails validation if WHATSAPP_PROVIDER is missing or credentials are incomplete.
 * - In non-production: reports warnings if unconfigured, allowing stub mode.
 * - NEVER makes live network calls to providers during validation.
 * - NEVER logs unmasked secrets.
 */
export function validateWhatsAppProviderAtStartup(): ProviderValidationResult {
  const raw = (process.env.WHATSAPP_PROVIDER ?? "").trim();
  const id = resolveWhatsAppProviderId();
  const isProduction = process.env.NODE_ENV === "production";

  if (!raw || id === "none") {
    if (isProduction) {
      return {
        valid: false,
        provider: "none",
        errors: [
          "WHATSAPP_PROVIDER is not set or empty in production. Must be one of: 'kv_techmedia', 'twilio', 'meta_direct'.",
        ],
      };
    }
    return {
      valid: true,
      provider: "none",
      errors: ["WHATSAPP_PROVIDER is unset in non-production. WhatsApp features will operate in stub/disabled mode."],
    };
  }

  const provider = getWhatsAppProvider(id);
  const configValidation = provider.validateConfig();

  return {
    valid: configValidation.valid,
    provider: id,
    errors: configValidation.errors,
  };
}
