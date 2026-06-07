export type EmailLayoutParams = {
  preheader?: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

/** Responsive HTML email wrapper with inline styles for broad client support. */
export function wrapEmailLayout(params: EmailLayoutParams): string {
  const { preheader, title, bodyHtml, ctaLabel, ctaUrl, footerNote } = params;
  const year = new Date().getFullYear();

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<tr>
          <td style="padding:24px 0 8px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;">${ctaLabel}</a>
          </td>
        </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  ${preheader ? `<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">BidWar</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">${title}</h1>
              <div style="font-size:15px;line-height:1.6;color:#334155;">${bodyHtml}</div>
            </td>
          </tr>
          ${ctaBlock}
          <tr>
            <td style="padding:16px 28px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                ${footerNote ?? "You received this email because of activity on your BidWar account."}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">© ${year} BidWar. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
