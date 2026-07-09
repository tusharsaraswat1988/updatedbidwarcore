/** Premium Player Sold email — IPL-style selection letter (Communication Center v2). */

export const PLAYER_SOLD_SUBJECT =
  "🎉 Congratulations {{player_name}}! Welcome to {{team_name}}";

export const PLAYER_SOLD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Player Sold</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0B0B;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0B0B;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#111111;border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.55);border:1px solid rgba(244,180,0,0.18);">

<!-- Hero -->
<tr>
<td align="center" style="padding:36px 28px 28px;background:linear-gradient(180deg,#141414 0%,#0B0B0B 100%);">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td align="center" style="padding-bottom:12px;font-size:36px;line-height:1;letter-spacing:0.2em;">🎉 ✨ 🎊</td>
</tr>
<tr>
<td align="center" style="padding-bottom:14px;">
{{bidwar_logo}}
</td>
</tr>
<tr>
<td align="center" style="padding-bottom:10px;font-size:42px;line-height:1;">🏆</td>
</tr>
<tr>
<td align="center">
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:34px;line-height:1.15;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#F4B400;text-shadow:0 0 24px rgba(244,180,0,0.35);">CONGRATULATIONS</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Tournament title -->
<tr>
<td align="center" style="padding:8px 32px 28px;">
{{#title_sponsor}}
<p style="margin:0 0 6px;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;font-weight:600;color:#D4AF37;text-transform:uppercase;letter-spacing:0.08em;">{{title_sponsor}}</p>
<p style="margin:0 0 10px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#A1A1AA;">Presents</p>
{{/title_sponsor}}
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.35;font-weight:700;color:#FAFAFA;">{{tournament_name}}</p>
{{#co_sponsors_line}}
<p style="margin:14px 0 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#71717A;">Co-powered by<br/><span style="color:#D4D4D8;font-weight:600;">{{co_sponsors_line}}</span></p>
{{/co_sponsors_line}}
</td>
</tr>

<!-- Welcome -->
<tr>
<td style="padding:0 32px 28px;">
<p style="margin:0 0 10px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#E4E4E7;">Welcome to one of the most exciting sporting events.</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#A1A1AA;">You have officially been selected during the BidWar Live Auction.</p>
</td>
</tr>

<!-- Player section -->
<tr>
<td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#161616;border:1px solid rgba(244,180,0,0.22);border-radius:16px;overflow:hidden;">
<tr>
<td width="120" valign="middle" align="center" style="padding:20px 16px;">
{{player_avatar}}
</td>
<td valign="middle" style="padding:20px 20px 20px 0;">
<p style="margin:0 0 4px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#71717A;">Player</p>
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#FAFAFA;">{{player_name}}</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Team card -->
<tr>
<td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,#1A1A1A 0%,#121212 100%);border:1px solid rgba(244,180,0,0.35);border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(244,180,0,0.08);">
<tr>
<td align="center" style="padding:28px 24px 12px;">
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#F4B400;">YOU HAVE BEEN SOLD TO</p>
</td>
</tr>
<tr>
<td align="center" style="padding:8px 24px 12px;">
{{#team_logo}}
{{team_logo}}
{{/team_logo}}
</td>
</tr>
<tr>
<td align="center" style="padding:8px 24px 28px;">
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:30px;line-height:1.2;font-weight:700;color:#FAFAFA;">{{team_name}}</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Price / Points -->
<tr>
<td align="center" style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#1F1808 0%,#141414 50%,#1A1408 100%);border:1px solid rgba(244,180,0,0.45);border-radius:18px;overflow:hidden;box-shadow:0 0 48px rgba(244,180,0,0.12);">
<tr>
<td align="center" style="padding:32px 24px 20px;">
{{#amount_money}}
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:52px;line-height:1.05;font-weight:700;color:#F4B400;text-shadow:0 0 32px rgba(244,180,0,0.45);">{{amount_display}}</p>
{{/amount_money}}
{{#amount_points}}
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:48px;line-height:1.05;font-weight:700;color:#F4B400;text-shadow:0 0 32px rgba(244,180,0,0.45);">{{amount_display}} <span style="font-size:22px;letter-spacing:0.08em;">POINTS</span></p>
{{/amount_points}}
</td>
</tr>
<tr>
<td align="center" style="padding:0 24px 32px;">
<p style="margin:0 0 8px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;font-weight:700;color:#FAFAFA;">Congratulations!</p>
<p style="margin:0 0 6px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#A1A1AA;">Your talent has earned the trust of the franchise.</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#A1A1AA;">We wish you an incredible tournament.</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Details card -->
<tr>
<td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#161616;border:1px solid #27272A;border-radius:14px;overflow:hidden;">
<tr>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#71717A;width:38%;">Player</td>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#FAFAFA;">{{player_name}}</td>
</tr>
<tr>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#71717A;">Team</td>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#FAFAFA;">{{team_name}}</td>
</tr>
<tr>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#71717A;">Tournament</td>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#FAFAFA;">{{tournament_name}}</td>
</tr>
{{#auction_name}}
<tr>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#71717A;">Auction</td>
<td style="padding:14px 18px;border-bottom:1px solid #27272A;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#FAFAFA;">{{auction_name}}</td>
</tr>
{{/auction_name}}
{{#auction_date}}
<tr>
<td style="padding:14px 18px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#71717A;">Auction Date</td>
<td style="padding:14px 18px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#FAFAFA;">{{auction_date}}</td>
</tr>
{{/auction_date}}
</table>
</td>
</tr>

<!-- Motivation -->
<tr>
<td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#141414;border:1px solid rgba(244,180,0,0.2);border-radius:14px;">
<tr>
<td style="padding:24px 22px;">
<p style="margin:0 0 12px;font-size:28px;line-height:1;">🏆</p>
<p style="margin:0 0 10px;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;font-weight:700;color:#F4B400;">Every Champion Starts With A Winning Bid.</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.75;color:#A1A1AA;">Play with passion.<br/>Play for your team.<br/>Create unforgettable moments.</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:28px 32px 36px;border-top:1px solid #27272A;background-color:#0B0B0B;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding-bottom:18px;">{{bidwar_logo}}</td>
</tr>
<tr>
<td align="center">
<p style="margin:0 0 8px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#FAFAFA;">Need Assistance?</p>
<p style="margin:0 0 14px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.65;color:#71717A;">For tournament-related queries,<br/>please contact your organiser.</p>
{{#organiser_name}}
<p style="margin:0 0 4px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#E4E4E7;">{{organiser_name}}</p>
{{/organiser_name}}
{{#organiser_email}}
<p style="margin:0 0 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#F4B400;"><a href="mailto:{{organiser_email}}" style="color:#F4B400;text-decoration:none;">{{organiser_email}}</a></p>
{{/organiser_email}}
<p style="margin:0 0 6px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#52525B;">Powered by BidWar</p>
<p style="margin:0 0 14px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#52525B;">India&apos;s Professional Sports Auction Platform</p>
<p style="margin:0 0 4px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#71717A;"><a href="mailto:support@bidwar.in" style="color:#A1A1AA;text-decoration:none;">support@bidwar.in</a></p>
<p style="margin:0 0 18px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#71717A;"><a href="https://bidwar.in" target="_blank" style="color:#F4B400;text-decoration:none;">https://bidwar.in</a></p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#52525B;">© {{current_year}} BidWar</p>
</td>
</tr>
</table>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
