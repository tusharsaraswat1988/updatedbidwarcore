import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConversationRouter } from "../src/lib/communication/conversation-router";
import * as commSender from "../src/lib/comm-sender";
import { db, tournamentsTable, botSessionsTable } from "@workspace/db";
import {
  guestAssistantService,
  guardrails,
  sessionManager,
  humanHandoff,
  buildAssistantSystemPrompt,
  AUTHORITATIVE_PRICING,
  SUPPORT_CONTACT,
  APPROVED_MEDIA_ASSETS,
  APPROVED_TUTORIAL_LINKS,
  type AssistantUserContext,
} from "../src/lib/communication/ai-assistant";

describe("BIDWAR WhatsApp Gemini Assistant — Product Intelligence & Support Architecture", () => {
  const router = new ConversationRouter();
  const TRIAL_ORGANIZER_MOBILE = "919876500001";
  const LICENSED_ORGANIZER_MOBILE = "919876500002";
  const GUEST_MOBILE = "919876500003";
  const MEMBER_MOBILE = "919876500004";

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = "mock-gemini-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.AI_ASSISTANT_ENABLED = "true";
    process.env.WHATSAPP_PROVIDER = "mock";
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();

    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
    vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    // Mock db.insert and db.delete for in-memory session resilience
    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: () => ({
        onConflictDoUpdate: async () => {},
        returning: async () => [{ id: 1, createdAt: new Date() }],
      }),
    })) as any);

    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {},
    })) as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();
  });

  // ─── 1. Trial Organizer Knowledge Boundary ──────────────────────────────────────
  describe("1. Trial Organizer Knowledge Boundary", () => {
    it("resolveAssistantUserContext classifies trial tournament holder as trial_organizer", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => [
            {
              id: 101,
              name: "Kanpur Champions Trophy",
              sport: "cricket",
              status: "setup",
              licenseStatus: "trial",
              adminLocked: false,
              auctionEnabled: true,
              scoringEnabled: true,
              scoringPhase: "disabled",
              licenseGrantedAt: null,
              featuresJson: null,
            },
          ],
        }),
      })) as any);

      const identity = {
        kind: "member" as const,
        member: { id: "mem_trial_1", displayName: "Vikas Dubey", primaryMobile: TRIAL_ORGANIZER_MOBILE } as any,
        roles: [{ id: 1, memberId: "mem_trial_1", role: "organizer", scope: "global", tournamentId: null } as any],
        links: [],
        tournamentIds: [101],
        isAmbiguous: false,
        displayName: "Vikas Dubey",
      };

      const context = await router.resolveAssistantUserContext(identity, TRIAL_ORGANIZER_MOBILE);
      expect(context.userCategory).toBe("trial_organizer");
      expect(context.displayName).toBe("Vikas Dubey");
      // Trial organizer MUST NOT receive authorized tournament data disclosure
      expect(context.authorizedTournaments).toBeUndefined();
    });

    it("provides general BidWar information, setup guidance, and auction/scoring workflows to Trial Organizer", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "member",
        member: { id: "mem_trial_1", displayName: "Vikas Dubey", primaryMobile: TRIAL_ORGANIZER_MOBILE } as any,
        roles: [{ id: 1, memberId: "mem_trial_1", role: "organizer", scope: "global", tournamentId: null } as any],
        links: [],
        tournamentIds: [101],
        isAmbiguous: false,
        displayName: "Vikas Dubey",
      });

      vi.spyOn(router, "resolveAssistantUserContext").mockResolvedValue({
        userCategory: "trial_organizer",
        displayName: "Vikas Dubey",
        mobile: TRIAL_ORGANIZER_MOBILE,
        isBeginner: true,
      });

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      let capturedSystemPrompt = "";
      vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
        models: {
          generateContent: vi.fn().mockImplementation((req: any) => {
            capturedSystemPrompt = req.config?.systemInstruction ?? "";
            return Promise.resolve({
              text: "BidWar par tournament setup karne ke liye 4 aasan steps hain: 1. Sign up karein, 2. Tournament create karein, 3. Teams aur players add karein, aur 4. 2 teams ke sath Free Trial test karein.",
            });
          }),
        },
      } as any);

      const res = await router.processInboundMessage({
        from: TRIAL_ORGANIZER_MOBILE,
        channel: "whatsapp",
        text: "How do I set up my cricket tournament and test the auction?",
        messageId: "wamid.TRIAL_SETUP_001",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(capturedSystemPrompt).toContain("TRIAL ORGANIZER");
      expect(capturedSystemPrompt).toContain("ZERO-DISCLOSURE POLICY");
      expect(capturedSystemPrompt).toContain("Free Trial allows up to 2 teams for free testing");
      expect(sendSpy.mock.calls[0][1]).toContain("Free Trial");
    });

    it("strictly blocks private tournament data disclosure to Trial Organizer merely because they created a trial tournament", () => {
      const trialContext: AssistantUserContext = {
        userCategory: "trial_organizer",
        displayName: "Vikas Dubey",
        mobile: TRIAL_ORGANIZER_MOBILE,
        isBeginner: true,
      };

      const prompt = buildAssistantSystemPrompt(trialContext);
      expect(prompt).toContain("TRIAL ORGANIZER");
      expect(prompt).toContain("ZERO-DISCLOSURE POLICY: Provide GENERAL BidWar product knowledge");
      expect(prompt).toContain("Do NOT disclose private tournament operational data (player telephone numbers, confidential bidding purse passwords, or internal IDs)");
      expect(prompt).toContain("PATH B");
    });
  });

  // ─── 2. Licensed Organizer Authorized Tournament Scope ──────────────────────────
  describe("2. Licensed Organizer Authorized Tournament Scope", () => {
    it("resolveAssistantUserContext verifies communication license and structures authorized tournament scope", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => [
            {
              id: 202,
              name: "Banaras Premier League 2026",
              sport: "cricket",
              status: "live",
              licenseStatus: "active",
              adminLocked: false,
              auctionEnabled: true,
              scoringEnabled: true,
              scoringPhase: "active",
              licenseGrantedAt: new Date(),
              featuresJson: { whatsappNotifications: true },
            },
          ],
        }),
      })) as any);

      const identity = {
        kind: "member" as const,
        member: { id: "mem_licensed_1", displayName: "Rajesh Khanna", primaryMobile: LICENSED_ORGANIZER_MOBILE } as any,
        roles: [{ id: 2, memberId: "mem_licensed_1", role: "organizer", scope: "tournament", tournamentId: 202 } as any],
        links: [],
        tournamentIds: [202],
        isAmbiguous: false,
        displayName: "Rajesh Khanna",
      };

      const context = await router.resolveAssistantUserContext(identity, LICENSED_ORGANIZER_MOBILE);
      expect(context.userCategory).toBe("licensed_organizer");
      expect(context.displayName).toBe("Rajesh Khanna");
      expect(context.authorizedTournaments).toBeDefined();
      expect(context.authorizedTournaments).toHaveLength(1);
      expect(context.authorizedTournaments![0].name).toBe("Banaras Premier League 2026");
      expect(context.authorizedTournaments![0].licenseStatus).toBe("licensed");
    });

    it("backend passes authorized tournament metadata to Gemini without allowing Gemini to decide permissions", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "member",
        member: { id: "mem_licensed_1", displayName: "Rajesh Khanna", primaryMobile: LICENSED_ORGANIZER_MOBILE } as any,
        roles: [{ id: 2, memberId: "mem_licensed_1", role: "organizer", scope: "tournament", tournamentId: 202 } as any],
        links: [],
        tournamentIds: [202],
        isAmbiguous: false,
        displayName: "Rajesh Khanna",
      });

      vi.spyOn(router, "resolveAssistantUserContext").mockResolvedValue({
        userCategory: "licensed_organizer",
        displayName: "Rajesh Khanna",
        mobile: LICENSED_ORGANIZER_MOBILE,
        authorizedTournaments: [
          {
            id: 202,
            name: "Banaras Premier League 2026",
            sport: "cricket",
            status: "live",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
        ],
        isBeginner: true,
      });

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      let capturedSystemPrompt = "";
      vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
        models: {
          generateContent: vi.fn().mockImplementation((req: any) => {
            capturedSystemPrompt = req.config?.systemInstruction ?? "";
            return Promise.resolve({
              text: "Aapka Banaras Premier League 2026 licensed tournament active hai. Aap live operator console aur 1080p LED display use kar sakte hain.",
            });
          }),
        },
      } as any);

      const res = await router.processInboundMessage({
        from: LICENSED_ORGANIZER_MOBILE,
        channel: "whatsapp",
        text: "How do I configure the 1080p LED display for Banaras Premier League?",
        messageId: "wamid.LICENSED_LED_001",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(capturedSystemPrompt).toContain("LICENSED ORGANIZER");
      expect(capturedSystemPrompt).toContain("Banaras Premier League 2026");
      expect(capturedSystemPrompt).toContain("ID: 202");
      expect(sendSpy.mock.calls[0][1]).toContain("Banaras Premier League 2026");
    });
  });

  // ─── 3. Beginner Organizer Guidance ─────────────────────────────────────────────
  describe("3. Beginner-Friendly Explanations & Step-by-Step Guidance", () => {
    it("system prompt explicitly instructs patient, beginner-friendly explanations without jargon", () => {
      const prompt = buildAssistantSystemPrompt({
        userCategory: "trial_organizer",
        displayName: "New Organizer",
        isBeginner: true,
      });

      expect(prompt).toContain("Beginner-Friendly Explanations: Never make the user feel inadequate, rejected, or abandoned for not knowing a technical feature");
      expect(prompt).toContain("Break complex workflows into simple, numbered steps");
      expect(prompt).toContain("Step 1: Sign Up Free");
      expect(prompt).toContain("Step 2: Create Tournament");
      expect(prompt).toContain("Step 3: Add Teams & Players");
      expect(prompt).toContain("Step 4: Run Free Trial");
    });

    it("explains auction and scoring features with respect and natural Hinglish", async () => {
      vi.spyOn(sessionManager, "getSession").mockResolvedValue({ messages: [] });
      vi.spyOn(sessionManager, "appendTurn").mockResolvedValue({ messages: [] });

      vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: "Namaste! BidWar me live auction conduct karna bohot aasan hai:\n1. Teams banayein aur squad budget set karein.\n2. Players ko QR code link share karein registration ke liye.\n3. Auction din par operator console se bids control karein aur TV/projector par 1080p LED stage screen lagayein.",
          }),
        },
      } as any);

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Mujhe bilkul idea nahi hai auction kaise karate hain, kya aap step by step bata sakte hain?",
      });

      expect(reply.text).toContain("Namaste!");
      expect(reply.text).toContain("operator console");
      expect(reply.text).toContain("1080p LED stage screen");
    });
  });

  // ─── 4. Out-of-Scope Questions (Path C) ──────────────────────────────────────────
  describe("4. Out-of-Scope Questions (Path C)", () => {
    it("prompt defines Path C to politely redirect general unrelated queries to BidWar", () => {
      const prompt = buildAssistantSystemPrompt();
      expect(prompt).toContain("PATH C — Question Outside BidWar");
      expect(prompt).toContain("Politely acknowledge and gently redirect the conversation back to BidWar sports auctions, live scoring, and tournament management");
    });

    it("redirects out-of-scope inquiry back to sports tournament management", async () => {
      vi.spyOn(sessionManager, "getSession").mockResolvedValue({ messages: [] });
      vi.spyOn(sessionManager, "appendTurn").mockResolvedValue({ messages: [] });

      vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: "Main BidWar sports auction aur scoring platform ka assistant hun. Main aapke sports tournaments, player auction aur live scoring me sahayata kar sakta hun. Kya aap kisi tournament ke bare me janna chahte hain?",
          }),
        },
      } as any);

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "What is the capital of France and what is the recipe for pasta?",
      });

      expect(reply.text).toContain("BidWar sports auction");
      expect(reply.text).toContain("tournaments");
    });
  });

  // ─── 5. Unknown BidWar Questions & Unlisted Features (Path B) ──────────────────
  describe("5. Unknown BidWar Questions & Custom Requirements (Path B)", () => {
    it("prompt defines Path B for unavailable info: polite limitation, gratitude, and support escalation", () => {
      const prompt = buildAssistantSystemPrompt();
      expect(prompt).toContain("PATH B — BidWar Question, but Answer Unavailable or Outside Authorized Scope");
      expect(prompt).toContain("Acknowledge the question with respect");
      expect(prompt).toContain("Appreciate the user's interest");
      expect(prompt).toContain("Explain the limitation politely without blaming the user");
      expect(prompt).toContain(`WhatsApp / Phone: ${SUPPORT_CONTACT.phone}`);
      expect(prompt).toContain(`Email: ${SUPPORT_CONTACT.email}`);
    });

    it("escalates unlisted custom enterprise league requirements to operations team", async () => {
      vi.spyOn(sessionManager, "getSession").mockResolvedValue({ messages: [] });
      vi.spyOn(sessionManager, "appendTurn").mockResolvedValue({ messages: [] });

      vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: `BidWar se judne aur aapke interest ke liye bahut shukriya! 50 teams ka custom corporate league setup hamari tournament operations team personally assist karti hai.\n\nAap directly connect kar sakte hain:\n📞 Call / WhatsApp: ${SUPPORT_CONTACT.phone}\n💬 WhatsApp Link: ${SUPPORT_CONTACT.whatsappUrl}\n📧 Email: ${SUPPORT_CONTACT.email}`,
          }),
        },
      } as any);

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Can BidWar host a 50 team national championship with custom API integrations?",
      });

      expect(reply.text).toContain(SUPPORT_CONTACT.phone);
      expect(reply.text).toContain(SUPPORT_CONTACT.whatsappUrl);
      expect(reply.text).toContain("shukriya");
    });
  });

  // ─── 6. Support-First Escalation ────────────────────────────────────────────────
  describe("6. Support-First Escalation Policy", () => {
    it("uses verified support contacts: phone +91 8707488250, wa.me link, and official email bidwarsupport@gmail.com", () => {
      expect(SUPPORT_CONTACT.phone).toBe("+91 8707488250");
      expect(SUPPORT_CONTACT.whatsappUrl).toBe("https://wa.me/918707488250");
      expect(SUPPORT_CONTACT.email).toBe("bidwarsupport@gmail.com");
    });

    it("human handoff reply demonstrates respect, gratitude, and direct escalation details", () => {
      const replyHindi = humanHandoff.buildHandoffReply("Mujhe support team se baat karni hai");
      expect(replyHindi).toContain("BidWar se judne aur aapke interest ke liye bahut shukriya");
      expect(replyHindi).toContain(SUPPORT_CONTACT.phone);
      expect(replyHindi).toContain(SUPPORT_CONTACT.whatsappUrl);
      expect(replyHindi).toContain(SUPPORT_CONTACT.email);

      const replyEnglish = humanHandoff.buildHandoffReply("I want to speak with a human agent");
      expect(replyEnglish).toContain("Thank you for reaching out and for your interest in BidWar");
      expect(replyEnglish).toContain(SUPPORT_CONTACT.phone);
      expect(replyEnglish).toContain(SUPPORT_CONTACT.whatsappUrl);
      expect(replyEnglish).toContain(SUPPORT_CONTACT.email);
    });
  });

  // ─── 7. Pricing Accuracy & Single Source of Truth ───────────────────────────────
  describe("7. Pricing Accuracy & Single Source of Truth", () => {
    it("contains authoritative 7-tier pricing without unauthorized promotional discounts", () => {
      const tiers = AUTHORITATIVE_PRICING.map((p) => p.price);
      expect(tiers).toEqual([0, 5000, 6000, 8000, 9000, 11000, 12000]);
    });

    it("guardrail corrects unverified pricing amounts into authoritative pricing link", () => {
      const unverified = "You can get the Pro plan for ₹4,500!";
      const sanitized = guardrails.sanitizeOutbound(unverified);
      expect(sanitized.sanitizedText).not.toContain("₹4,500");
      expect(sanitized.sanitizedText).toContain("authoritative pricing");
    });

    it("guardrail allows authorized pricing amounts", () => {
      const verified = "Starter is ₹5,000 and Pro is ₹6,000 and Elite is ₹9,000.";
      const sanitized = guardrails.sanitizeOutbound(verified);
      expect(sanitized.sanitizedText).toContain("₹5,000");
      expect(sanitized.sanitizedText).toContain("₹6,000");
      expect(sanitized.sanitizedText).toContain("₹9,000");
    });
  });

  // ─── 8. Member Privacy & Security ───────────────────────────────────────────────
  describe("8. Member Privacy & Security", () => {
    it("DATA command strictly restricts private data for guest users", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: GUEST_MOBILE,
        displayName: "Guest",
      });

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "DATA",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0][1]).toContain("Access Restricted: Aapka number kisi private tournament ya team se linked nahi hai");
    });

    it("whitelists verified BidWar assets and YouTube tutorials while stripping unverified URLs", () => {
      const input = `Learn setup at ${APPROVED_TUTORIAL_LINKS.academy} or view our LED screen at ${APPROVED_MEDIA_ASSETS.liveLedScreen} and see malware at https://malicious-site.com/steal`;
      const result = guardrails.sanitizeOutbound(input);

      expect(result.sanitizedText).toContain(APPROVED_TUTORIAL_LINKS.academy);
      expect(result.sanitizedText).toContain(APPROVED_MEDIA_ASSETS.liveLedScreen);
      expect(result.sanitizedText).not.toContain("https://malicious-site.com");
      expect(result.sanitizedText).toContain("https://bidwar.in");
    });
  });

  // ─── 9. STOP / Consent Compliance ───────────────────────────────────────────────
  describe("9. STOP / Opt-Out & Consent Handling", () => {
    it("STOP command universally revokes consent across records without calling Gemini", async () => {
      const revokeSpy = vi.spyOn(router, "revokeConsentAcrossRecords").mockResolvedValue();
      const aiSpy = vi.spyOn(guestAssistantService, "handleMessage");
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "STOP",
        messageId: "wamid.STOP_REGRESSION_001",
      });

      expect(res.handled).toBe(true);
      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(aiSpy).not.toHaveBeenCalled();
      expect(sendSpy.mock.calls[0][1]).toContain("unsubscribe ho gaye hain");
    });

    it("NO / DECLINE command marks refusal and suppresses notifications", async () => {
      const revokeSpy = vi.spyOn(router, "revokeConsentAcrossRecords").mockResolvedValue();
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "NO",
        messageId: "wamid.NO_REGRESSION_001",
      });

      expect(res.handled).toBe(true);
      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0][1]).toContain("decision note kar liya gaya hai");
    });
  });

  // ─── 10. Conversation Context & Greeting De-duplication ─────────────────────────
  describe("10. Conversation Context & Greeting De-Duplication", () => {
    it("system prompt contains greeting instruction for turn 0 and instructs de-duplication for turn > 0", () => {
      const promptTurn0 = buildAssistantSystemPrompt({
        userCategory: "guest",
        displayName: "Guest",
        turnCount: 0,
      });
      expect(promptTurn0).toContain("NEW CONVERSATION GREETING:");
      expect(promptTurn0).toContain("Greet warmly with genuine respect and gratitude");

      const promptTurn2 = buildAssistantSystemPrompt({
        userCategory: "guest",
        displayName: "Guest",
        turnCount: 2,
      });
      expect(promptTurn2).toContain("RETURNING USER IN ONGOING SESSION (Turn 3):");
      expect(promptTurn2).toContain("DO NOT repeat introductory greetings like \"Namaste! Main BidWar assistant hun...\"");
    });

    it("fallback reply avoids repeating full introductory welcome in ongoing conversation session", () => {
      const firstTurnFallback = guestAssistantService.buildFallbackReply("kaise use karein?", {
        userCategory: "guest",
        turnCount: 0,
      });
      expect(firstTurnFallback).toContain("Namaste! BidWar me aapka swagat hai");

      const returningFallback = guestAssistantService.buildFallbackReply("kaise use karein?", {
        userCategory: "guest",
        turnCount: 2,
      });
      expect(returningFallback).not.toContain("Namaste! BidWar me aapka swagat hai");
      expect(returningFallback).toContain("BidWar sports auction aur scoring par aapka sawal mila hai");
    });
  });

  // ─── 11. Legacy Command Compatibility ───────────────────────────────────────────
  describe("11. Legacy Command Compatibility", () => {
    it("preserves BPL command deterministic public lookup", async () => {
      vi.spyOn(router, "getPublicBplInfo").mockResolvedValue("🏆 BPL Edition 2026: Live Stream at https://bidwar.in");
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "BPL",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy.mock.calls[0][1]).toContain("BPL Edition 2026");
    });

    it("preserves SCORES command deterministic public match lookup", async () => {
      vi.spyOn(router, "getPublicLiveScores").mockResolvedValue("🏏 Current Live Matches:\n• Match #1: Tigers vs Lions (Live)");
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "SCORES",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy.mock.calls[0][1]).toContain("Tigers vs Lions");
    });

    it("preserves HELP command deterministic menu output", async () => {
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "HELP",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy.mock.calls[0][1]).toContain("BidWar Bot Commands");
      expect(sendSpy.mock.calls[0][1]).toContain(SUPPORT_CONTACT.phone);
      expect(sendSpy.mock.calls[0][1]).toContain(SUPPORT_CONTACT.email);
    });
  });
});
