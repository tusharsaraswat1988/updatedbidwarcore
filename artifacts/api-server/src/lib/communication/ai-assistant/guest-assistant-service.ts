/**
 * BidWar WhatsApp Gemini Assistant Orchestrator
 *
 * Coordinates conversational intelligence, intent recognition, emotional awareness,
 * session memory, anti-repetition tracking, Google Gemini generation, guardrail
 * enforcement, lead capture, operational auction & scoring retrieval, entity
 * resolution, audio message transcription, and secure role-based data access.
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
import { entityResolutionService, type CandidateTournament } from "./entity-resolution-service";
import { audioTranscriptionService } from "./audio-transcription-service";
import type { ResolvedIdentity } from "../conversation-router";

export interface GuestAssistantInput {
  mobile: string;
  from: string;
  text: string;
  messageId?: string;
  ip?: string | null;
  userContext?: AssistantUserContext;
  identity?: ResolvedIdentity;
  raw?: any;
}

export interface GuestAssistantResponse {
  text: string;
  leadCaptured?: boolean;
  handedOff?: boolean;
  rateLimited?: boolean;
  intent?: string;
}

export type OperationalTournamentResolution =
  | { status: "resolved"; tournament: { id: number; name: string; city?: string | null } }
  | { status: "denied"; message: string }
  | { status: "clarification"; message: string }
  | { status: "needs_confirmation"; candidate: CandidateTournament; message: string };

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
  public resetRateLimit(): void {
    requestTimestamps.clear();
  }

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
   * Primary entry point for inbound WhatsApp user messages.
   */
  public async handleMessage(input: GuestAssistantInput): Promise<GuestAssistantResponse> {
    const { mobile, from, text } = input;
    const cleanText = (text ?? "").trim();
    const ip = input.ip ?? null;

    logger.info(
      { mobile: maskPhoneNumber(mobile), length: cleanText.length, userCategory: input.userContext?.userCategory },
      "GuestAssistantService: Processing incoming WhatsApp message"
    );

    // 0. Empty Message / Audio Note where transcription is missing or unintelligible
    if (!cleanText || cleanText.length === 0) {
      const preferredLang = input.userContext?.preferredLanguage;
      const audioReply = audioTranscriptionService.buildUnclearAudioReply(preferredLang);
      return {
        text: audioReply,
        intent: "UNKNOWN_UNCLEAR",
      };
    }

    // 1. Sliding window rate limit check (20 msgs / hour)
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
          return { text: formatted, intent: pending.pendingIntent };
        }

        if (pending.pendingIntent === "AUCTION_OVERVIEW_QUERY" || pending.pendingIntent === "TEAM_PURCHASE_QUERY") {
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

        if (pending.pendingIntent === "LIVE_AUCTION_STATE_QUERY") {
          const liveState = await operationalDataService.getLiveAuctionState(pending.candidateTournamentId);
          const formatted = liveState
            ? operationalDataService.formatLiveAuctionStateResponse(liveState, currentLanguage)
            : `"${pending.candidateName}" ka live auction data abhi available nahi hai.`;
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "LIVE_AUCTION_STATE_QUERY" };
        }

        if (pending.pendingIntent === "TOP_SOLD_PLAYERS_QUERY") {
          const topPlayers = await operationalDataService.getTopSoldPlayers({ tournamentId: pending.candidateTournamentId, limit: 5 });
          const formatted = operationalDataService.formatTopSoldPlayersResponse(topPlayers, currentLanguage, pending.candidateName, 5);
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "TOP_SOLD_PLAYERS_QUERY" };
        }

        if (pending.pendingIntent === "LAST_SOLD_PLAYERS_QUERY") {
          const lastPlayers = await operationalDataService.getLastSoldPlayers({ tournamentId: pending.candidateTournamentId, limit: 5 });
          const formatted = operationalDataService.formatLastSoldPlayersResponse(lastPlayers, currentLanguage, pending.candidateName, 5);
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "LAST_SOLD_PLAYERS_QUERY" };
        }

        if (pending.pendingIntent === "TEAM_PURSE_RANKING_QUERY") {
          const rankings = await operationalDataService.getTeamPurseAndRankings({ tournamentId: pending.candidateTournamentId, sortBy: "spent" });
          const formatted = operationalDataService.formatTeamPurseRankingsResponse(rankings, currentLanguage, pending.candidateName, "spent");
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "TEAM_PURSE_RANKING_QUERY" };
        }

        if (pending.pendingIntent === "MAX_BID_QUERY") {
          const teamDetail = await operationalDataService.getTeamOwnerPersonalData(mobile, pending.candidateTournamentId);
          const formatted = teamDetail
            ? operationalDataService.formatMaxBidResponse(teamDetail, currentLanguage)
            : currentLanguage === "english"
              ? "No team owner record was found for your phone in this tournament."
              : "Is tournament mein aapka number kisi team owner account se linked nahi mila.";
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "MAX_BID_QUERY" };
        }

        if (pending.pendingIntent === "TEAM_HIERARCHY_QUERY") {
          const hierarchy = await operationalDataService.getTeamWiseAcquisitionHierarchy(pending.candidateTournamentId);
          const formatted = operationalDataService.formatTeamHierarchyResponse(hierarchy, currentLanguage, pending.candidateName);
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "TEAM_HIERARCHY_QUERY" };
        }

        if (pending.pendingIntent === "SOLD_PLAYERS_SORTED_QUERY") {
          const sorted = await operationalDataService.getAllSoldPlayersSorted(pending.candidateTournamentId, "desc");
          const formatted = operationalDataService.formatTopSoldPlayersResponse(sorted, currentLanguage, pending.candidateName, 100);
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "SOLD_PLAYERS_SORTED_QUERY" };
        }

        if (pending.pendingIntent === "AUCTION_RULES_QUERY") {
          const rules = await operationalDataService.getTournamentDetailsAndRules(pending.candidateTournamentId);
          const formatted = rules
            ? operationalDataService.formatTournamentRulesResponse(rules, currentLanguage)
            : `"${pending.candidateName}" ke rules abhi available nahi hain.`;
          await sessionManager.appendTurn(mobile, cleanText, formatted, undefined, {
            languagePreference: currentLanguage,
            confirmedTournamentId: pending.candidateTournamentId,
            confirmedTournamentName: pending.candidateName,
            confirmedTournamentCity: pending.candidateCity ?? undefined,
          });
          return { text: formatted, intent: "AUCTION_RULES_QUERY" };
        }

        const defaultReply =
          currentLanguage === "english"
            ? `Tournament "${pending.candidateName}" has been selected. What would you like to know?`
            : `"${pending.candidateName}" select ho gaya hai. Aap iske baare mein kya janna chahte hain?`;
        await sessionManager.appendTurn(mobile, cleanText, defaultReply, undefined, {
          languagePreference: currentLanguage,
          confirmedTournamentId: pending.candidateTournamentId,
          confirmedTournamentName: pending.candidateName,
          confirmedTournamentCity: pending.candidateCity ?? undefined,
        });
        return { text: defaultReply, intent: "ENTITY_CLARIFIED" };
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

    // ─── 5d. Player Personal Inquiry ("Mera auction status kya hai?") ──────────────
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
        topic: "Auction Module",
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5e. Team Owner Personal Inquiry ("Mere paas kitna purse bacha hai?") ─────
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
          teamDetail.maxAllowedBid ? `• Maximum Allowed Next Bid: *${teamDetail.maxAllowedBid}*` : null,
          teamDetail.reservePurse ? `• Reserved for Squad Slots: ${teamDetail.reservePurse}` : null,
          `• Players Bought: ${teamDetail.playersBoughtCount}`,
        ].filter(Boolean).join("\n");

        if (teamDetail.playersList.length > 0) {
          replyText += "\n\n*Players Roster:*\n" + teamDetail.playersList.map((p) => `• ${p.name} (${p.role ?? "Player"}): ${p.price}`).join("\n");
        }
        replyText += "\n\nLive bidding aur squad details ke liye bidwar.in portal par jayein.";
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5f. Player Lookup Query ("Rohit Sharma ka auction status batao") ──────────
    if (intentResult.intent === "PLAYER_LOOKUP_QUERY" && intentResult.extractedPlayerName) {
      const authorizedIds = input.userContext?.authorizedTournaments?.map((t) => t.id) ?? [];
      const resolution = await entityResolutionService.resolveTournament({
        queryText: cleanRawWithoutPlayer(cleanText, intentResult.extractedPlayerName),
        authorizedTournamentIds: authorizedIds,
        confirmedTournamentId: session.confirmedTournamentId,
      });

      const tournamentId = resolution.status === "resolved" ? resolution.tournament.id : session.confirmedTournamentId;
      const lookupResult = tournamentId
        ? await operationalDataService.lookupPlayerInTournament({
            searchName: intentResult.extractedPlayerName,
            tournamentId,
          })
        : null;

      let lookupReply = "";
      if (!lookupResult) {
        lookupReply = currentLanguage === "english"
          ? `Could not find any auction record for player "${intentResult.extractedPlayerName}". Please check the spelling or provide the tournament name.`
          : `"${intentResult.extractedPlayerName}" khiladi ka auction record nahi mila. Kripya naam ki spelling check karein ya tournament ka naam batayein.`;
      } else {
        const teamText = lookupResult.teamName ? ` (Team: ${lookupResult.teamName})` : "";
        const priceText = lookupResult.soldPriceFormatted ? lookupResult.soldPriceFormatted : `Base ${lookupResult.basePriceFormatted}`;
        lookupReply = `👤 ${lookupResult.playerName} (${lookupResult.tournamentName}):\n• Role: ${lookupResult.role}\n• Status: ${lookupResult.status.toUpperCase()}${teamText}\n• Price: ${priceText}`;
      }

      await sessionManager.appendTurn(mobile, cleanText, lookupReply, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
      });
      return { text: lookupReply, intent: intentResult.intent };
    }

    // ─── 5g. Live Scoring Query ("Kanpur BPL ka score batao", "Live score kya hai?")
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

      const formattedScoreText = operationalDataService.formatScoresResponse(scores, currentLanguage, targetTournament.name);

      let finalScoreReply = formattedScoreText;
      if (this.isEnabled() && process.env.GEMINI_API_KEY && (scores.cricket.length > 0 || scores.badminton.length > 0)) {
        try {
          const groundedContext: AssistantUserContext = {
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: formattedScoreText,
            operationalIntent: "LIVE_SCORING",
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

    // ─── 5g-2. Live Auction State Query ("Abhi auction ka kya status hai?", "Current auction state kya hai?") ──
    if (intentResult.intent === "LIVE_AUCTION_STATE_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const liveState = await operationalDataService.getLiveAuctionState(targetTournament.id);
      let replyText = liveState
        ? operationalDataService.formatLiveAuctionStateResponse(liveState, currentLanguage)
        : `"${targetTournament.name}" ka live auction data abhi available nahi hai.`;

      if (this.isEnabled() && process.env.GEMINI_API_KEY && liveState) {
        try {
          const groundedContext: AssistantUserContext = {
            ...input.userContext,
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: replyText,
            operationalIntent: "LIVE_AUCTION_STATE",
          };
          replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for live auction state failed, using deterministic text");
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g-3. Top N Sold Players Query ("Top 5 highest sold players batao", "Sabse mehenga player kaun bika?") ──
    if (intentResult.intent === "TOP_SOLD_PLAYERS_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const limit = intentResult.limit ?? 5;
      const topPlayers = await operationalDataService.getTopSoldPlayers({ tournamentId: targetTournament.id, limit });
      let replyText = operationalDataService.formatTopSoldPlayersResponse(topPlayers, currentLanguage, targetTournament.name, limit);

      if (this.isEnabled() && process.env.GEMINI_API_KEY && topPlayers.length > 0) {
        try {
          const groundedContext: AssistantUserContext = {
            ...input.userContext,
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: replyText,
            operationalIntent: "TOP_SOLD_PLAYERS",
          };
          replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for top sold players failed, using deterministic text");
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g-4. Last N Sold Players Query ("Last 5 sold players kaun hain?") ────────
    if (intentResult.intent === "LAST_SOLD_PLAYERS_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const limit = intentResult.limit ?? 5;
      const lastPlayers = await operationalDataService.getLastSoldPlayers({ tournamentId: targetTournament.id, limit });
      let replyText = operationalDataService.formatLastSoldPlayersResponse(lastPlayers, currentLanguage, targetTournament.name, limit);

      if (this.isEnabled() && process.env.GEMINI_API_KEY && lastPlayers.length > 0) {
        try {
          const groundedContext: AssistantUserContext = {
            ...input.userContext,
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: replyText,
            operationalIntent: "LAST_SOLD_PLAYERS",
          };
          replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for last sold players failed, using deterministic text");
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g-5. Team Purse / Spending Rankings ("Kaunsi team ne sabse zyada paisa kharch kiya?", "Kis team ka purse sabse zyada bacha hai?")
    if (intentResult.intent === "TEAM_PURSE_RANKING_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const metric = intentResult.metric ?? "spent";
      const rankings = await operationalDataService.getTeamPurseAndRankings({ tournamentId: targetTournament.id, sortBy: metric });
      let replyText = operationalDataService.formatTeamPurseRankingsResponse(rankings, currentLanguage, targetTournament.name, metric);

      if (this.isEnabled() && process.env.GEMINI_API_KEY && rankings.length > 0) {
        try {
          const groundedContext: AssistantUserContext = {
            ...input.userContext,
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: replyText,
            operationalIntent: "TEAM_PURSE_RANKINGS",
          };
          replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for team purse rankings failed, using deterministic text");
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g-6. Maximum Next Bid Query ("Maximum next bid kitni kar sakte hain?", "Meri team kitna bid kar sakti hai?") ──
    if (intentResult.intent === "MAX_BID_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const teamDetail = await operationalDataService.getTeamOwnerPersonalData(mobile, targetTournament.id);
      let replyText = "";
      if (!teamDetail) {
        replyText =
          currentLanguage === "english"
            ? "Maximum permissible next bid is calculated for registered team owners. No team owner record was found for your phone in this tournament."
            : "Maximum permissible next bid kewal registered team owners ke liye calculate hoti hai. Is tournament mein aapka number kisi team owner account se linked nahi mila.";
      } else {
        replyText = operationalDataService.formatMaxBidResponse(teamDetail, currentLanguage);
        if (this.isEnabled() && process.env.GEMINI_API_KEY) {
          try {
            const groundedContext: AssistantUserContext = {
              ...input.userContext,
              userCategory: input.userContext?.userCategory ?? "guest",
              displayName: input.userContext?.displayName ?? "Guest",
              mobile,
              turnCount,
              preferredLanguage: currentLanguage,
              operationalDataContext: replyText,
              operationalIntent: "MAX_NEXT_BID",
            };
            replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
          } catch (err) {
            logger.warn({ err }, "GuestAssistantService: LLM formatting for max bid failed, using deterministic text");
          }
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g-7. Team Hierarchy Query ("Team-wise sold players ki list do", "Complete sold-player hierarchy batao") ──
    if (intentResult.intent === "TEAM_HIERARCHY_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const hierarchy = await operationalDataService.getTeamWiseAcquisitionHierarchy(targetTournament.id);
      let replyText = operationalDataService.formatTeamHierarchyResponse(hierarchy, currentLanguage, targetTournament.name);

      if (this.isEnabled() && process.env.GEMINI_API_KEY && hierarchy.length > 0) {
        try {
          const groundedContext: AssistantUserContext = {
            ...input.userContext,
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: replyText,
            operationalIntent: "TEAM_HIERARCHY",
          };
          replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for team hierarchy failed, using deterministic text");
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g-8. Sold Players Sorted Query ("Players ko sold amount ke descending order mein dikhao") ──
    if (intentResult.intent === "SOLD_PLAYERS_SORTED_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const sortedPlayers = await operationalDataService.getAllSoldPlayersSorted(targetTournament.id, "desc");
      let replyText = operationalDataService.formatTopSoldPlayersResponse(sortedPlayers, currentLanguage, targetTournament.name, 100);

      if (this.isEnabled() && process.env.GEMINI_API_KEY && sortedPlayers.length > 0) {
        try {
          const groundedContext: AssistantUserContext = {
            ...input.userContext,
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: replyText,
            operationalIntent: "SOLD_PLAYERS_SORTED",
          };
          replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for sorted sold players failed, using deterministic text");
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
    }

    // ─── 5g-9. Tournament & Auction Rules Query ("Tournament ke rules kya hain?", "Bid increment kya hai?", "Squad size limits kya hain?") ──
    if (intentResult.intent === "AUCTION_RULES_QUERY") {
      const tourneyResolution = await this.resolveOperationalTournament(input, cleanText, session, intentResult.intent);
      if (tourneyResolution.status === "denied") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: intentResult.intent };
      }
      if (tourneyResolution.status === "clarification") {
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }
      if (tourneyResolution.status === "needs_confirmation") {
        await sessionManager.setPendingEntityConfirmation(mobile, {
          candidateTournamentId: tourneyResolution.candidate.id,
          candidateName: tourneyResolution.candidate.name,
          candidateCity: tourneyResolution.candidate.city,
          pendingIntent: intentResult.intent,
          originalQuery: cleanText,
        });
        await sessionManager.appendTurn(mobile, cleanText, tourneyResolution.message);
        return { text: tourneyResolution.message, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = tourneyResolution.tournament;
      const rules = await operationalDataService.getTournamentDetailsAndRules(targetTournament.id);
      let replyText = rules
        ? operationalDataService.formatTournamentRulesResponse(rules, currentLanguage)
        : `"${targetTournament.name}" ke rules abhi available nahi hain.`;

      if (this.isEnabled() && process.env.GEMINI_API_KEY && rules) {
        try {
          const groundedContext: AssistantUserContext = {
            ...input.userContext,
            userCategory: input.userContext?.userCategory ?? "guest",
            displayName: input.userContext?.displayName ?? "Guest",
            mobile,
            turnCount,
            preferredLanguage: currentLanguage,
            operationalDataContext: replyText,
            operationalIntent: "TOURNAMENT_RULES",
          };
          replyText = await this.generateLlmResponse(cleanText, session.messages, groundedContext);
        } catch (err) {
          logger.warn({ err }, "GuestAssistantService: LLM formatting for tournament rules failed, using deterministic text");
        }
      }

      await sessionManager.appendTurn(mobile, cleanText, replyText, undefined, {
        languagePreference: currentLanguage,
        topic: "Auction Module",
        confirmedTournamentId: targetTournament.id,
        confirmedTournamentName: targetTournament.name,
        confirmedTournamentCity: targetTournament.city ?? undefined,
      });
      return { text: replyText, intent: intentResult.intent };
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
        const notFoundMsg = "Kaunse tournament ka auction data dekhna hai? Kripya tournament ka naam ya city batayein.";
        await sessionManager.appendTurn(mobile, cleanText, notFoundMsg);
        return { text: notFoundMsg, intent: "ENTITY_CLARIFICATION" };
      }

      const targetTournament = resolution.tournament;

      // Determine viewer role for strict privacy enforcement
      let viewerRole: "organizer" | "team_owner" | "player" | "public" = "public";
      if (input.userContext?.userCategory === "licensed_organizer" && authorizedIds.includes(targetTournament.id)) {
        viewerRole = "organizer";
      } else if (input.userContext?.userCategory === "team_owner") {
        viewerRole = "team_owner";
      } else if (input.userContext?.userCategory === "player") {
        viewerRole = "player";
      }

      const overview = await operationalDataService.getTournamentAuctionOverview({
        tournamentId: targetTournament.id,
        viewerRole,
        viewerTeamId: input.userContext?.activeTeamId,
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
            ...input.userContext,
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

    // ─── 5n. Bot Feedback / Repetition Complaint ("Tumhare paas aur response nahi hai kya?") ───
    if (intentResult.intent === "BOT_FEEDBACK_REPETITION") {
      const feedbackReply = conversationalIntelligence.handleBotFeedback(currentLanguage);
      await sessionManager.appendTurn(mobile, cleanText, feedbackReply, undefined, {
        languagePreference: currentLanguage,
      });
      return {
        text: feedbackReply,
        intent: intentResult.intent,
      };
    }

    // ─── 5o. Casual Conversation ("Kya haal-chaal?", "Bhai kya kar rahe ho?", "Tum kaise ho?") ───
    if (intentResult.intent === "CASUAL_CONVERSATION") {
      const casualReply = conversationalIntelligence.handleCasualConversation(cleanText, currentLanguage);
      await sessionManager.appendTurn(mobile, cleanText, casualReply, undefined, {
        languagePreference: currentLanguage,
      });
      return {
        text: casualReply,
        intent: intentResult.intent,
      };
    }

    // ─── 5p. Natural Greeting ("Hi", "Hello", "Good morning") ────────────────────
    if (intentResult.intent === "GREETING") {
      const greetingReply = conversationalIntelligence.handleGreeting(cleanText, currentLanguage);
      await sessionManager.appendTurn(mobile, cleanText, greetingReply, undefined, {
        languagePreference: currentLanguage,
      });
      return {
        text: greetingReply,
        intent: intentResult.intent,
      };
    }

    // ─── 5q. Unknown / Unclear Intent ("asdfgh", "???", gibberish) ───────────────
    if (intentResult.intent === "UNKNOWN_UNCLEAR") {
      const unclearReply = conversationalIntelligence.handleUnknownUnclear(currentLanguage);
      await sessionManager.appendTurn(mobile, cleanText, unclearReply, undefined, {
        languagePreference: currentLanguage,
      });
      return {
        text: unclearReply,
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
    const isMockClient =
      (ai?.models?.generateContent as any)?.mock !== undefined ||
      (this.getGenAIClient as any)?.mock !== undefined;

    if (apiKey.startsWith("mock-") && !isMockClient) {
      logger.warn("GuestAssistantService: Mock GEMINI_API_KEY provided without mocked client, using fallback");
      return this.buildFallbackReply(userText, context);
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 500,
        abortSignal: AbortSignal.timeout(8000),
      },
    });

    const textPart = (response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text)?.trim();
    if (!textPart) {
      throw new Error("Empty response from Gemini API");
    }

    return textPart;
  }

  /**
   * Resolve and authorize the tournament for an operational query.
   * Enforces:
   * 1. Associated licensed tournament access only
   * 2. Trial organizers get product guidance and operational data is withheld
   * 3. Multi-tournament disambiguation
   * 4. Automatic binding if single tournament or confirmed in session
   * 5. Strict rejection of unassociated tournaments
   */
  public async resolveOperationalTournament(
    input: GuestAssistantInput,
    cleanText: string,
    session: GuestSessionPayload,
    intent: string
  ): Promise<OperationalTournamentResolution> {
    const currentLanguage =
      session.languagePreference ??
      conversationalIntelligence.inferNaturalLanguage(cleanText);
    const authorizedList = input.userContext?.authorizedTournaments || [];
    const authorizedIds = authorizedList.map((t) => t.id);

    // 1. If user is explicitly a trial organizer with no licensed tournaments, deny operational data with upgrade instructions
    if (
      input.userContext?.userCategory === "trial_organizer" &&
      (!input.userContext.memberships || input.userContext.memberships.every((m) => m.licenseStatus !== "licensed" && !m.isLicensed))
    ) {
      const msg =
        currentLanguage === "english"
          ? `Operational tournament data and live auction intelligence are available for licensed tournaments. Your account is currently on a trial plan. To upgrade your tournament, please visit https://bidwar.in/organizer or contact our team at ${SUPPORT_CONTACT.phone}.`
          : `Operational tournament data aur live auction intelligence kewal licensed tournaments ke liye available hai. Aapka account abhi trial plan par hai. Apne tournament ko upgrade karne ke liye https://bidwar.in/organizer par jayein ya hamari team se ${SUPPORT_CONTACT.phone} par sampark karein.`;
      return { status: "denied", message: msg };
    }

    // 2. If user is guest or has no authorized tournaments, reject request for private tournament operational data
    if (authorizedIds.length === 0) {
      const msg =
        currentLanguage === "english"
          ? "You do not have access to operational data for this tournament. Please message from your registered tournament mobile number or visit https://bidwar.in."
          : "Aapka number kisi active licensed tournament se juda hua nahi hai. Private operational data dekhne ke liye kripya registered phone number se message karein ya bidwar.in par jayein.";
      return { status: "denied", message: msg };
    }

    // 3. Try to resolve tournament from queryText
    const resolution = await entityResolutionService.resolveTournament({
      queryText: cleanText,
      authorizedTournamentIds: authorizedIds,
      confirmedTournamentId: session.confirmedTournamentId,
    });

    if (resolution.status === "needs_confirmation") {
      return {
        status: "needs_confirmation",
        candidate: resolution.candidate,
        message: resolution.confirmationMessage,
      };
    }

    if (resolution.status === "ambiguous_multiple") {
      return {
        status: "clarification",
        message: resolution.clarificationMessage,
      };
    }

    if (resolution.status === "resolved") {
      // Security check: is the resolved tournament in user's authorized licensed tournaments?
      if (!authorizedIds.includes(resolution.tournament.id)) {
        const msg =
          currentLanguage === "english"
            ? `You do not have authorization to view operational data for "${resolution.tournament.name}". You can only access tournaments associated with your registered phone number.`
            : `Aapke paas "${resolution.tournament.name}" ke operational data ko access karne ki authorization nahi hai. Aap kewal apne registered tournaments ka data dekh sakte hain.`;
        return { status: "denied", message: msg };
      }

      return {
        status: "resolved",
        tournament: resolution.tournament,
      };
    }

    // 4. If status is "not_found" (user did not mention a tournament by name in this query):
    // Check conversation context: is there a confirmed tournament in session that is authorized?
    if (session.confirmedTournamentId && authorizedIds.includes(session.confirmedTournamentId)) {
      const confirmedTourney = authorizedList.find((t) => t.id === session.confirmedTournamentId);
      if (confirmedTourney) {
        return {
          status: "resolved",
          tournament: {
            id: confirmedTourney.id,
            name: confirmedTourney.name,
            city: (confirmedTourney as any).city ?? undefined,
          },
        };
      }
    }

    // If only 1 authorized tournament exists for this user, automatically bind to it!
    if (authorizedList.length === 1) {
      const single = authorizedList[0];
      return {
        status: "resolved",
        tournament: {
          id: single.id,
          name: single.name,
          city: (single as any).city ?? undefined,
        },
      };
    }

    // If multiple authorized tournaments exist, ask user to disambiguate which one they mean
    const tourneyOptions = authorizedList.map((t, idx) => `${idx + 1}. ${t.name}`).join("\n");
    const clarificationMsg =
      currentLanguage === "english"
        ? `You are associated with multiple tournaments. Which tournament are you asking about?\n${tourneyOptions}`
        : `Aap ek se zyada tournaments se jude hain. Kripya batayein aap kis tournament ke baare mein puch rahe hain?\n${tourneyOptions}`;

    return {
      status: "clarification",
      message: clarificationMsg,
    };
  }

  /**
   * Context-aware deterministic fallback reply.
   *
   * CRITICAL CONTRACT:
   * The generic 10-line BIDWAR overview brochure is ONLY returned for explicit product/pricing inquiries.
   * Casual conversations, greetings, bot feedback, audio fallbacks, and unclear queries receive
   * their respective conversational responses and NEVER default to marketing dumps.
   */
  public buildFallbackReply(
    userQuery: string,
    context?: AssistantUserContext,
    session?: GuestSessionPayload
  ): string {
    if (context?.operationalDataContext) {
      return context.operationalDataContext;
    }

    const clean = (userQuery ?? "").trim();
    const lang = context?.preferredLanguage ?? session?.languagePreference;
    const isHindi = lang ? lang !== "english" : /(?:hai|karein|karna|chahiye|aap|karo|batao|dhanyawad|shukriya|mujhe|kaise|bhai)/i.test(clean);
    const isReturning = (context?.turnCount ?? 0) > 0;

    // 0. Empty query (e.g. voice note where transcription was unavailable)
    if (!clean || clean.length === 0) {
      return audioTranscriptionService.buildUnclearAudioReply(lang);
    }

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
    if (/\b(?:thanks,?\s*ho\s+gaya|thanks\s+ho\s+gaya|thank\s+you|shukriya|dhanyawad)\b/i.test(clean)) {
      return isHindi
        ? "Bahut badhiya! Agar aage kisi step mein help chahiye ho toh bataiyega."
        : "You're very welcome! Feel free to ask if you need help with any other step.";
    }

    // 3. Bot Feedback / Repetition Complaint
    if (
      /\b(?:tumhare\s+paas\s+(?:koi\s+)?(?:aur\s+)?response\s+nahi\s+hai|koi\s+aur\s+response|baar\s*baar\s+wahi|bar\s*bar\s+wahi|same\s+response|repetitive|kuch\s+aur\s+bolo)\b/i.test(clean)
    ) {
      return conversationalIntelligence.handleBotFeedback(lang);
    }

    // 4. Casual Conversation ("Kya haal-chaal?", "Kaise ho?", "Bhai kya kar rahe ho?", "Aur batao")
    if (
      /\b(?:kya\s+haal[-\s]*chaal|kya\s+hal[-\s]*chal|haal\s*chaal|hal\s*chal|bhai\s+kya\s+kar\s+rahe|kya\s+kar\s+rahe\s+ho|tum\s+kaise\s+ho|kaise\s+ho|kaisa\s+hai|aur\s+batao|how\s+are\s+you|what's\s+up)\b/i.test(clean)
    ) {
      return conversationalIntelligence.handleCasualConversation(clean, lang);
    }

    // 5. Natural Greetings ("Hi", "Hello", "Good morning")
    if (/^(?:hi|hello|hey|namaste|pranam|namaskar|good\s+morning|good\s+afternoon|good\s+evening)$/i.test(clean)) {
      return conversationalIntelligence.handleGreeting(clean, lang);
    }

    // 6. Name Change / Profile Update
    if (/\b(?:change\s+(?:my\s+)?name|update\s+(?:my\s+)?name|mera\s+naam|naam\s+badal|naam\s+change)\b/i.test(clean)) {
      const extractedName = conversationalIntelligence.extractRequestedName(clean);
      if (!extractedName) {
        return isHindi
          ? "Aap apna naya naam kya rakhna chahte hain? Kripya batayein (jaise: 'Mera naam Shanu kar do')."
          : "What name would you like to update to? Please reply with your desired name (for example: 'Change my name to Shanu').";
      }
      return isHindi
        ? "Aapka mobile number kisi registered BidWar account se linked nahi hai. Profile name update karne ke liye kripya apne registered phone number se message karein ya bidwar.in par sign up karein."
        : "Your phone number is not linked to an active BidWar account. To update your profile name, please message from your registered phone number or sign up at https://bidwar.in.";
    }

    // 7. Follow-Up ("Aur batao", "explain more") on returning turn
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

    // 8. Explicit BIDWAR Product / Features / Pricing Inquiry
    // ONLY send the comprehensive brochure when the user explicitly asks what is BidWar or asks about features/plans!
    const isExplicitBidwarQuery =
      /\b(?:what\s+is\s+bidwar|bidwar\s+kya\s+hai|bidwar\s+ke\s+baare\s+mein|features\s+kya\s+hain|what\s+are\s+the\s+features|pricing\s+kya\s+hai|pricing|plans|cost|rate\s+kya\s+hai|kaise\s+use\s+karein|how\s+to\s+use|how\s+do\s+i\s+use)\b/i.test(clean);

    if (isExplicitBidwarQuery) {
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

    // 9. Unknown / Unclear message: ask polite clarification question.
    // NEVER send the product brochure as universal fallback!
    return conversationalIntelligence.handleUnknownUnclear(lang);
  }
}

function cleanRawWithoutPlayer(text: string, playerName: string): string {
  return text.replace(new RegExp(`\\b${playerName}\\b`, "gi"), "").trim();
}

export const guestAssistantService = new GuestAssistantService();
export const bidwarAssistantService = guestAssistantService;
