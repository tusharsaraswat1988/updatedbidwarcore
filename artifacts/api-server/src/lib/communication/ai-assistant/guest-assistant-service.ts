/**
 * BidWar WhatsApp Gemini Assistant Orchestrator
 *
 * Coordinates session memory, prompt assembly, Google Gemini generation,
 * guardrail enforcement, lead capture, and support escalation for guests,
 * trial organizers, and licensed tournament organizers.
 */

import { GoogleGenAI } from "@google/genai";
import { logger, maskPhoneNumber } from "../../logger";
import {
  buildAssistantSystemPrompt,
  buildSystemPrompt,
  SUPPORT_CONTACT,
  type AssistantUserContext,
} from "./knowledgebase";
import { guardrails } from "./guardrails";
import { sessionManager, type GuestChatMessage } from "./session-manager";
import { leadCaptureService } from "./lead-capture-service";
import { humanHandoff } from "./human-handoff";

export interface GuestAssistantInput {
  mobile: string;
  from: string;
  text: string;
  messageId?: string;
  ip?: string | null;
  userContext?: AssistantUserContext;
}

export interface GuestAssistantResponse {
  text: string;
  leadCaptured?: boolean;
  handedOff?: boolean;
  rateLimited?: boolean;
}

const HOURLY_RATE_LIMIT = 20; // Max 20 requests per hour per phone
const requestTimestamps = new Map<string, number[]>();

export class GuestAssistantService {
  /**
   * Instantiate or retrieve GoogleGenAI client.
   * Can be overridden or spied on in tests.
   */
  public getGenAIClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Check if the AI Assistant is enabled via environment variables.
   */
  public isEnabled(): boolean {
    return process.env.AI_ASSISTANT_ENABLED !== "false";
  }

  /**
   * In-memory sliding window rate limiter per mobile phone number.
   */
  public checkRateLimit(mobile: string): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let timestamps = requestTimestamps.get(mobile) || [];
    timestamps = timestamps.filter((t) => t > oneHourAgo);

    if (timestamps.length >= HOURLY_RATE_LIMIT) {
      requestTimestamps.set(mobile, timestamps);
      return false; // Rate limit exceeded
    }

