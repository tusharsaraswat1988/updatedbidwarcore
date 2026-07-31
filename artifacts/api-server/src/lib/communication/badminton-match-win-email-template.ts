/** Premium Badminton Match Win congratulations email (Communication Center). */

export const BADMINTON_MATCH_WIN_SUBJECT =
  "🏸 Congratulations {{recipient_name}}! You won your badminton match";

export const BADMINTON_MATCH_WIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Match Win</title>
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
<td align="center" style="padding-bottom:12px;font-size:36px;line-height:1;letter-spacing:0.2em;">🏸 🏆 🔥</td>
</tr>
<tr>
<td align="center" style="padding-bottom:14px;">
{{bidwar_logo}}
</td>
</tr>
<tr>
<td align="center" style="padding-bottom:10px;font-size:42px;line-height:1;">🎉</td>
</tr>
<tr>
<td align="center">
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:34px;line-height:1.15;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#F4B400;text-shadow:0 0 24px rgba(244,180,0,0.35);">CONGRATULATIONS</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Tournament -->
<tr>
<td align="center" style="padding:8px 32px 24px;">
<p style="margin:0 0 6px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#71717A;">Badminton Match Win</p>
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.35;font-weight:700;color:#FAFAFA;">{{tournament_name}}</p>
{{#category_name}}
<p style="margin:10px 0 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#A1A1AA;">{{category_name}}</p>
{{/category_name}}
</td>
</tr>

<!-- Personal message -->
<tr>
<td style="padding:0 32px 24px;">
<p style="margin:0 0 10px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#E4E4E7;">Hey <strong style="color:#FAFAFA;">{{recipient_name}}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#A1A1AA;">What a performance! You just secured a hard-earned win on court. That energy, focus, and fight — this is what champions are made of.</p>
</td>
</tr>

<!-- Result card -->
<tr>
<td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,#1A1A1A 0%,#121212 100%);border:1px solid rgba(244,180,0,0.35);border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(244,180,0,0.08);">
<tr>
<td align="center" style="padding:28px 24px 12px;">
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#F4B400;">MATCH RESULT</p>
</td>
</tr>
<tr>
<td align="center" style="padding:8px 24px 8px;">
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;line-height:1.25;font-weight:700;color:#FAFAFA;">{{winner_label}}</p>
</td>
</tr>
<tr>
<td align="center" style="padding:0 24px 8px;">
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#F4B400;">DEFEATED</p>
</td>
</tr>
<tr>
<td align="center" style="padding:0 24px 20px;">
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;line-height:1.3;font-weight:600;color:#D4D4D8;">{{opponent_label}}</p>
</td>
</tr>
{{#score_line}}
<tr>
<td align="center" style="padding:0 24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0B0B;border:1px solid rgba(244,180,0,0.28);border-radius:12px;">
<tr>
<td align="center" style="padding:14px 22px;">
<p style="margin:0 0 4px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#71717A;">Scoreline</p>
<p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.2;font-weight:700;color:#F4B400;">{{score_line}}</p>
</td>
</tr>
</table>
</td>
</tr>
{{/score_line}}
<tr>
<td align="center" style="padding:8px 24px 28px;">
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#A1A1AA;">{{result_label}} · Games {{games_score}}</p>
{{#franchise_name}}
<p style="margin:10px 0 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#D4D4D8;">Representing <strong style="color:#FAFAFA;">{{franchise_name}}</strong></p>
{{/franchise_name}}
</td>
</tr>
</table>
</td>
</tr>

<!-- Motivation -->
<tr>
<td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#141414;border:1px solid rgba(244,180,0,0.2);border-radius:14px;">
<tr>
<td style="padding:24px 22px;">
<p style="margin:0 0 12px;font-size:28px;line-height:1;">🔥</p>
<p style="margin:0 0 10px;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;font-weight:700;color:#F4B400;">Keep the momentum. Own the court.</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.75;color:#A1A1AA;">Every rally counts. Every point builds pressure. Stay sharp, stay hungry, and go chase the next win — the podium is waiting.</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Support BidWar -->
<tr>
<td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#1F1808 0%,#141414 50%,#1A1408 100%);border:1px solid rgba(244,180,0,0.45);border-radius:18px;overflow:hidden;">
<tr>
<td align="center" style="padding:28px 24px;">
<p style="margin:0 0 8px;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;line-height:1.35;font-weight:700;color:#FAFAFA;">Support BidWar</p>
<p style="margin:0 0 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#A1A1AA;">Proud to power your tournament journey.<br/>Play hard. Celebrate louder. Compete with BidWar.</p>
<p style="margin:0;">
<a href="https://bidwar.in" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;background-color:#F4B400;color:#0B0B0B;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;text-decoration:none;border-radius:999px;letter-spacing:0.04em;">VISIT BIDWAR.IN</a>
</p>
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
