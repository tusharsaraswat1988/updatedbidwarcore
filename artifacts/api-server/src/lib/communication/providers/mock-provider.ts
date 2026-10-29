import type { Request } from "express";
import type {
  IWhatsAppProvider,
  WhatsAppSendInput,
  ProviderSendResult,
  NormalizedDeliveryReceipt,
  NormalizedInboundMessage,
} from "./types";

export class MockWhatsAppProvider implements IWhatsAppProvider {
  public readonly providerId = "mock" as const;
  public sentMessages: WhatsAppSendInput[] = [];
  public customSignatureVerifier?: (req: Request) => boolean;

  public clearSentMessages(): void {
    this.sentMessages = [];
  }

  public getSentMessages(): WhatsAppSendInput[] {
    return [...this.sentMessages];
  }

  public validateConfig(): { valid: boolean; errors: string[] } {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_MOCK_COMM_IN_PROD !== "true"
    ) {
      return {
        valid: false,
        errors: [
          "WHATSAPP_PROVIDER='mock' is not allowed in production without explicit ALLOW_MOCK_COMM_IN_PROD=true",
        ],
      };
    }
    return { valid: true, errors: [] };
  }

  public async send(input: WhatsAppSendInput): Promise<ProviderSendResult> {
    this.sentMessages.push(input);
    return {
      success: true,
      stub: true,
      messageId: `mock_wa_${Date.now()}_${this.sentMessages.length}`,
      retryable: false,
    };
  }

  public verifyWebhookSignature(req: Request): boolean {
    if (this.customSignatureVerifier) {
      return this.customSignatureVerifier(req);
    }
    return true;
  }

  public verifyWebhookChallenge(req: Request): {
    isValid: boolean;
    challenge?: string;
  } {
    const challenge = req.query["hub.challenge"];
    return {
      isValid: true,
      challenge: challenge ? String(challenge) : "mock_challenge_ok",
    };
  }

  public normalizeWebhookPayload(body: any): {
    statuses: NormalizedDeliveryReceipt[];
    messages: NormalizedInboundMessage[];
  } {
    const statuses: NormalizedDeliveryReceipt[] = [];
    const messages: NormalizedInboundMessage[] = [];

    if (!body || typeof body !== "object") return { statuses, messages };

    // 1. Direct mock test format
    if (body.from && (body.text || body.message)) {
      messages.push({
        from: String(body.from).replace(/\D/g, ""),
        messageId: String(body.messageId ?? `mock_inbound_${Date.now()}`),
        timestamp: new Date(),
        type: "text",
        text: String(body.text ?? body.message ?? ""),
        raw: body,
      });
      return { statuses, messages };
    }

    // 2. Direct mock delivery receipt
    if (body.providerMessageId && body.status) {
      statuses.push({
        providerMessageId: String(body.providerMessageId),
        status: body.status,
        recipientId: String(body.recipientId ?? ""),
        timestamp: new Date(),
      });
      return { statuses, messages };
    }

    // 3. Meta payload format
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes ?? []) {
          const val = change.value ?? {};
          for (const s of val.statuses ?? []) {
            statuses.push({
              providerMessageId: s.id,
              status: s.status,
              recipientId: s.recipient_id ?? "",
              timestamp: new Date(),
            });
          }
          for (const m of val.messages ?? []) {
            messages.push({
              from: String(m.from).replace(/\D/g, ""),
              messageId: m.id,
              timestamp: new Date(),
              type: m.type ?? "text",
              text: m.text?.body,
              raw: m,
            });
          }
        }
      }
    }

    return { statuses, messages };
  }
}

export const mockWhatsAppProvider = new MockWhatsAppProvider();
