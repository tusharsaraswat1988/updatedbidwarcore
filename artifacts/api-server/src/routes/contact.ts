import { Router } from "express";
import { z } from "zod";
import { db, contactInquiriesTable } from "@workspace/db";
import { contactFormLimiter } from "../lib/rate-limiters";
import { logger } from "../lib/logger";
import { notifyAdminContactFormSubmission } from "../lib/admin-notifications/triggers.js";

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

function buildReferenceId(id: number): string {
  return `C${String(id).padStart(6, "0")}`;
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
  const submittedAt = created.createdAt?.toISOString() ?? new Date().toISOString();

  try {
    notifyAdminContactFormSubmission({
      inquiryId: created.id,
      referenceId,
      name: payload.fullName,
      email: payload.email,
      mobile: normalizedPhone,
      subject: payload.subject,
      message: payload.message,
      inquiryType: payload.inquiryType,
      submittedAt,
    });
  } catch (err) {
    logger.warn({ referenceId, err }, "Contact inquiry saved but admin notification failed");
  }

  res.status(201).json({
    success: true,
    referenceId,
    message: "Thanks! We received your message and will get back to you shortly.",
  });
});

export default router;
