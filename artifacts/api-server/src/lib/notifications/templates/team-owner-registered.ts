import {
  BIDWAR_BODY_FONT,
  BIDWAR_EMAIL_COLORS as C,
  BIDWAR_FONT_STACK,
  BIDWAR_WEBSITE_URL,
  bidwarAnchor,
  escapeHtml,
  normalizeAppUrl,
  resolveEmailLogoUrl,
} from "./email-branding";
import { bidwarCtaButton, wrapBidWarEmailShell } from "./base-layout";

export type TeamOwnerRegisteredTemplateParams = {
  ownerName: string;
  teamName: string;
  ownerPhotoUrl: string | null;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  ownerJoinUrl: string;
  appUrl: string;
  bidwarLogoUrl?: string | null;
  brandName?: string;
  poweredByText?: string;
};

function ownerPhotoBlock(photoUrl: string | null, ownerName: string): string {
  const safeName = escapeHtml(ownerName);
  if (photoUrl?.startsWith("https://")) {
    const safePhoto = escapeHtml(photoUrl);
    return `<td valign="top" style="width:88px;padding-right:20px;">
      <img
        src="${safePhoto}"
        width="72"
        height="72"
        alt="${safeName}"
        style="display:block;width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid ${C.borderGold};"
      />
    </td>`;
  }
  return `<td valign="top" style="width:88px;padding-right:20px;">
    <div style="width:72px;height:72px;border-radius:50%;background:${C.surface};border:2px solid ${C.borderGold};text-align:center;line-height:72px;font-family:${BIDWAR_FONT_STACK};font-size:28px;font-weight:700;color:${C.primary};">
      ${safeName.charAt(0).toUpperCase()}
    </div>
  </td>`;
}

function tournamentHeaderBlock(params: TeamOwnerRegisteredTemplateParams): string {
  const tournamentName = escapeHtml(params.tournamentName);
  const logoCell = params.tournamentLogoUrl?.startsWith("https://")
    ? `<td valign="middle" style="padding-right:14px;">
        <img
          src="${escapeHtml(params.tournamentLogoUrl)}"
          width="48"
          height="48"
          alt="${tournamentName}"
          style="display:block;width:48px;height:48px;border-radius:10px;object-fit:contain;border:1px solid ${C.border};background:${C.surface};"
        />
      </td>`
    : "";

  return `<tr>
    <td style="background:${C.surface};border-bottom:1px solid ${C.border};padding:22px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${logoCell}
          <td valign="middle">
            <p style="margin:0 0 4px;font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${C.primary};">Team Owner Registration</p>
            <p style="margin:0;font-family:${BIDWAR_FONT_STACK};font-size:22px;font-weight:700;color:${C.foreground};letter-spacing:-0.02em;">${tournamentName}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function poweredByFooter(params: TeamOwnerRegisteredTemplateParams): string {
  const appUrl = normalizeAppUrl(params.appUrl);
  const bidwarLogo = resolveEmailLogoUrl(appUrl, params.bidwarLogoUrl);
  const brand = escapeHtml(params.brandName ?? "BidWar");
  const poweredBy = escapeHtml(params.poweredByText ?? "Powered by BidWar");
  const safeLogo = escapeHtml(bidwarLogo);
  const home = escapeHtml(BIDWAR_WEBSITE_URL);

  return `<tr>
    <td style="background:${C.surface};border-top:1px solid ${C.border};padding:0;text-align:center;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surfaceElevated};border-bottom:1px solid ${C.border};">
        <tr>
          <td align="center" style="padding:20px 32px 22px;">
            <a href="${home}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
              <img
                src="${safeLogo}"
                width="48"
                height="48"
                alt="${brand}"
                style="display:block;width:48px;height:48px;margin:0 auto;border:0;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.35);"
              />
            </a>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:18px 32px 12px;">
            <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;line-height:1.5;color:${C.muted};">
              ${poweredBy.replace(/BidWar|BIDWAR/gi, () => bidwarAnchor("BIDWAR"))}
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 24px;">
            <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:11px;line-height:1.55;color:${C.mutedDark};">
              This mail is powered by ${bidwarAnchor("BIDWAR")}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function teamOwnerRegisteredEmail(params: TeamOwnerRegisteredTemplateParams): {
  subject: string;
  html: string;
} {
  const firstName = params.ownerName.trim().split(/\s+/)[0] || params.ownerName;
  const greeting = escapeHtml(firstName);
  const tournamentName = escapeHtml(params.tournamentName);
  const teamName = escapeHtml(params.teamName);
  const ownerJoinUrl = escapeHtml(params.ownerJoinUrl);

  const bodyHtml = `
  ${tournamentHeaderBlock(params)}

  <tr>
    <td class="email-pad" style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, rgba(251,191,36,0.12) 0%, ${C.surfaceElevated} 100%);">
        <tr>
          <td align="center" style="padding:32px 32px 24px;">
            <span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid rgba(251,191,36,0.35);background:rgba(251,191,36,0.1);font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${C.primary};">
              Team Registered
            </span>
            <h1 class="hero-title" style="margin:16px 0 0;font-family:${BIDWAR_FONT_STACK};font-size:28px;line-height:1.2;font-weight:700;color:${C.foreground};letter-spacing:-0.03em;">
              Welcome, Team Owner!
            </h1>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="email-pad" style="padding:28px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${ownerPhotoBlock(params.ownerPhotoUrl, params.ownerName)}
          <td valign="top">
            <p style="margin:0 0 8px;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.6;color:${C.foreground};font-weight:600;">Hi ${greeting},</p>
            <p style="margin:0 0 12px;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">
              You have been registered as the owner of <strong style="color:${C.foreground};">${teamName}</strong> for <strong style="color:${C.foreground};">${tournamentName}</strong>.
            </p>
            <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">
              Use the Owner App link below to get familiar with your bidding panel. Your tournament organiser will share your <strong style="color:${C.foreground};">access code before the auction</strong> — you will need it to join the live bidding session.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="email-pad" style="padding:24px 32px 8px;">
      ${bidwarCtaButton("Open Owner App", params.ownerJoinUrl)}
    </td>
  </tr>

  <tr>
    <td class="email-pad" style="padding:8px 32px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.borderGold};border-radius:14px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 6px;font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${C.mutedDark};">Owner App Link</p>
            <p style="margin:0 0 12px;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.5;word-break:break-all;">
              <a href="${ownerJoinUrl}" target="_blank" rel="noopener noreferrer" style="color:${C.primary};text-decoration:underline;">${ownerJoinUrl}</a>
            </p>
            <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:13px;line-height:1.55;color:${C.muted};">
              Save this link on your phone. When the auction begins, enter the access code provided by your organiser to start bidding.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  const preheader = `You're registered as team owner for ${params.tournamentName}. Open the Owner App — your organiser will share the access code before the auction.`;

  const shell = wrapBidWarEmailShell({
    preheader,
    title: `Team Owner — ${params.tournamentName}`,
    appUrl: normalizeAppUrl(params.appUrl),
    logoUrl: params.bidwarLogoUrl,
    brandName: params.brandName,
    includeDefaultHeader: false,
    includeDefaultFooter: false,
    bodyHtml: `${bodyHtml}${poweredByFooter(params)}`,
  });

  return {
    subject: `You're registered as team owner — ${params.tournamentName}`,
    html: shell,
  };
}
