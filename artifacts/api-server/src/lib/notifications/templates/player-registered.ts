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
import { wrapBidWarEmailShell } from "./base-layout";

export type PlayerRegisteredTemplateParams = {
  playerName: string;
  photoUrl: string | null;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  paymentPending: boolean;
  appUrl: string;
  bidwarLogoUrl?: string | null;
  brandName?: string;
  poweredByText?: string;
};

function playerPhotoBlock(photoUrl: string | null, playerName: string): string {
  const safeName = escapeHtml(playerName);
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

function tournamentHeaderBlock(params: PlayerRegisteredTemplateParams): string {
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
            <p style="margin:0 0 4px;font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${C.primary};">Player Registration</p>
            <p style="margin:0;font-family:${BIDWAR_FONT_STACK};font-size:22px;font-weight:700;color:${C.foreground};letter-spacing:-0.02em;">${tournamentName}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function poweredByFooter(params: PlayerRegisteredTemplateParams): string {
  const appUrl = normalizeAppUrl(params.appUrl);
  const bidwarLogo = resolveEmailLogoUrl(appUrl, params.bidwarLogoUrl);
  const brand = escapeHtml(params.brandName ?? "BidWar");
  const poweredBy = escapeHtml(params.poweredByText ?? "Powered by BidWar");
  const safeLogo = escapeHtml(bidwarLogo);
  const home = escapeHtml(BIDWAR_WEBSITE_URL);

  return `<tr>
    <td style="background:${C.surface};border-top:1px solid ${C.border};padding:24px 32px 28px;text-align:center;">
      <a href="${home}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
        <img
          src="${safeLogo}"
          width="36"
          height="36"
          alt="${brand}"
          style="display:block;width:36px;height:36px;margin:0 auto 10px;border:0;border-radius:8px;"
        />
      </a>
      <p style="margin:0 0 16px;font-family:${BIDWAR_BODY_FONT};font-size:12px;line-height:1.5;color:${C.muted};">
        ${poweredBy.replace(/BidWar|BIDWAR/gi, () => bidwarAnchor("BidWar"))}
      </p>
      <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:11px;line-height:1.55;color:${C.mutedDark};">
        This mail is powered by ${bidwarAnchor("BIDWAR")}
      </p>
    </td>
  </tr>`;
}

export function playerRegisteredEmail(params: PlayerRegisteredTemplateParams): {
  subject: string;
  html: string;
} {
  const firstName = params.playerName.trim().split(/\s+/)[0] || params.playerName;
  const greeting = escapeHtml(firstName);
  const tournamentName = escapeHtml(params.tournamentName);

  const messageHtml = params.paymentPending
    ? `<p style="margin:0 0 12px;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">
        Thank you for registering as a player for <strong style="color:${C.foreground};">${tournamentName}</strong>.
        Your registration has been received and your payment is pending verification by the tournament organizer.
      </p>
      <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">
        Once verified, the organizer will contact you with further details about the player auction and tournament schedule.
      </p>`
    : `<p style="margin:0 0 12px;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">
        Congratulations! Your registration for <strong style="color:${C.foreground};">${tournamentName}</strong> has been successfully received.
      </p>
      <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">
        The tournament organizer will review your profile and contact you with further details regarding the player auction and next steps.
      </p>`;

  const bodyHtml = `
  ${tournamentHeaderBlock(params)}

  <!-- Success hero -->
  <tr>
    <td class="email-pad" style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, rgba(34,197,94,0.12) 0%, ${C.surfaceElevated} 100%);">
        <tr>
          <td align="center" style="padding:32px 32px 24px;">
            <span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid rgba(34,197,94,0.35);background:rgba(34,197,94,0.1);font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${C.success};">
              ${params.paymentPending ? "Registration Submitted" : "Registration Confirmed"}
            </span>
            <h1 class="hero-title" style="margin:16px 0 0;font-family:${BIDWAR_FONT_STACK};font-size:28px;line-height:1.2;font-weight:700;color:${C.foreground};letter-spacing:-0.03em;">
              You&apos;re Registered!
            </h1>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Player greeting with photo -->
  <tr>
    <td class="email-pad" style="padding:28px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${playerPhotoBlock(params.photoUrl, params.playerName)}
          <td valign="top">
            <p style="margin:0 0 8px;font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.6;color:${C.foreground};font-weight:600;">Hi ${greeting},</p>
            ${messageHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Tournament summary card -->
  <tr>
    <td class="email-pad" style="padding:24px 32px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.borderGold};border-radius:14px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 6px;font-family:${BIDWAR_BODY_FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${C.mutedDark};">Tournament</p>
            <p style="margin:0 0 12px;font-family:${BIDWAR_FONT_STACK};font-size:18px;font-weight:700;color:${C.foreground};">${tournamentName}</p>
            <p style="margin:0;font-family:${BIDWAR_BODY_FONT};font-size:13px;line-height:1.55;color:${C.muted};">
              Player auctions on ${bidwarAnchor()} — India&apos;s live sports auction platform.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  const preheader = params.paymentPending
    ? `Your registration for ${params.tournamentName} is received. Payment verification is pending.`
    : `You're registered for ${params.tournamentName}. The organizer will contact you with next steps.`;

  const shell = wrapBidWarEmailShell({
    preheader,
    title: `Registration — ${params.tournamentName}`,
    appUrl: normalizeAppUrl(params.appUrl),
    logoUrl: params.bidwarLogoUrl,
    brandName: params.brandName,
    includeDefaultHeader: false,
    includeDefaultFooter: false,
    bodyHtml: `${bodyHtml}${poweredByFooter(params)}`,
  });

  return {
    subject: params.paymentPending
      ? `Registration received — ${params.tournamentName}`
      : `You're registered — ${params.tournamentName}`,
    html: shell,
  };
}