    timestamps.push(now);
    requestTimestamps.set(mobile, timestamps);
    return true;
  }

  /**
   * Reset rate limit (primarily for testing purposes).
   */
  public resetRateLimit(mobile?: string): void {
    if (mobile) {
      requestTimestamps.delete(mobile);
    } else {
      requestTimestamps.clear();
    }
  }

  /**
   * Primary entry point for processing incoming WhatsApp messages through Gemini.
   */
  public async handleMessage(input: GuestAssistantInput): Promise<GuestAssistantResponse> {
    const { mobile, text } = input;
    const cleanText = text.trim();

    logger.info(
      { mobile: maskPhoneNumber(mobile), length: cleanText.length, userCategory: input.userContext?.userCategory },
      "GuestAssistantService: Processing incoming WhatsApp message"
    );

    // 1. Sliding window rate limit check
    if (!this.checkRateLimit(mobile)) {
      logger.warn(
        { mobile: maskPhoneNumber(mobile) },
        "GuestAssistantService: Rate limit exceeded for mobile"
      );
      return {
        text: `Aapne thode samay mein bohot saare messages bheje hain. Kripya 1 ghante baad koshish karein, ya directly hamare support team ko call karein:\n\n📞 ${SUPPORT_CONTACT.phone}\n📧 ${SUPPORT_CONTACT.email}`,
        rateLimited: true,
      };
    }

    // 2. Prompt injection & malicious pattern detection
    const inboundCheck = guardrails.inspectInbound(cleanText);
    if (inboundCheck.isMalicious) {
      logger.warn(
        { mobile: maskPhoneNumber(mobile), reason: inboundCheck.reason },
        "GuestAssistantService: Inbound message flagged by guardrails"
      );
      return {
        text: "Namaste! Main BidWar sports auction aur scoring assistant hun. Main tournaments, auctions, pricing, cricket/badminton scoring aur setup ke baare mein aapki madad kar sakta hun. Aap kya janna chahte hain?",
      };
    }

    // 3. Human handoff intent detection
    if (humanHandoff.isHandoffRequested(cleanText)) {
      logger.info(
        { mobile: maskPhoneNumber(mobile) },
        "GuestAssistantService: Human handoff requested"
      );
      const handoffReply = humanHandoff.buildHandoffReply(cleanText);

      // Save turn in session
      await sessionManager.appendTurn(mobile, cleanText, handoffReply);

      return {
        text: handoffReply,
        handedOff: true,
      };
    }

    // 4. Retrieve multi-turn conversation memory
    const session = await sessionManager.getSession(mobile);
    const turnCount = Math.floor(session.messages.length / 2);

    const mergedUserContext: AssistantUserContext = {
      userCategory: input.userContext?.userCategory ?? "guest",
      displayName: input.userContext?.displayName ?? "Guest",
      mobile,
      authorizedTournaments: input.userContext?.authorizedTournaments,
      isBeginner: input.userContext?.isBeginner ?? true,
      turnCount,
    };

    // 5. Extract lead details (for prospective organizers or guests)
    const detectedLead = leadCaptureService.extractLeadData(cleanText, session.leadData);

    // 6. Generate AI response via Gemini
    let rawReply = "";
    try {
      rawReply = await this.generateLlmResponse(cleanText, session.messages, mergedUserContext);
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "GuestAssistantService: LLM generation failed or timed out, using fallback"
      );
      rawReply = this.buildFallbackReply(cleanText, mergedUserContext);
    }

    // 7. Sanitize outbound response through guardrails
    const outboundSanitized = guardrails.sanitizeOutbound(rawReply);
    const finalReply = outboundSanitized.sanitizedText;

    // 8. Update conversation memory
    await sessionManager.appendTurn(mobile, cleanText, finalReply, detectedLead);

    // 9. Lead qualification & recording (for guests/trial organizers)
    let leadCaptured = false;
    const shouldCaptureLead =
      mergedUserContext.userCategory === "guest" ||
      mergedUserContext.userCategory === "trial_organizer";

    if (shouldCaptureLead && !session.leadCaptured && leadCaptureService.isQualifiedLead(detectedLead)) {
      const summary = [
        ...session.messages.map((m) => `${m.role}: ${m.content}`),
        `user: ${cleanText}`,
        `assistant: ${finalReply}`,
      ].join("\n");

      const result = await leadCaptureService.recordLead(mobile, detectedLead, summary);
      leadCaptured = result.captured;
    }

    return {
      text: finalReply,
      leadCaptured,
    };
  }

  /**
   * Call Google Gemini API with 8-second timeout and strict parameters.
   */
  private async generateLlmResponse(
    userText: string,
    history: GuestChatMessage[],
    context?: AssistantUserContext
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      logger.warn("GuestAssistantService: GEMINI_API_KEY not configured, using fallback reply");
      return this.buildFallbackReply(userText, context);
    }

    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const systemInstruction = buildAssistantSystemPrompt(context);

    // Map conversation turns to Gemini Content schema: roles must be 'user' or 'model'
    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ];

    const ai = this.getGenAIClient(apiKey);
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(8000), // 8-second strict timeout
      },
    });

    const content = response.text?.trim();
    if (!content) {
      throw new Error("Empty response received from Gemini API");
    }

    return content;
  }

  /**
   * Graceful, informative fallback when Gemini is offline, timing out, or unconfigured.
   */
  public buildFallbackReply(userQuery: string, context?: AssistantUserContext): string {
    const isHindi = /(?:hai|karein|karna|chahiye|aap|karo|batao|dhanyawad|shukriya|mujhe|kaise)/i.test(userQuery);
    const isReturning = (context?.turnCount ?? 0) > 0;

    if (isHindi) {
      const greetingHeader = isReturning
        ? "BidWar sports auction aur scoring par aapka sawal mila hai:"
        : "Namaste! BidWar me aapka swagat hai. BidWar se judne ke liye shukriya.\n\nBidWar India ka live sports auction aur sports scoring platform hai:";

      return [
        greetingHeader,
        "• Real-time player bidding aur team owner mobile panels (Android/iOS)",
        "• 1080p LED stage display aur OBS live streaming overlay",
        "• Cricket aur Badminton live match scoring",
        "• Pricing: Free Trial (2 teams), Starter (₹5,000 / 4 teams), Pro (₹6,000 / 8 teams)",
        "",
        "Aap directly hamare tournament operations expert se connect kar sakte hain:",
        `📞 Call / WhatsApp: ${SUPPORT_CONTACT.phone}`,
        `💬 WhatsApp: ${SUPPORT_CONTACT.whatsappUrl}`,
        "🌐 Free Account: https://bidwar.in/organizer?tab=signup",
      ].join("\n");
    }

    const greetingHeaderEn = isReturning
      ? "Here is the key information regarding your BidWar inquiry:"
      : "Welcome to BidWar!\n\nBidWar is India's live sports auction & scoring platform:";

    return [
      greetingHeaderEn,
      "• Real-time player bidding & mobile bidding panels for franchise owners",
      "• 1080p LED broadcast display & OBS live stream overlays",
      "• Cricket and Badminton live match scoring",
      "• Pricing: Free Trial (2 teams), Starter (₹5,000 / 4 teams), Pro (₹6,000 / 8 teams)",
      "",
      "Speak directly with our tournament operations team:",
      `📞 Call / WhatsApp: ${SUPPORT_CONTACT.phone}`,
      `💬 WhatsApp: ${SUPPORT_CONTACT.whatsappUrl}`,
      "🌐 Sign up free: https://bidwar.in/organizer?tab=signup",
    ].join("\n");
  }
}

export const guestAssistantService = new GuestAssistantService();
export const bidwarAssistantService = guestAssistantService;
