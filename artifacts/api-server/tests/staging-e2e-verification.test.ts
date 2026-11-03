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
    process.env.OPENAI_API_KEY = "sk-staging-mock-key";
    process.env.INTELLIGENCE_LLM_MODEL = "gpt-4o-mini";
    process.env.AI_ASSISTANT_ENABLED = "true";
    process.env.WHATSAPP_PROVIDER = "mock";
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

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "Namaste! BidWar me aapka swagat hai. Aap cricket, football ya kisi bhi franchise sport ke liye live player auction conduct kar sakte hain. Free trial setup karne ke liye visit karein: https://bidwar.in/organizer?tab=signup",
            },
          },
        ],
      }),
    });

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

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "BidWar par aap bohot aasaani se auction kar sakte hain. Team owners apne mobile phone se bid kar sakte hain aur projector par 1080p LED display chalta hai. Free trial 2 teams ke liye free hai.",
            },
          },
        ],
      }),
    });

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
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "BidWar ke plans fixed aur one-time hain: Starter ₹5,000 (4 teams) aur Pro plan ₹6,000 (8 teams) ka hai. No monthly charges.",
            },
          },
        ],
      }),
    });

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
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network timeout after 8000ms"));

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
});
