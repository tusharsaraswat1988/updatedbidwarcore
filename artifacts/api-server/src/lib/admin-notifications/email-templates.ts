import {
  BIDWAR_BODY_FONT,
  BIDWAR_EMAIL_COLORS as C,
  BIDWAR_FONT_STACK,
  escapeHtml,
} from "../notifications/templates/email-branding.js";
import { bidwarCtaButton, wrapBidWarEmailShell } from "../notifications/templates/base-layout.js";
import type { AdminNotificationEventType, AdminNotificationPayloadMap } from "./types.js";

type DetailRow = { label: string; value: string };

function detailTable(rows: DetailRow[]): string {
  const cells = rows
    .map(
      (row) => `<tr>
        <td class="detail-label" style="padding:10px 0;font-family:${BIDWAR_BODY_FONT};font-size:13px;font-weight:600;color:${C.mutedDark};width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td class="detail-value" style="padding:10px 0;font-family:${BIDWAR_BODY_FONT};font-size:14px;color:${C.foreground};vertical-align:top;">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.border};margin-top:8px;">
    ${cells}
  </table>`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function buildBodyHtml(params: {
  headline: string;
  intro: string;
  rows: DetailRow[];
  timestamp: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return `<tr>
    <td class="email-pad" style="padding:28px 32px 8px;">
      <p style="margin:0 0 8px;font-family:${BIDWAR_FONT_STACK};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.primary};">Admin Alert</p>
      <h1 class="hero-title" style="margin:0 0 12px;font-family:${BIDWAR_FONT_STACK};font-size:28px;line-height:1.25;color:${C.foreground};letter-spacing:-0.02em;">${escapeHtml(params.headline)}</h1>
      <p style="margin:0 0 16px;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">${escapeHtml(params.intro)}</p>
      ${detailTable(params.rows)}
      <p style="margin:20px 0 0;font-family:${BIDWAR_BODY_FONT};font-size:12px;color:${C.mutedDark};">
        <strong style="color:${C.muted};">Timestamp:</strong> ${escapeHtml(formatTimestamp(params.timestamp))}
      </p>
    </td>
  </tr>
  <tr>
    <td class="email-pad" style="padding:8px 32px 28px;">
      ${bidwarCtaButton(params.ctaLabel, params.ctaUrl)}
    </td>
  </tr>`;
}

export function renderAdminNotificationEmail<E extends AdminNotificationEventType>(params: {
  eventType: E;
  payload: AdminNotificationPayloadMap[E];
  appUrl: string;
  logoUrl: string | null;
  brandName?: string;
}): { subject: string; html: string } {
  const appUrl = params.appUrl.replace(/\/$/, "");
  const adminDashboardUrl = `${appUrl}/admin`;

  if (params.eventType === "NEW_ORGANISER_REGISTERED") {
    const p = params.payload as AdminNotificationPayloadMap["NEW_ORGANISER_REGISTERED"];
    const subject = "New Organiser Registered — BIDWAR Admin";
    const html = wrapBidWarEmailShell({
      preheader: `${p.name} just registered on BIDWAR`,
      title: subject,
      appUrl,
      logoUrl: params.logoUrl,
      brandName: params.brandName,
      bodyHtml: buildBodyHtml({
        headline: "New Organiser Registered",
        intro: "A new organiser account was created on the platform.",
        rows: [
          { label: "Organiser Name", value: p.name },
          { label: "Email", value: p.email ?? "Not provided" },
          { label: "Mobile", value: p.mobile },
          { label: "Company", value: p.company ?? "Not provided" },
          { label: "Registration Time", value: formatTimestamp(p.registeredAt) },
        ],
        timestamp: p.registeredAt,
        ctaLabel: "Open Admin Dashboard",
        ctaUrl: `${adminDashboardUrl}/organisers/${p.organizerId}`,
      }),
    });
    return { subject, html };
  }

  if (params.eventType === "NEW_TOURNAMENT_CREATED") {
    const p = params.payload as AdminNotificationPayloadMap["NEW_TOURNAMENT_CREATED"];
    const subject = `New Tournament: ${p.tournamentName} — BIDWAR Admin`;
    const html = wrapBidWarEmailShell({
      preheader: `${p.tournamentName} was created by ${p.organizerName ?? "an organiser"}`,
      title: subject,
      appUrl,
      logoUrl: params.logoUrl,
      brandName: params.brandName,
      bodyHtml: buildBodyHtml({
        headline: "New Tournament Created",
        intro: "An organiser has created a new tournament.",
        rows: [
          { label: "Tournament Name", value: p.tournamentName },
          { label: "Sport", value: p.sport },
          { label: "Organiser", value: p.organizerName ?? "Unknown" },
          { label: "City / Venue", value: p.city ?? "Not provided" },
          { label: "Created Time", value: formatTimestamp(p.createdAt) },
        ],
        timestamp: p.createdAt,
        ctaLabel: "View Tournament",
        ctaUrl: `${adminDashboardUrl}/tournaments/${p.tournamentId}`,
      }),
    });
    return { subject, html };
  }

  if (params.eventType === "CONTACT_FORM_SUBMISSION") {
    const p = params.payload as AdminNotificationPayloadMap["CONTACT_FORM_SUBMISSION"];
    const subject = `Contact Form: ${p.subject} (${p.referenceId})`;
    const html = wrapBidWarEmailShell({
      preheader: `New inquiry from ${p.name}`,
      title: subject,
      appUrl,
      logoUrl: params.logoUrl,
      brandName: params.brandName,
      bodyHtml: buildBodyHtml({
        headline: "New Contact Form Submission",
        intro: "Someone submitted the home page contact form.",
        rows: [
          { label: "Name", value: p.name },
          { label: "Mobile", value: p.mobile ?? "Not provided" },
          { label: "Email", value: p.email },
          { label: "Subject", value: p.subject },
          { label: "Type", value: p.inquiryType },
          { label: "Message", value: p.message },
        ],
        timestamp: p.submittedAt,
        ctaLabel: "Open Admin Dashboard",
        ctaUrl: adminDashboardUrl,
      }),
    });
    return { subject, html };
  }

  if (params.eventType === "EMAIL_SEND_FAILED") {
    const p = params.payload as AdminNotificationPayloadMap["EMAIL_SEND_FAILED"];
    const subject = "Email Delivery Failed — BIDWAR Admin";
    const html = wrapBidWarEmailShell({
      preheader: p.error,
      title: subject,
      appUrl,
      logoUrl: params.logoUrl,
      brandName: params.brandName,
      bodyHtml: buildBodyHtml({
        headline: "Email Sending Failed",
        intro: "An outbound admin notification email could not be delivered.",
        rows: [
          { label: "Context", value: p.context },
          { label: "Recipient", value: p.recipient ?? "Unknown" },
          { label: "Original Event", value: p.originalEventType ?? "N/A" },
          { label: "Error", value: p.error },
        ],
        timestamp: new Date().toISOString(),
        ctaLabel: "Review Notification Settings",
        ctaUrl: `${adminDashboardUrl}/settings/admin-notifications`,
      }),
    });
    return { subject, html };
  }

  if (params.eventType === "MISSING_CONFIGURATION") {
    const p = params.payload as AdminNotificationPayloadMap["MISSING_CONFIGURATION"];
    const subject = "Missing Configuration — BIDWAR Admin";
    const html = wrapBidWarEmailShell({
      preheader: p.missingKeys.join(", "),
      title: subject,
      appUrl,
      logoUrl: params.logoUrl,
      brandName: params.brandName,
      bodyHtml: buildBodyHtml({
        headline: "Missing Required Configuration",
        intro: p.context,
        rows: [{ label: "Missing Keys", value: p.missingKeys.join(", ") || "Unknown" }],
        timestamp: new Date().toISOString(),
        ctaLabel: "Open Admin Dashboard",
        ctaUrl: adminDashboardUrl,
      }),
    });
    return { subject, html };
  }

  const p = params.payload as AdminNotificationPayloadMap["DATABASE_FAILURE"];
  const subject = `${params.eventType.replaceAll("_", " ")} — BIDWAR Admin`;
  const html = wrapBidWarEmailShell({
    preheader: p.error,
    title: subject,
    appUrl,
    logoUrl: params.logoUrl,
    brandName: params.brandName,
    bodyHtml: buildBodyHtml({
      headline: params.eventType.replaceAll("_", " "),
      intro: "A critical system event requires your attention.",
      rows: [
        { label: "Context", value: p.context },
        { label: "Error", value: p.error },
      ],
      timestamp: new Date().toISOString(),
      ctaLabel: "Open Admin Dashboard",
      ctaUrl: adminDashboardUrl,
    }),
  });
  return { subject, html };
}
