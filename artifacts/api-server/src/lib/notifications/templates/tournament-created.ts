import {
  BIDWAR_BODY_FONT,
  BIDWAR_EMAIL_COLORS as C,
  BIDWAR_FONT_STACK,
  escapeHtml,
  normalizeAppUrl,
  resolveTournamentDashboardUrl,
} from "./email-branding";
import {
  bidwarCtaButton,
  wrapBidWarEmailShell,
} from "./base-layout";

export type TournamentCreatedTemplateParams = {
  tournamentName: string;
  sport: string;
  auctionCode: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  venue: string | null;
  organizerName: string | null;
  appUrl: string;
  tournamentId?: number | null;
  logoUrl?: string | null;
  brandName?: string;
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

function formatSport(sport: string): string {
  return sport.charAt(0).toUpperCase() + sport.slice(1).replace(/_/g, " ");
}

function detailRow(label: string, value: string, isLast = false): string {
  const border = isLast ? "none" : `1px solid ${C.border}`;
  return `<tr>
    <td class="detail-label" style="padding:14px 0;border-bottom:${border};font-family:${BIDWAR_BODY_FONT};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${C.mutedDark};width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td class="detail-value" style="padding:14px 0;border-bottom:${border};font-family:${BIDWAR_BODY_FONT};font-size:15px;font-weight:600;color:${C.foreground};vertical-align:top;">${value}</td>
  </tr>`;
}

const NEXT_STEPS = [
  "Add Teams",
  "Add Players",
  "Configure Auction Rules",
  "Invite Team Owners",
] as const;

export function tournamentCreatedEmail(params: TournamentCreatedTemplateParams): {
  subject: string;
  html: string;
} {
  const firstName = params.organizerName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
  const tournamentName = escapeHtml(params.tournamentName);
  const sport = escapeHtml(formatSport(params.sport));
  const auctionCode = params.auctionCode
    ? `<span style="font-family:Menlo,Consolas,monospace;font-size:15px;font-weight:700;color:${C.primary};letter-spacing:0.12em;">${escapeHtml(params.auctionCode)}</span>`
    : escapeHtml("—");
  const auctionWhen = escapeHtml(
    `${formatDate(params.auctionDate)}${params.auctionTime ? ` · ${params.auctionTime}` : ""}`,
  );
  const dashboardUrl = resolveTournamentDashboardUrl(params.appUrl, params.tournamentId);

  const venueRow = params.venue
    ? detailRow("Venue", escapeHtml(params.venue), true)
    : detailRow("Venue", `<span style="color:${C.muted};">Not set yet</span>`, true);

  const nextStepsHtml = NEXT_STEPS.map(
    (step) => `<tr>
      <td style="padding:6px 0;font-family:${BIDWAR_BODY_FONT};font-size:14px;line-height:1.5;color:${C.muted};">
        <span style="color:${C.success};font-weight:700;margin-right:8px;">&#10003;</span>${escapeHtml(step)}
      </td>
    </tr>`,
  ).join("");

  const bodyHtml = `
  <!-- Hero celebration -->
  <tr>
    <td class="email-pad" style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, ${C.primaryGlow} 0%, ${C.surfaceElevated} 100%);">
        <tr>
          <td align="center" style="padding:36px 32px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:16px;">
                  <span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid ${C.borderGold};background:${C.primaryGlow};font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${C.primary};">Tournament Created</span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <h1 class="hero-title" style="margin:0;font-family:${BIDWAR_FONT_STACK};font-size:30px;line-height:1.15;font-weight:700;color:${C.foreground};letter-spacing:-0.03em;">
                    &#127942; Your Tournament Is Now Live on BidWar!
                  </h1>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:14px;">
                  <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:16px;line-height:1.6;color:${C.muted};max-width:440px;">
                    Get ready to build teams, invite owners, and run an unforgettable live auction.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td class="email-pad" style="padding:28px 32px 0;">
      <p style="margin:0 0 8px;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.6;color:${C.foreground};font-weight:600;">${greeting}</p>
      <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">
        <strong style="color:${C.foreground};">${tournamentName}</strong> is set up and ready on your organiser dashboard. Your auction command centre is waiting — let&apos;s make it legendary.
      </p>
    </td>
  </tr>

  <!-- Premium tournament card -->
  <tr>
    <td class="email-pad" style="padding:24px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.borderGold};border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;border-bottom:1px solid ${C.border};background:linear-gradient(90deg, ${C.primaryGlow} 0%, transparent 100%);">
            <p style="margin:0 0 4px;font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${C.primary};">Your Tournament</p>
            <p style="margin:0;font-family:${BIDWAR_FONT_STACK};font-size:20px;font-weight:700;color:${C.foreground};letter-spacing:-0.02em;">${tournamentName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 20px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${detailRow("Sport", sport)}
              ${detailRow("Auction Code", auctionCode)}
              ${detailRow("Auction Date", auctionWhen)}
              ${venueRow}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Next steps -->
  <tr>
    <td class="email-pad" style="padding:28px 32px 0;">
      <p style="margin:0 0 12px;font-family:${BIDWAR_FONT_STACK};font-size:14px;font-weight:700;color:${C.foreground};letter-spacing:-0.01em;">Your next steps</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;">
        <tr>
          <td style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${nextStepsHtml}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td class="email-pad" style="padding:32px 32px 36px;">
      ${bidwarCtaButton("Open Tournament Dashboard", dashboardUrl)}
      <p style="margin:16px 0 0;text-align:center;font-family:${BIDWAR_BODY_FONT};font-size:12px;line-height:1.5;color:${C.mutedDark};">
        Opens your tournament hub — teams, players, auction settings &amp; owner links.
      </p>
    </td>
  </tr>`;

  const preheader = `${params.tournamentName} is live on BidWar.${params.auctionCode ? ` Auction code: ${params.auctionCode}.` : ""} Open your dashboard to continue setup.`;

  return {
    subject: `🏆 ${params.tournamentName} is live on BidWar`,
    html: wrapBidWarEmailShell({
      preheader,
      title: `${params.tournamentName} — Tournament Created`,
      appUrl: normalizeAppUrl(params.appUrl),
      logoUrl: params.logoUrl,
      brandName: params.brandName,
      footerNote: "You received this email because a tournament was created on your BidWar organiser account.",
      bodyHtml,
    }),
  };
}
