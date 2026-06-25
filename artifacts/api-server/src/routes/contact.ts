import { Router } from "express";
import { z } from "zod";
import { db, contactInquiriesTable } from "@workspace/db";
import { contactFormLimiter } from "../lib/rate-limiters";
import { sendEmail } from "../lib/notifications/providers/email-provider";
import { logger } from "../lib/logger";

const router = Router();

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  inquiryType: z.enum(["demo", "pricing", "support", "partnership", "other"]),
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(10).max(3000),
  consent: z.literal(true),
});

function getSupportInbox(): string {
  return process.env.CONTACT_INBOX_EMAIL?.trim() || "bidwarsupport@gmail.com";
}

function buildReferenceId(id: number): string {
  return `C${String(id).padStart(6, "0")}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

router.post("/contact", contactFormLimiter, async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid form data", details: parsed.error.issues });
    return;
  }

  const payload = parsed.data;
  const normalizedPhone = payload.phone?.trim() || null;

  const [created] = await db
    .insert(contactInquiriesTable)
    .values({
      fullName: payload.fullName,
      email: payload.email,
      phone: normalizedPhone,
      inquiryType: payload.inquiryType,
      subject: payload.subject,
      message: payload.message,
      consent: "granted",
      status: "new",
      source: "website_contact_page",
    })
    .returning({
      id: contactInquiriesTable.id,
      createdAt: contactInquiriesTable.createdAt,
    });

  const referenceId = buildReferenceId(created.id);
  const supportInbox = getSupportInbox();

  const html = `
    <h2>New Contact Inquiry (${referenceId})</h2>
    <p><strong>Name:</strong> ${escapeHtml(payload.fullName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Phone:</strong> ${normalizedPhone ? escapeHtml(normalizedPhone) : "Not provided"}</p>
    <p><strong>Type:</strong> ${escapeHtml(payload.inquiryType)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(payload.message)}</pre>
    <p><strong>Received At:</strong> ${created.createdAt?.toISOString() ?? new Date().toISOString()}</p>
  `;

  const emailResult = await sendEmail({
    to: supportInbox,
    subject: `New contact inquiry ${referenceId}: ${payload.subject}`,
    html,
  });

  if (!emailResult.success) {
    logger.warn(
      { referenceId, error: emailResult.error },
      "Contact inquiry saved but support alert email failed",
    );
  }

  res.status(201).json({
    success: true,
    referenceId,
    message: "Thanks! We received your message and will get back to you shortly.",
  });
});

export default router;
