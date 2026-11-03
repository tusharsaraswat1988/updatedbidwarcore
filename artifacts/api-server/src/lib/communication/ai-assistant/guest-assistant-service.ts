/**
 * BidWar WhatsApp Gemini Assistant Orchestrator
 *
 * Coordinates conversational intelligence, intent recognition, emotional awareness,
 * session memory, anti-repetition tracking, Google Gemini generation, guardrail
 * enforcement, lead capture, operational auction & scoring retrieval, entity
 * resolution, and secure role-based data access.
 */

import { GoogleGenAI } from "@google/genai";
import { logger, maskPhoneNumber } from "../../logger";
import {
  buildAssistantSystemPrompt,
  SUPPORT_CONTACT,
  type AssistantUserContext,
} from "./knowledgebase";
import { guardrails } from "./guardrails";
import {
  sessionManager,
  type GuestChatMessage,
  type GuestSessionPayload,
  type LanguagePreference,
} from "./session-manager";
import { leadCaptureService } from "./lead-capture-service";
import { humanHandoff } from "./human-handoff";
import { conversationalIntelligence } from "./conversational-intelligence";
import { operationalDataService } from "./operational-data-service";
import { entityResolutionService } from "./entity-resolution-service";
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

    // ─── 5b. Flow Continuation / Confirmation for Pending Entity Clarification ────
    if (session.pendingEntityConfirmation) {
      const pending = session.pendingEntityConfirmation;
      const isAffirmative =
        intentResult.intent === "AFFIRMATION_CONFIRMATION" ||
        /^(?:haan|ha|han|hanji|haanji|yes|sahi|sahi\s+hai|wahi|right|correct|sure)$/i.test(cleanText);

      const isNegative = /^(?:nahi|na|no|wrong|galat)$/i.test(cleanText);

      if (isAffirmative) {
        // Confirm tournament in session
        await sessionManager.setConfirmedTournament(
          mobile,
          pending.candidateTournamentId,
          pending.candidateName,
          pending.candidateCity
        );

        // Resume the pending operational intent using the now-confirmed tournament!
        if (pending.pendingIntent === "LIVE_SCORE_QUERY" || pending.pendingIntent === "NEXT_MATCH_FOLLOWUP") {
          const scores = await operationalDataService.getTournamentLiveMatches({
            tournamentId: pending.candidateTournamentId,
            city: pending.candidateCity ?? undefined,
          });
          const formatted = operationalDataService.formatScoresResponse(scores, currentLanguage, pending.candidateName);
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "LIVE_SCORE_QUERY" };
        } else {
          // Default to Auction Overview
          const overview = await operationalDataService.getTournamentAuctionOverview({
            tournamentId: pending.candidateTournamentId,
            viewerRole: "public",
          });
          const formatted = overview
            ? operationalDataService.formatAuctionOverviewResponse(overview, currentLanguage)
            : `"${pending.candidateName}" ka auction data abhi available nahi hai.`;
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "AUCTION_OVERVIEW_QUERY" };
        }
      } else if (isNegative) {
        await sessionManager.setPendingEntityConfirmation(mobile, undefined);
        const reply =
          currentLanguage === "english"
            ? "No problem. Which tournament were you looking for? Please provide the tournament name or city."
            : "Theek hai. Kaunse tournament ki jankari chahiye? Kripya tournament ka naam ya city batayein.";
        await sessionManager.appendTurn(mobile, cleanText, reply, undefined, {
          languagePreference: currentLanguage,
        });
        return { text: reply, intent: "ENTITY_CLARIFICATION" };
      }
    }

    // ─── 5c. Security-Sensitive: Access Code Request ─────────────────────────────
    if (intentResult.intent === "ACCESS_CODE_QUERY") {
      const securityReply = operationalDataService.getAccessCodeSecurityResponse(currentLanguage);
      await sessionManager.appendTurn(mobile, cleanText, securityReply, undefined, {
        languagePreference: currentLanguage,
      });
      return { text: securityReply, intent: intentResult.intent };
    }

    // ─── 5d. Player Personal Inquiry ─────────────────────────────────────────────
    if (intentResult.intent === "PLAYER_PERSONAL_QUERY") {
      const playerDetail = await operationalDataService.getPlayerPersonalData(mobile, session.confirmedTournamentId);
      let replyText = "";

      if (!playerDetail) {
        replyText =
          currentLanguage === "english"
            ? "No registered player record was found for this phone number on BidWar. To view your personal auction status, please ensure your mobile number is linked to your player profile at https://bidwar.in."
            : "Aapke is mobile number se koi player profile registered nahi mili. Apna auction status dekhne ke liye bidwar.in portal par apne registered number se login karein.";
      } else {
        const teamStr = playerDetail.teamName ? `*${playerDetail.teamName}*` : "Pool / Unsold";
        const priceStr = playerDetail.soldPriceFormatted ?? playerDetail.basePriceFormatted;
        const statusDisplay =
          playerDetail.status === "sold"
            ? "Sold 🎉"
            : playerDetail.status === "unsold"
              ? "Unsold"
              : playerDetail.status === "retained"
                ? "Retained"
                : "Available in Pool";

        replyText = [
          `🏏 *Aapka Player Profile & Auction Status:*`,
          `• Khiladi: *${playerDetail.playerName}*`,
          `• Tournament: ${playerDetail.tournamentName}`,
          playerDetail.role ? `• Role: ${playerDetail.role}` : null,
          `• Status: ${statusDisplay}`,
          playerDetail.teamName ? `• Team: ${teamStr}` : null,
          playerDetail.soldPriceFormatted ? `• Sold Price: ${playerDetail.soldPriceFormatted}` : `• Base Price: ${playerDetail.basePriceFormatted}`,
          "",
          "Full squad aur stats dekhne ke liye bidwar.in par jayein.",
        ].filter(Boolean).join("\n");
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5e. Team Owner Personal Inquiry ─────────────────────────────────────────
    if (intentResult.intent === "TEAM_OWNER_PERSONAL_QUERY") {
      const teamDetail = await operationalDataService.getTeamOwnerPersonalData(mobile, session.confirmedTournamentId);
      let replyText = "";

      if (!teamDetail) {
        replyText =
          currentLanguage === "english"
            ? "No registered Team Owner account was found for this phone number. If you are a franchise owner, please ensure your phone number is registered with your tournament organizer."
            : "Is phone number se koi Team Owner account registered nahi mila. Agar aap team owner hain toh kripya bidwar.in par login karein ya apne tournament organizer se sampark karein.";
      } else {
        replyText = [
          `🏏 *Aapki Team ka Auction Status:*`,
          `• Team: *${teamDetail.teamName}*`,
          `• Owner: ${teamDetail.ownerName}`,
          `• Tournament: ${teamDetail.tournamentName}`,
          `• Total Purse: ${teamDetail.purseTotal}`,
          `• Purse Used: ${teamDetail.purseUsed}`,
          `• Purse Remaining: *${teamDetail.purseRemaining}*`,
          `• Players Bought: ${teamDetail.playersBoughtCount}`,
        ].join("\n");

        if (teamDetail.playersList.length > 0) {
          replyText += "\n\n*Players Roster:*\n" + teamDetail.playersList.map((p) => `• ${p.name} (${p.role ?? "Player"}): ${p.price}`).join("\n");
        }
        replyText += "\n\nLive bidding aur squad details ke liye bidwar.in portal par jayein.";
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5f. Player Lookup Query (e.g. "Rohit Sharma ka auction status batao") ───
    if (intentResult.intent === "PLAYER_LOOKUP_QUERY" && intentResult.extractedPlayerName) {
      const searchName = intentResult.extractedPlayerName;
      const authorizedIds = input.userContext?.authorizedTournaments?.map((t) => t.id) ?? [];

      const resolution = await entityResolutionService.resolveTournament({
        queryText: cleanRawWithoutPlayer(cleanText, searchName),
        authorizedTournamentIds: authorizedIds,
        confirmedTournamentId: session.confirmedTournamentId,
      });

      if (resolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: resolution.candidate.id,
          candidateName: resolution.candidate.name,
          candidateCity: resolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, resolution.confirmationMessage);
        return { text: resolution.confirmationMessage, intent: "ENTITY_CLARIFICATION" };
      }

      if (resolution.status === "ambiguous_multiple" || resolution.status === "not_found") {
        const clarification =
          resolution.status === "ambiguous_multiple"
            ? resolution.clarificationMessage
            : "Kaunse tournament ke player ka status chahiye? Tournament ka naam ya city bata dein.";
        await sessionManager.appendTurn(mobile, cleanText, clarification);
        return { text: clarification, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournamentId = resolution.tournament.id;
      const playerDetail = await operationalDataService.lookupPlayerInTournament({
        tournamentId: targetTournamentId,
        searchName,
      });

      let replyText = "";
      if (!playerDetail) {
        replyText = `"${searchName}" ${resolution.tournament.name} mein registered nahi mila. Kripya naam ki spelling check karein ya poora naam batayein.`;
      } else {
        const statusLabel =
          playerDetail.status === "sold"
            ? `Sold to *${playerDetail.teamName ?? "Team"}* for *${playerDetail.soldPriceFormatted ?? playerDetail.basePriceFormatted}*`
            : playerDetail.status === "retained"
              ? `Retained by *${playerDetail.teamName ?? "Team"}*`
              : playerDetail.status === "unsold"
                ? `Unsold (Base Price: ${playerDetail.basePriceFormatted})`
                : `Available in Pool (Base Price: ${playerDetail.basePriceFormatted})`;

        replyText = [
          `🏏 *Player Auction Details:*`,
          `• Khiladi: *${playerDetail.playerName}*`,
          `• Tournament: ${playerDetail.tournamentName}`,
          playerDetail.role ? `• Role: ${playerDetail.role}` : null,
          `• Status: ${statusLabel}`,
          "",
          "Live auction stream aur complete squad ke liye bidwar.in dekhein.",
        ].filter(Boolean).join("\n");
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        confirmedTournamentId: targetTournamentId,
        confirmedTournamentName: resolution.tournament.name,
        confirmedTournamentCity: resolution.tournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g. Live Score Query & Next Match Follow-up ─────────────────────────────
    if (intentResult.intent === "LIVE_SCORE_QUERY" || intentResult.intent === "NEXT_MATCH_FOLLOWUP") {
      const authorizedIds = input.userContext?.authorizedTournaments?.map((t) => t.id) ?? [];

      const resolution = await entityResolutionService.resolveTournament({
        queryText: cleanText,
        authorizedTournamentIds: authorizedIds,
        confirmedTournamentId: session.confirmedTournamentId,
      });

      if (resolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: resolution.candidate.id,
          candidateName: resolution.candidate.name,
          candidateCity: resolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, resolution.confirmationMessage);
        return { text: resolution.confirmationMessage, intent: "ENTITY_CLARIFICATION" };
      }

      if (resolution.status === "ambiguous_multiple") {
        await sessionManager.appendTurn(mobile, cleanText, resolution.clarificationMessage);
        return { text: resolution.clarificationMessage, intent: "ENTITY_CLARIFICATION" };
      }

      if (resolution.status === "not_found") {
        const notFoundMsg = "Kaunse tournament ka score chahiye? Tournament ka naam ya city bata dein.";
        await sessionManager.appendTurn(mobile, cleanText, notFoundMsg);
        return { text: notFoundMsg, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = resolution.tournament;
      const scores = await operationalDataService.getTournamentLiveMatches({
        tournamentId: targetTournament.id,
        city: targetTournament.city ?? undefined,
      });

      const formattedScoreText = operationalDataService.formatScoresResponse(
        scores,
        currentLanguage,
        targetTournament.name
      );

      // Attempt conversational phrasing via Gemini if available
      let finalScoreReply = formattedScoreText;
      if (this.isEnabled() && process.env.GEMINI_API_KEY) {
        try {
          const groundedContext: AssistantUserContext = {
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: formattedScoreText,
            operationalIntent: "LIVE_SCORE",
          };
          finalScoreReply = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for score failed, using deterministic text");
          finalScoreReply = formattedScoreText;
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, finalScoreReply, undefined, {
        languagePreference: currentLanguage,
        topic: "Sports Scoring Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: finalScoreReply, intent: intentResult.intent };
    }

    // ─── 5h. Auction Overview & Team Purchases Query ─────────────────────────────
    if (intentResult.intent === "AUCTION_OVERVIEW_QUERY" || intentResult.intent === "TEAM_PURCHASE_QUERY") {
      const authorizedIds = input.userContext?.authorizedTournaments?.map((t) => t.id) ?? [];

      const resolution = await entityResolutionService.resolveTournament({
        queryText: cleanText,
        authorizedTournamentIds: authorizedIds,
        confirmedTournamentId: session.confirmedTournamentId,
      });

      if (resolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: resolution.candidate.id,
          candidateName: resolution.candidate.name,
          candidateCity: resolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, resolution.confirmationMessage);
        return { text: resolution.confirmationMessage, intent: "ENTITY_CLARIFICATION" };
      }

      if (resolution.status === "ambiguous_multiple") {
        await sessionManager.appendTurn(mobile, cleanText, resolution.clarificationMessage);
        return { text: resolution.clarificationMessage, intent: "ENTITY_CLARIFICATION" };
      }

      if (resolution.status === "not_found") {
        const notFoundMsg = "Kaunse tournament ka auction status chahiye? Tournament ka naam ya city bata dein.";
        await sessionManager.appendTurn(mobile, cleanText, notFoundMsg);
        return { text: notFoundMsg, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = resolution.tournament;

      // Determine viewer role for strict privacy enforcement
      let viewerRole: "organizer" | "team_owner" | "player" | "public" = "public";
      if (input.userContext?.userCategory === "licensed_organizer" && authorizedIds.includes(targetTournament.id)) {
        viewerRole = "organizer";
      }

      const overview = await operationalDataService.getTournamentAuctionOverview({
        tournamentId: targetTournament.id,
        viewerRole,
      });

      let formattedOverviewText = "";
      if (!overview) {
        formattedOverviewText = `"${targetTournament.name}" ke liye auction data abhi available nahi hai.`;
      } else {
        formattedOverviewText = operationalDataService.formatAuctionOverviewResponse(overview, currentLanguage);
      }

      let finalAuctionReply = formattedOverviewText;
      if (this.isEnabled() && process.env.GEMINI_API_KEY && overview) {
        try {
          const groundedContext: AssistantUserContext = {
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: formattedOverviewText,
            operationalIntent: "AUCTION_OVERVIEW",
          };
          finalAuctionReply = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for auction failed, using deterministic text");
          finalAuctionReply = formattedOverviewText;
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, finalAuctionReply, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: finalAuctionReply, intent: intentResult.intent };
    }

    // ─── 5i. Name Change / Profile Modification Request ──────────────────────────
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

    // ─── 5j. Intent: Role or Identity Statement ("I am owner of BidWar") ─────────
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

    // ─── 5k. Intent: Appreciation ("Thanks, ho gaya") ────────────────────────────
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

    // ─── 5l. Intent: Emotional Frustration / Bad Experience ──────────────────────
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

    // ─── 5m. Follow-Up Continuity ("Aur batao", "explain more") without prior topic
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

    // ─── 6. General Knowledge & FAQ Processing via Gemini ────────────────────────
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

    // Extract lead details (for prospective organizers or guests)
    const detectedLead = leadCaptureService.extractLeadData(cleanText, session.leadData);

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

    // Sanitize outbound response through guardrails
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

    await sessionManager.appendTurn(mobile, cleanText, finalReply, detectedLead, {
      languagePreference: currentLanguage,
      topic: detectedTopic,
    });

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
   * If operational data context is provided, returns that directly rather than marketing brochure.
   */
  public buildFallbackReply(
    userQuery: string,
    context?: AssistantUserContext,
    session?: GuestSessionPayload
  ): string {
    // Grounded operational data bypass: NEVER dump marketing brochure for operational requests
    if (context?.operationalDataContext) {
      return context.operationalDataContext;
    }

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

function cleanRawWithoutPlayer(text: string, playerName: string): string {
  return text.replace(new RegExp(`\\b${playerName}\\b`, "gi"), "").trim();
}

export const guestAssistantService = new GuestAssistantService();
export const bidwarAssistantService = guestAssistantService;
