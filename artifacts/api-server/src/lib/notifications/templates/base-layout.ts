import {
  BIDWAR_BODY_FONT,
  BIDWAR_EMAIL_COLORS as C,
  BIDWAR_FONT_LINK,
  BIDWAR_FONT_STACK,
  BIDWAR_SUPPORT_EMAIL,
  escapeHtml,
  normalizeAppUrl,
  resolveEmailLogoUrl,
} from "./email-branding";

export type EmailLayoutParams = {
  preheader?: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  appUrl?: string;
  logoUrl?: string | null;
  brandName?: string;
};

export type BidWarEmailShellParams = {
  preheader?: string;
  title: string;
  appUrl: string;
  logoUrl?: string | null;
  brandName?: string;
  bodyHtml: string;
  footerNote?: string;
  /** When false, omit the default BidWar wordmark header (body supplies its own). */
  includeDefaultHeader?: boolean;
  /** When false, omit the default support footer (body supplies its own). */
  includeDefaultFooter?: boolean;
};

function preheaderBlock(preheader: string | undefined): string {
  if (!preheader) return "";
  const safe = escapeHtml(preheader);
  return `<div style="display:none;font-size:1px;color:${C.pageBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safe}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;
}

function fontHead(): string {
  return `<link rel="stylesheet" href="${BIDWAR_FONT_LINK}" />
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->`;
}

/** Shared BidWar email header — logo image + wordmark (table layout for Outlook). */
export function bidwarEmailHeader(params: {
  appUrl: string;
  logoUrl: string;
  brandName?: string;
}): string {
  const brand = escapeHtml(params.brandName ?? "BidWar");
  const logo = escapeHtml(params.logoUrl);
  const home = escapeHtml(normalizeAppUrl(params.appUrl));

  return `<tr>
    <td style="background:${C.surface};border-bottom:1px solid ${C.border};padding:20px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="left" valign="middle">
            <a href="${home}" style="text-decoration:none;display:inline-block;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <img
                      src="${logo}"
                      width="40"
                      height="40"
                      alt="${brand}"
                      style="display:block;width:40px;height:40px;border:0;outline:none;text-decoration:none;border-radius:8px;"
                    />
                  </td>
                  <td valign="middle">
                    <span style="font-family:${BIDWAR_FONT_STACK};font-size:20px;font-weight:700;letter-spacing:0.06em;color:${C.foreground};">${brand.toUpperCase()}</span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/** Shared BidWar email footer — support, branding, copyright. */
export function bidwarEmailFooter(params: {
  appUrl: string;
  footerNote?: string;
  brandName?: string;
}): string {
  const brand = escapeHtml(params.brandName ?? "BidWar");
  const home = escapeHtml(normalizeAppUrl(params.appUrl));
  const support = escapeHtml(BIDWAR_SUPPORT_EMAIL);
  const year = new Date().getFullYear();
  const note = params.footerNote
    ? `<p style="margin:0 0 12px;font-size:12px;line-height:1.55;color:${C.mutedDark};">${escapeHtml(params.footerNote)}</p>`
    : "";

  return `<tr>
    <td style="background:${C.surface};border-top:1px solid ${C.border};padding:24px 32px 28px;">
      ${note}
      <p style="margin:0 0 8px;font-size:12px;line-height:1.55;color:${C.muted};">
        Need help? Email us at
        <a href="mailto:${support}" style="color:${C.primary};text-decoration:none;font-weight:600;">${support}</a>
      </p>
      <p style="margin:0 0 4px;font-size:11px;line-height:1.5;color:${C.mutedDark};">
        <a href="${home}" style="color:${C.muted};text-decoration:none;font-weight:600;">${brand}</a>
        &nbsp;&middot;&nbsp;India&apos;s Live Sports Auction Platform
      </p>
      <p style="margin:0;font-size:11px;line-height:1.5;color:${C.mutedDark};">&copy; ${year} ${brand}. All rights reserved.</p>
    </td>
  </tr>`;
}

/** Centered gold CTA button — bulletproof for Outlook (table + inline styles). */
export function bidwarCtaButton(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:8px 0 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="border-radius:12px;background:${C.primary};">
              <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:16px 36px;font-family:${BIDWAR_FONT_STACK};font-size:16px;font-weight:700;color:${C.primaryForeground};text-decoration:none;border-radius:12px;letter-spacing:-0.01em;">${safeLabel}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/** Full-width responsive email shell with BidWar dark theme. */
export function wrapBidWarEmailShell(params: BidWarEmailShellParams): string {
  const appUrl = normalizeAppUrl(params.appUrl);
  const logoUrl = resolveEmailLogoUrl(appUrl, params.logoUrl);
  const title = escapeHtml(params.title);

  const headerRow =
    params.includeDefaultHeader === false
      ? ""
      : bidwarEmailHeader({ appUrl, logoUrl, brandName: params.brandName });

  const footerRow =
    params.includeDefaultFooter === false
      ? ""
      : bidwarEmailFooter({ appUrl, footerNote: params.footerNote, brandName: params.brandName });

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${title}</title>
  ${fontHead()}
  <style type="text/css">
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-title { font-size: 26px !important; line-height: 1.2 !important; }
      .detail-label, .detail-value { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.pageBg};font-family:${BIDWAR_BODY_FONT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheaderBlock(params.preheader)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.pageBg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.surfaceElevated};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
          ${headerRow}
          ${params.bodyHtml}
          ${footerRow}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Generic branded layout for simpler transactional emails. */
export function wrapEmailLayout(params: EmailLayoutParams): string {
  const appUrl = normalizeAppUrl(params.appUrl ?? "https://bidwar.in");
  const ctaBlock =
    params.ctaLabel && params.ctaUrl
      ? `<tr><td class="email-pad" style="padding:8px 32px 24px;">${bidwarCtaButton(params.ctaLabel, params.ctaUrl)}</td></tr>`
      : "";

  const bodyHtml = `<tr>
    <td class="email-pad" style="padding:28px 32px 8px;">
      <h1 style="margin:0 0 16px;font-family:${BIDWAR_FONT_STACK};font-size:24px;line-height:1.25;color:${C.foreground};letter-spacing:-0.02em;">${escapeHtml(params.title)}</h1>
      <div style="font-family:${BIDWAR_BODY_FONT};font-size:15px;line-height:1.65;color:${C.muted};">${params.bodyHtml}</div>
    </td>
  </tr>${ctaBlock}`;

  return wrapBidWarEmailShell({
    preheader: params.preheader,
    title: params.title,
    appUrl,
    logoUrl: params.logoUrl,
    brandName: params.brandName,
    footerNote: params.footerNote,
    bodyHtml,
  });
}
