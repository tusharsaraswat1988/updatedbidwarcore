import { Router } from "express";
import { z } from "zod";
import { db, contactInquiriesTable } from "@workspace/db";
import { contactFormLimiter } from "../lib/rate-limiters";
import { logger } from "../lib/logger";
import { notifyAdminContactFormSubmission } from "../lib/admin-notifications/triggers.js";
import { getAdminNotificationSettings, isValidAdminEmail } from "../lib/admin-notifications/settings-service.js";
import { sendEmail } from "../lib/notifications/providers/email-provider.js";
import { BIDWAR_SUPPORT_EMAIL, escapeHtml } from "../lib/notifications/templates/email-branding.js";

const router = Router();

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  inquiryType: z.enum(["demo", "pricing", "support", "partnership", "other"]),
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(10).max(3000),
  consent: z.literal(true),
  source: z.enum(["website_contact_page", "homepage_consultation"]).optional(),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  sport: z.string().trim().max(80).optional().or(z.literal("")),
  teamCount: z.string().trim().max(12).optional().or(z.literal("")),
  preferredContact: z.string().trim().max(40).optional().or(z.literal("")),
});

function detailLine(label: string, value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

function consultationHtml(rows: Array<{ label: string; value: string }>): string {
  const body = rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:700;">${escapeHtml(row.label)}</td><td style="padding:6px 0;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Arial,sans-serif;color:#111;"><h2 style="margin:0 0 12px;">Live consultation request</h2><table>${body}</table></div>`;
}

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
  const source = payload.source ?? "website_contact_page";
  const detailRows = [
    detailLine("City", payload.city),
    detailLine("Primary sport", payload.sport),
    detailLine("Number of teams", payload.teamCount),
    detailLine("Preferred contact", payload.preferredContact),
    detailLine("Tournament details", payload.message),
  ].filter((line): line is string => Boolean(line));
  const storedMessage =
    source === "homepage_consultation" && detailRows.length > 0
      ? detailRows.join("\n")
      : payload.message;

  const [created] = await db
    .insert(contactInquiriesTable)
    .values({
      fullName: payload.fullName,
      email: payload.email,
      phone: normalizedPhone,
      inquiryType: payload.inquiryType,
      subject: payload.subject,
      message: storedMessage,
      consent: "granted",
      status: "new",
      source,
    })
    .returning({
      id: contactInquiriesTable.id,
      createdAt: contactInquiriesTable.createdAt,
    });

  if (!created) {
    res.status(500).json({ error: "Could not save the consultation request." });
    return;
  }

  const referenceId = buildReferenceId(created.id);
  const submittedAt = created.createdAt?.toISOString() ?? new Date().toISOString();

  const notice = {
    inquiryId: created.id,
    referenceId,
    name: payload.fullName,
    email: payload.email,
    mobile: normalizedPhone,
    subject: payload.subject,
    message: storedMessage,
    inquiryType: payload.inquiryType,
    submittedAt,
  };

  let emailedSupport = false;
  if (source === "homepage_consultation") {
    const mailRows = [
      { label: "Name", value: payload.fullName },
      { label: "Mobile", value: normalizedPhone || "Not provided" },
      { label: "Email", value: payload.email },
      { label: "City", value: payload.city?.trim() || "Not provided" },
      { label: "Primary sport", value: payload.sport?.trim() || "Not provided" },
      { label: "Number of teams", value: payload.teamCount?.trim() || "Not provided" },
      { label: "Preferred contact", value: payload.preferredContact?.trim() || "Not provided" },
      { label: "Tournament details", value: payload.message.trim() || "Not provided" },
      { label: "Reference", value: referenceId },
    ];
    try {
      const mailed = await sendEmail({
        to: BIDWAR_SUPPORT_EMAIL,
        subject: `Live consultation: ${payload.fullName} (${referenceId})`,
        html: consultationHtml(mailRows),
      });
      emailedSupport = mailed.success === true && mailed.stub !== true;
      if (!emailedSupport) {
        logger.warn({ referenceId, error: mailed.error }, "Consultation email was not accepted");
      }
    } catch (err) {
      logger.warn({ referenceId, err }, "Consultation email failed");
    }
  }

  try {
    const settings = await getAdminNotificationSettings();
    const adminEmail = isValidAdminEmail(settings.adminEmail) ? settings.adminEmail.trim().toLowerCase() : "";
    const supportAlreadyMailed = emailedSupport && adminEmail === BIDWAR_SUPPORT_EMAIL.toLowerCase();
    notifyAdminContactFormSubmission(notice, { skipEmail: supportAlreadyMailed });
  } catch (err) {
    logger.warn({ referenceId, err }, "Contact inquiry saved but admin notification failed");
  }

  res.status(201).json({
    success: true,
    referenceId,
    emailDelivered: source === "homepage_consultation" ? emailedSupport : undefined,
    message: "Thanks! We received your message and will get back to you shortly.",
  });
});

export default router;
