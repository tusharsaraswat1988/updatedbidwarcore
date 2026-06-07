import { wrapEmailLayout } from "./base-layout";

export type TournamentCreatedTemplateParams = {
  tournamentName: string;
  sport: string;
  auctionCode: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  venue: string | null;
  organizerName: string | null;
  appUrl: string;
};

function formatDate(date: string | null): string {
  if (!date) return "To be announced";
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export function tournamentCreatedEmail(params: TournamentCreatedTemplateParams): {
  subject: string;
  html: string;
} {
  const greeting = params.organizerName
    ? `Hi ${params.organizerName.trim().split(/\s+/)[0]},`
    : "Hi,";

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">Your tournament <strong>${params.tournamentName}</strong> has been created successfully on BidWar.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:40%;">Sport</td>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;">${params.sport}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">Auction code</td>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;">${params.auctionCode ?? "—"}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">Auction date</td>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;">${formatDate(params.auctionDate)}${params.auctionTime ? ` at ${params.auctionTime}` : ""}</td>
      </tr>
      ${params.venue ? `<tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;">Venue</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;">${params.venue}</td>
      </tr>` : ""}
    </table>
    <p style="margin:0;">Continue setting up teams, players, and auction rules from your tournament dashboard.</p>
  `;

  return {
    subject: `Tournament created: ${params.tournamentName}`,
    html: wrapEmailLayout({
      preheader: `${params.tournamentName} is ready on BidWar.${params.auctionCode ? ` Auction code: ${params.auctionCode}` : ""}`,
      title: "Tournament created",
      bodyHtml,
      ctaLabel: "Open Tournament",
      ctaUrl: `${params.appUrl}/tournament`,
      footerNote: "You received this email because a tournament was created on your BidWar account.",
    }),
  };
}
