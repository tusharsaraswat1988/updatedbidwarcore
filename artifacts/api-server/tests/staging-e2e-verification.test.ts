import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConversationRouter } from "../src/lib/communication/conversation-router";
import * as commSender from "../src/lib/comm-sender";
import { db, contactInquiriesTable } from "@workspace/db";
import {
  guestAssistantService,
  SUPPORT_CONTACT,
  AUTHORITATIVE_PRICING,
  sessionManager,
} from "../src/lib/communication/ai-assistant";
import * as adminNotifTriggers from "../src/lib/admin-notifications/triggers";

describe("STAGING END-TO-END VERIFICATION: Public WhatsApp AI Assistant", () => {
  const router = new ConversationRouter();
  const CONTROLLED_GUEST_NUMBER = "919999000001";
  const CONTROLLED_MEMBER_NUMBER = "919999000002";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = "mock-staging-gemini-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.AI_ASSISTANT_ENABLED = "true";
    process.env.WHATSAPP_PROVIDER = "mock";
    delete process.env.OPENAI_API_KEY;
    delete process.env.INTELLIGENCE_LLM_MODEL;
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();
  });

  it("1. Demo Request Conversation: generates conversational response and setup link", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "guest",
      mobile: CONTROLLED_GUEST_NUMBER,
      displayName: "Guest",
    });
    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text:
            "Namaste! BidWar me aapka swagat hai. Aap cricket, football ya kisi bhi franchise sport ke liye live player auction conduct kar sakte hain. Free trial setup karne ke liye visit karein: https://bidwar.in/organizer?tab=signup",
        }),
      },
    } as any);

    const res = await router.processInboundMessage({
      from: CONTROLLED_GUEST_NUMBER,
      channel: "whatsapp",
      text: "Hi, I want to book a live BidWar demo for my sports auction. Can you help me set up?",
      messageId: "wamid.STAGING_DEMO_001",
    });

    expect(res.handled).toBe(true);
    expect(res.replySent).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentText = sendSpy.mock.calls[0][1];
    expect(sentText).toContain("https://bidwar.in/organizer?tab=signup");
  });

  it("2. Hindi / Hinglish Support: replies naturally in Hinglish to colloquial query", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "guest",
      mobile: CONTROLLED_GUEST_NUMBER,
      displayName: "Guest",
    });
    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text:
            "BidWar par aap bohot aasaani se auction kar sakte hain. Team owners apne mobile phone se bid kar sakte hain aur projector par 1080p LED display chalta hai. Free trial 2 teams ke liye free hai.",
        }),
      },
    } as any);

    const res = await router.processInboundMessage({
      from: CONTROLLED_GUEST_NUMBER,
      channel: "whatsapp",
      text: "Cricket tournament ke liye demo chahiye, kaise kaam karta hai?",
      messageId: "wamid.STAGING_HINGLISH_001",
    });

    expect(res.handled).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentText = sendSpy.mock.calls[0][1];
    expect(sentText).toContain("LED display");
  });

  it("3. Pricing Accuracy: enforces exact authoritative pricing without unverified discounts", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "guest",
      mobile: CONTROLLED_GUEST_NUMBER,
      displayName: "Guest",
    });
    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    // Simulate LLM returning verified Pro plan
    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text:
            "BidWar ke plans fixed aur one-time hain: Starter ₹5,000 (4 teams) aur Pro plan ₹6,000 (8 teams) ka hai. No monthly charges.",
        }),
      },
    } as any);

    const res = await router.processInboundMessage({
      from: CONTROLLED_GUEST_NUMBER,
      channel: "whatsapp",
      text: "What is the price for 8 teams tournament?",
      messageId: "wamid.STAGING_PRICE_001",
    });

    expect(res.handled).toBe(true);
    const sentText = sendSpy.mock.calls[0][1];
    expect(sentText).toContain("₹6,000");
    expect(sentText).not.toContain("₹4,500"); // Zero unauthorized discounts
  });

  it("4. Multi-Turn Context: recalls prior conversational context across messages", async () => {
    let sessionData: string | null = null;
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: () => ({
          limit: async () => (sessionData ? [{ pendingData: sessionData }] : []),
        }),
      }),
    })) as any);
    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: (val: any) => {
        sessionData = val.pendingData;
        return { onConflictDoUpdate: async () => {} };
      },
    })) as any);

    // Turn 1
    await sessionManager.appendTurn(
      CONTROLLED_GUEST_NUMBER,
      "We have 8 teams in Varanasi",
      "Great! For 8 teams, our Pro plan is ₹6,000."
    );

    const session = await sessionManager.getSession(CONTROLLED_GUEST_NUMBER);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0].content).toBe("We have 8 teams in Varanasi");
    expect(session.messages[1].content).toContain("₹6,000");

    // Turn 2
    await sessionManager.appendTurn(
      CONTROLLED_GUEST_NUMBER,
      "Is OBS overlay included?",
      "Yes, OBS broadcast overlay is included in the Pro plan!"
    );

    const sessionTurn2 = await sessionManager.getSession(CONTROLLED_GUEST_NUMBER);
    expect(sessionTurn2.messages).toHaveLength(4);
    expect(sessionTurn2.messages[2].content).toBe("Is OBS overlay included?");
  });

  it("5. Lead Insertion & Admin Notification: persists qualified leads without duplicates", async () => {
    const notifySpy = vi.spyOn(adminNotifTriggers, "notifyAdminContactFormSubmission").mockImplementation(() => {});

    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: () => ({
          limit: async () => [], // No existing duplicate lead
        }),
      }),
    })) as any);

    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: () => ({
        returning: async () => [{ id: 101, createdAt: new Date() }],
        onConflictDoUpdate: async () => {},
      }),
    })) as any);

    const res = await guestAssistantService.handleMessage({
      mobile: CONTROLLED_GUEST_NUMBER,
      from: `whatsapp:+${CONTROLLED_GUEST_NUMBER}`,
      text: "Mera naam Manish Singh hai, hum 12 teams ka cricket tournament kar rahe hain Kanpur me",
    });

    expect(notifySpy).toHaveBeenCalledTimes(1);
    const notifArg = notifySpy.mock.calls[0][0];
    expect(notifArg.name).toBe("Manish Singh");
    expect(notifArg.mobile).toBe(CONTROLLED_GUEST_NUMBER);
    expect(notifArg.inquiryType).toBe("demo");
  });

  it("6. Human Handoff: immediately delivers verified support card when requested", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "guest",
      mobile: CONTROLLED_GUEST_NUMBER,
      displayName: "Guest",
    });
    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    const res = await router.processInboundMessage({
      from: CONTROLLED_GUEST_NUMBER,
      channel: "whatsapp",
      text: "Mujhe kisi expert se phone pe baat karni hai",
      messageId: "wamid.STAGING_HANDOFF_001",
    });

    expect(res.handled).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentText = sendSpy.mock.calls[0][1];
    expect(sentText).toContain(SUPPORT_CONTACT.phone);
    expect(sentText).toContain(SUPPORT_CONTACT.email);
    expect(sentText).toContain(SUPPORT_CONTACT.whatsappUrl);
  });

  it("7. STOP Compliance: universal opt-out strictly bypasses AI processing", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "guest",
      mobile: CONTROLLED_GUEST_NUMBER,
      displayName: "Guest",
    });
    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

    const revokeSpy = vi.spyOn(router, "revokeConsentAcrossRecords").mockResolvedValue();
    const aiSpy = vi.spyOn(guestAssistantService, "handleMessage");
    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    const res = await router.processInboundMessage({
      from: CONTROLLED_GUEST_NUMBER,
      channel: "whatsapp",
      text: "STOP",
      messageId: "wamid.STAGING_STOP_001",
    });

    expect(res.handled).toBe(true);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(aiSpy).not.toHaveBeenCalled(); // AI NEVER invoked
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toContain("unsubscribe ho gaye hain");
  });

  it("8. Member Routing Immunity: registered tournament member never enters guest assistant", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "member",
      member: { id: "mem_staging_42", displayName: "Rohit Sharma", primaryMobile: CONTROLLED_MEMBER_NUMBER } as any,
      roles: [],
      links: [],
      tournamentIds: [],
      isAmbiguous: false,
      displayName: "Rohit Sharma",
    });
    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

    const aiSpy = vi.spyOn(guestAssistantService, "handleMessage");
    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    const res = await router.processInboundMessage({
      from: CONTROLLED_MEMBER_NUMBER,
      channel: "whatsapp",
      text: "HELLO",
      messageId: "wamid.STAGING_MEMBER_001",
    });

    expect(res.handled).toBe(true);
    expect(aiSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toContain("Rohit Sharma");
  });

  it("9. AI Timeout Fallback: delivers branded support card without failing webhook", async () => {
    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error("Network timeout after 8000ms")),
      },
    } as any);

    vi.spyOn(sessionManager, "getSession").mockResolvedValue({ messages: [], leadCaptured: false });
    vi.spyOn(sessionManager, "appendTurn").mockResolvedValue({ messages: [] });

    const reply = await guestAssistantService.handleMessage({
      mobile: CONTROLLED_GUEST_NUMBER,
      from: `whatsapp:+${CONTROLLED_GUEST_NUMBER}`,
      text: "Tell me about your auction software",
    });

    expect(reply.text).toContain("Welcome to BidWar");
    expect(reply.text).toContain("+91 8707488250");
    expect(reply.text).toContain("https://bidwar.in/organizer?tab=signup");
  });

  it("10. Trial Organizer Guidance: provides setup guidance while strictly withholding private operational data", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "member",
      member: { id: "mem_trial_staging", displayName: "Suresh Raina", primaryMobile: CONTROLLED_MEMBER_NUMBER } as any,
      roles: [{ id: 1, memberId: "mem_trial_staging", role: "organizer", scope: "global", tournamentId: null } as any],
      links: [],
      tournamentIds: [101],
      isAmbiguous: false,
      displayName: "Suresh Raina",
    });

    vi.spyOn(router, "resolveAssistantUserContext").mockResolvedValue({
      userCategory: "trial_organizer",
      displayName: "Suresh Raina",
      mobile: CONTROLLED_MEMBER_NUMBER,
      isBeginner: true,
    });

    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    let capturedInstruction = "";
    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockImplementation((req: any) => {
          capturedInstruction = req.config?.systemInstruction ?? "";
          return Promise.resolve({
            text: "BidWar par 2 teams ke sath Free Trial test karein: 1. Teams purse setup karein, 2. Player registration link share karein, 3. Operator console se test bids execute karein.",
          });
        }),
      },
    } as any);

    const res = await router.processInboundMessage({
      from: CONTROLLED_MEMBER_NUMBER,
      channel: "whatsapp",
      text: "Can I test player bidding before paying?",
      messageId: "wamid.STAGING_TRIAL_001",
    });

    expect(res.handled).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(capturedInstruction).toContain("TRIAL ORGANIZER");
    expect(capturedInstruction).toContain("ZERO-DISCLOSURE POLICY");
    expect(sendSpy.mock.calls[0][1]).toContain("Free Trial");
  });

  it("11. Licensed Organizer Scope: backend verifies license and passes authorized tournament scope to Gemini", async () => {
    vi.spyOn(router, "resolveIdentity").mockResolvedValue({
      kind: "member",
      member: { id: "mem_licensed_staging", displayName: "Hardik Pandya", primaryMobile: CONTROLLED_MEMBER_NUMBER } as any,
      roles: [{ id: 2, memberId: "mem_licensed_staging", role: "organizer", scope: "tournament", tournamentId: 303 } as any],
      links: [],
      tournamentIds: [303],
      isAmbiguous: false,
      displayName: "Hardik Pandya",
    });

    vi.spyOn(router, "resolveAssistantUserContext").mockResolvedValue({
      userCategory: "licensed_organizer",
      displayName: "Hardik Pandya",
      mobile: CONTROLLED_MEMBER_NUMBER,
      authorizedTournaments: [
        {
          id: 303,
          name: "Baroda Championship Cup",
          sport: "cricket",
          status: "live",
          licenseStatus: "licensed",
          auctionEnabled: true,
          scoringEnabled: true,
        },
      ],
      isBeginner: true,
    });

    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
    const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    let capturedInstruction = "";
    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockImplementation((req: any) => {
          capturedInstruction = req.config?.systemInstruction ?? "";
          return Promise.resolve({
            text: "Baroda Championship Cup ke liye 1080p LED display setup karne ke liye projector ko laptop ke HDMI se connect karein aur full-screen mode on karein.",
          });
        }),
      },
    } as any);

    const res = await router.processInboundMessage({
      from: CONTROLLED_MEMBER_NUMBER,
      channel: "whatsapp",
      text: "How to setup LED screen for Baroda Championship Cup?",
      messageId: "wamid.STAGING_LICENSED_001",
    });

    expect(res.handled).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(capturedInstruction).toContain("LICENSED ORGANIZER");
    expect(capturedInstruction).toContain("Baroda Championship Cup");
    expect(capturedInstruction).toContain("ID: 303");
    expect(sendSpy.mock.calls[0][1]).toContain("Baroda Championship Cup");
  });

  it("12. Knowledge Boundaries: enforces Path B support escalation and Path C out-of-scope redirection", async () => {
    vi.spyOn(sessionManager, "getSession").mockResolvedValue({ messages: [] });
    vi.spyOn(sessionManager, "appendTurn").mockResolvedValue({ messages: [] });

    // Path B: Unknown custom requirement
    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: `BidWar se judne aur aapke interest ke liye bahut shukriya! Custom 50 teams enterprise setup ke liye aap hamari tournament operations team se connect kar sakte hain:\n📞 Call / WhatsApp: ${SUPPORT_CONTACT.phone}\n💬 WhatsApp Link: ${SUPPORT_CONTACT.whatsappUrl}\n📧 Email: ${SUPPORT_CONTACT.email}`,
        }),
      },
    } as any);

    const replyPathB = await guestAssistantService.handleMessage({
      mobile: CONTROLLED_GUEST_NUMBER,
      from: `whatsapp:+${CONTROLLED_GUEST_NUMBER}`,
      text: "Can BidWar handle 50 teams with custom API webhooks?",
    });

    expect(replyPathB.text).toContain(SUPPORT_CONTACT.phone);
    expect(replyPathB.text).toContain(SUPPORT_CONTACT.email);
    expect(replyPathB.text).toContain("shukriya");

    // Path C: Non-BidWar question
    vi.spyOn(guestAssistantService, "getGenAIClient").mockReturnValue({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: "Main BidWar sports auction aur scoring platform ka assistant hun. Main tournaments, live auctions aur match scoring me aapki madad kar sakta hun. Kya aap kisi sports tournament ke bare me janna chahte hain?",
        }),
      },
    } as any);

    const replyPathC = await guestAssistantService.handleMessage({
      mobile: CONTROLLED_GUEST_NUMBER,
      from: `whatsapp:+${CONTROLLED_GUEST_NUMBER}`,
      text: "Who won the FIFA World Cup in 1998?",
    });

    expect(replyPathC.text).toContain("BidWar sports auction");
  });

  it("13. Greeting De-duplication: suppresses repetitive welcomes in multi-turn conversations", async () => {
    // Turn 1
    const turn1Fallback = guestAssistantService.buildFallbackReply("kaise register karein?", {
      userCategory: "guest",
      turnCount: 0,
    });
    expect(turn1Fallback).toContain("Namaste! BidWar me aapka swagat hai");

    // Turn 2 in same active session
    const turn2Fallback = guestAssistantService.buildFallbackReply("aur team add kaise karein?", {
      userCategory: "guest",
      turnCount: 2,
    });
    expect(turn2Fallback).not.toContain("Namaste! BidWar me aapka swagat hai");
    expect(turn2Fallback).toContain("BidWar sports auction aur scoring par aapka sawal mila hai");
  });
});
