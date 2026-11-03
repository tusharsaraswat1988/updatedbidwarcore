/**
 * BidWar WhatsApp Gemini Assistant Orchestrator
 *
 * Coordinates conversational intelligence, intent recognition, emotional awareness,
 * session memory, anti-repetition tracking, Google Gemini generation, guardrail
 * enforcement, lead capture, and support escalation for guests, members, and organizers.
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
import { sessionManager, type GuestChatMessage, type GuestSessionPayload, type LanguagePreference } from "./session-manager";
import { leadCaptureService } from "./lead-capture-service";
import { humanHandoff } from "./human-handoff";
import { conversationalIntelligence } from "./conversational-intelligence";
import type { ResolvedIdentity } from "../conversation-router";

export interface GuestAssistantInput {
  mobile: string;
  from: string;
  text: string;
  messageId?: string;
  ip?: string | null;
  userContext?: AssistantUserContext;
  identity?: ResolvedIdentity;
}

export interface GuestAssistantResponse {
  text: string;
  leadCaptured?: boolean;
  handedOff?: boolean;
  rateLimited?: boolean;
  intent?: string;
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
   * Primary entry point for processing incoming WhatsApp messages.
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
      await sessionManager.appendTurn(mobile, cleanText, handoffReply);
      return {
        text: handoffReply,
        handedOff: true,
      };
    }

    // 4. Retrieve multi-turn conversation memory
    const session = await sessionManager.getSession(mobile);
    const turnCount = Math.floor(session.messages.length / 2);

    // 5. Conversational Intent & Language Classification
    let currentLanguage = session.languagePreference;
    const intentResult = conversationalIntelligence.detectIntent(
      cleanText,
      session.messages.length,
      currentLanguage
    );

    // 5a. Explicit Language Switch Handling ("Talk in Hindi", "Ab English mein explain karo")
    if (intentResult.intent === "EXPLICIT_LANGUAGE_PREFERENCE" && intentResult.explicitLanguage) {
      currentLanguage = intentResult.explicitLanguage;
      await sessionManager.setLanguagePreference(mobile, currentLanguage);

      let switchReply = "";
      if (currentLanguage === "hindi") {
        switchReply = "Haan zaroor! Ab se main aapse Hindi mein baat karunga. Aap BidWar ke baare mein kya janna chahte hain?";
      } else if (currentLanguage === "english") {
        switchReply = "Understood! I will communicate in English. How can I help you with BidWar today?";
      } else {
        switchReply = "Sure! Ab hum Hinglish mein baat karenge. Bataiye BidWar mein aapki kya madad kar sakta hoon?";
      }

      await sessionManager.appendTurn(mobile, cleanText, switchReply, undefined, {
        languagePreference: currentLanguage,
      });

      return {
        text: switchReply,
        intent: intentResult.intent,
      };
    }

    // Infer language if not explicitly set
    if (!currentLanguage) {
      currentLanguage = conversationalIntelligence.inferNaturalLanguage(cleanText);
    }

    // 5b. Intent: Name Change / Profile Modification Request
    if (intentResult.intent === "NAME_CHANGE_REQUEST") {
      let resolvedIdentity = input.identity;
      if (!resolvedIdentity) {
        try {
          const { conversationRouter } = await import("../conversation-router");
          resolvedIdentity = await conversationRouter.resolveIdentity(mobile);
        } catch {
          resolvedIdentity = { kind: "guest", mobile, displayName: "Guest" };
        }
      }

      const modResult = await conversationalIntelligence.handleProfileModification({
        mobile,
        text: cleanText,
        identity: resolvedIdentity,
        requestedName: intentResult.extractedName,
        preferredLanguage: currentLanguage,
      });

      await sessionManager.appendTurn(mobile, cleanText, modResult.replyText, undefined, {
        languagePreference: currentLanguage,
      });

      return {
        text: modResult.replyText,
        intent: intentResult.intent,
      };
    }

    // 5c. Intent: Role or Identity Statement ("I am owner of BidWar")
    if (intentResult.intent === "ROLE_OR_IDENTITY_CLAIM") {
      const roleReply = conversationalIntelligence.handleRoleStatement(currentLanguage);
      await sessionManager.appendTurn(mobile, cleanText, roleReply, undefined, {
        languagePreference: currentLanguage,
      });
      return {
        text: roleReply,
        intent: intentResult.intent,
      };
    }

    // 5d. Intent: Appreciation ("Thanks, ho gaya")
    if (intentResult.intent === "APPRECIATION") {
      const appreciationReply = conversationalIntelligence.buildEmotionalResponse({
        intent: "APPRECIATION",
        text: cleanText,
        preferredLanguage: currentLanguage,
      });
      await sessionManager.appendTurn(mobile, cleanText, appreciationReply, undefined, {
        languagePreference: currentLanguage,
      });
      return {
        text: appreciationReply,
        intent: intentResult.intent,
      };
    }

    // 5e. Intent: Emotional Frustration / Bad Experience without separate inquiry
    if (intentResult.intent === "EMOTIONAL_FRUSTRATION") {
      const isPureEmotionalStatement =
        /\b(?:problem\s+aa\s+rahi\s+hai|bahut\s+bekar\s+experience|bekar\s+experience)\b/i.test(cleanText) &&
        !/\b(?:pricing|cost|how\s+to\s+add|rules|overs|badminton|cricket\s+points)\b/i.test(cleanText);

      if (isPureEmotionalStatement) {
        const emotionalReply = conversationalIntelligence.buildEmotionalResponse({
          intent: "EMOTIONAL_FRUSTRATION",
          text: cleanText,
          preferredLanguage: currentLanguage,
        });
        await sessionManager.appendTurn(mobile, cleanText, emotionalReply, undefined, {
          languagePreference: currentLanguage,
        });
        return {
          text: emotionalReply,
          intent: intentResult.intent,
        };
      }
    }

    // 5f. Follow-Up Continuity ("Aur batao", "explain more") without prior topic
    if (intentResult.intent === "FOLLOW_UP" && session.messages.length === 0) {
      const clarificationReply =
        currentLanguage === "english"
          ? "What specific topic would you like to explore further? For example: Live Player Auction, Cricket/Badminton Scoring, or Tournament Setup."
          : "Aap kis topic ke baare mein aur detail janna chahte hain? Jaise: Live Player Auction, Cricket/Badminton Scoring, ya Tournament Setup.";

      await sessionManager.appendTurn(mobile, cleanText, clarificationReply, undefined, {
        languagePreference: currentLanguage,
      });
      return {
        text: clarificationReply,
        intent: intentResult.intent,
      };
    }

    // 6. Merge User Context & Anti-Repetition Tracking
    const lastTopic = session.deliveredSummary?.lastTopic || "General";
    const mergedUserContext: AssistantUserContext = {
      userCategory: input.userContext?.userCategory ?? "guest",
      displayName: input.userContext?.displayName ?? "Guest",
      mobile,
      authorizedTournaments: input.userContext?.authorizedTournaments,
      isBeginner: input.userContext?.isBeginner ?? true,
      turnCount,
      preferredLanguage: currentLanguage,
      deliveredSummary: session.deliveredSummary,
      isFollowUp: intentResult.intent === "FOLLOW_UP",
      followUpTopic: lastTopic,
    };

    // 7. Extract lead details (for prospective organizers or guests)
    const detectedLead = leadCaptureService.extractLeadData(cleanText, session.leadData);

    // 8. Generate AI response via Gemini
    let rawReply = "";
    try {
      rawReply = await this.generateLlmResponse(cleanText, session.messages, mergedUserContext);
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "GuestAssistantService: LLM generation failed or timed out, using fallback"
      );
      rawReply = this.buildFallbackReply(cleanText, mergedUserContext, session);
    }

    // 9. Sanitize outbound response through guardrails
    const outboundSanitized = guardrails.sanitizeOutbound(rawReply);
    const finalReply = outboundSanitized.sanitizedText;

    // Detect active topic for anti-repetition memory
    let detectedTopic = lastTopic;
    if (/auction|bidding|bid|purse|fortune\s+wheel/i.test(cleanText) || /auction|purse/i.test(finalReply)) {
      detectedTopic = "Auction Module";
    } else if (/scoring|cricket|badminton|runs|wickets|overs/i.test(cleanText) || /scoring|cricket|badminton/i.test(finalReply)) {
      detectedTopic = "Sports Scoring Module";
    } else if (/pricing|tier|starter|pro|elite|champion|trial/i.test(cleanText) || /₹/i.test(finalReply)) {
      detectedTopic = "Pricing Matrix";
    }

    // 10. Update conversation memory with anti-repetition tracking
    await sessionManager.appendTurn(mobile, cleanText, finalReply, detectedLead, {
      languagePreference: currentLanguage,
      topic: detectedTopic,
    });

    // 11. Lead qualification & recording (for guests/trial organizers)
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
      intent: intentResult.intent,
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
   * Graceful, context-aware fallback when Gemini is offline, timing out, or unconfigured.
   * Strictly avoids repetitive marketing brochure dumps on follow-ups or complaints.
   */
  public buildFallbackReply(
    userQuery: string,
    context?: AssistantUserContext,
    session?: GuestSessionPayload
  ): string {
    const clean = userQuery.trim();
    const lang = context?.preferredLanguage ?? session?.languagePreference;
    const isHindi = lang ? lang !== "english" : /(?:hai|karein|karna|chahiye|aap|karo|batao|dhanyawad|shukriya|mujhe|kaise)/i.test(clean);
    const isReturning = (context?.turnCount ?? 0) > 0;

    // 1. Emotional Frustration / Trouble
    if (/\b(?:problem\s+aa\s+rahi\s+hai|dikkat|not\s+working|error\s+aa\s+raha)\b/i.test(clean)) {
      return isHindi
        ? "Samajh raha hoon. Tournament setup mein dikkat aa rahi hai toh chaliye ek-ek step check karte hain. Aap abhi kis screen par hain?"
        : "I understand setting up can be tricky. Let's check step by step: which screen or step are you currently on?";
    }
    if (/\b(?:bekar\s+experience|worst\s+experience)\b/i.test(clean)) {
      return isHindi
        ? "Sorry, aapko aisa experience mila. Main samajhna chahta hoon ki exactly kya problem hui, taaki uska sahi solution nikal sakein."
        : "I'm really sorry you had a disappointing experience. I want to understand what went wrong so we can fix it for you. Could you share what happened?";
    }

    // 2. Appreciation
    if (/\b(?:thanks,?\s*ho\s+gaya|thanks\s+ho\s+gaya)\b/i.test(clean)) {
      return isHindi
        ? "Bahut badhiya! Agar aage kisi step mein help chahiye ho toh bataiyega."
        : "You're very welcome! Feel free to ask if you need help with any other step.";
    }

    // 3. Follow-Up ("Aur batao", "explain more") on returning turn
    if (isReturning && /\b(?:aur\s+batao|explain\s+more|what\s+else)\b/i.test(clean)) {
      const lastTopic = context?.followUpTopic || session?.deliveredSummary?.lastTopic;
      if (lastTopic && /auction/i.test(lastTopic)) {
        return isHindi
          ? "Live auction ke baare mein: Operator console se aap real-time bidding, timer aur team purse limits manage kar sakte hain. Team owners apne mobile phone se bid karte hain aur stage LED par turant update hota hai. Kya aap Fortune Wheel ya player unsold rules ke baare mein janna chahte hain?"
          : "In the live auction, the central operator console lets you manage real-time bids, countdown timers, and team purse budgets. Team owners bid directly from their smartphone browser, and the 1080p LED display updates instantly. Would you like to know how the Fortune Wheel tiebreaker works?";
      }
      return isHindi
        ? "Aap kis feature ke baare mein aur janna chahte hain: Live Auction Bidding, Cricket/Badminton Scoring, ya Tournament Setup?"
        : "Would you like more details on Live Auction Bidding, Cricket/Badminton Scoring, or Tournament Setup?";
    }

    // 4. Default fallback matching existing contract with support contact and signup url
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
