/** Default Player Registration email — Communication Center template (inline CSS, table layout). */

export const PLAYER_REGISTRATION_SUBJECT =
  "🎉 Welcome to BidWar! Your Registration for {{tournament_name}} is Confirmed";

export const PLAYER_REGISTRATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Registration Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(17,17,17,0.08);">

<!-- Header -->
<tr>
<td align="center" style="padding:32px 32px 24px;background-color:#111111;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td align="center" style="padding-bottom:16px;">
{{bidwar_logo}}
</td>
</tr>
{{#tournament_logo}}
<tr>
<td align="center" style="padding-bottom:20px;">
{{tournament_logo}}
</td>
</tr>
{{/tournament_logo}}
<tr>
<td align="center">
<h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">{{tournament_name}}</h1>
</td>
</tr>
</table>
</td>
</tr>

<!-- Gold accent bar -->
<tr>
<td style="height:4px;background-color:#F4B400;font-size:0;line-height:0;">&nbsp;</td>
</tr>

<!-- Greeting -->
<tr>
<td style="padding:32px 32px 0;">
<p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;line-height:1.4;font-weight:700;color:#111111;">Congratulations {{player_name}}!</p>
<p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#444444;">You have successfully registered for <strong style="color:#111111;">{{tournament_name}}</strong> on <strong style="color:#111111;">BidWar</strong>.</p>
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#444444;">We are excited to welcome you to the tournament. Get ready for an amazing sporting experience.</p>
</td>
</tr>

<!-- Tournament Information -->
<tr>
<td style="padding:28px 32px 0;">
<p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#F4B400;">Tournament Information</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAFAFA;border:1px solid #E8E8E8;border-radius:12px;overflow:hidden;">
{{#tournament_name}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;width:42%;">Tournament Name</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{tournament_name}}</td>
</tr>
{{/tournament_name}}
{{#sport_name}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Sport</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{sport_name}}</td>
</tr>
{{/sport_name}}
{{#registration_id}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Registration ID</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{registration_id}}</td>
</tr>
{{/registration_id}}
{{#player_name}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Player Name</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{player_name}}</td>
</tr>
{{/player_name}}
{{#team_name}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Team Name</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{team_name}}</td>
</tr>
{{/team_name}}
{{#tournament_dates}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Tournament Dates</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{tournament_dates}}</td>
</tr>
{{/tournament_dates}}
{{#venue}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Venue</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{venue}}</td>
</tr>
{{/venue}}
{{#registration_date}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Registration Date</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{registration_date}}</td>
</tr>
{{/registration_date}}
{{#organiser_name}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Organiser Name</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{organiser_name}}</td>
</tr>
{{/organiser_name}}
{{#organiser_phone}}
<tr>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Organiser Contact</td>
<td style="padding:12px 18px;border-bottom:1px solid #E8E8E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{organiser_phone}}</td>
</tr>
{{/organiser_phone}}
{{#organiser_email}}
<tr>
<td style="padding:12px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">Organiser Email</td>
<td style="padding:12px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;">{{organiser_email}}</td>
</tr>
{{/organiser_email}}
</table>
</td>
</tr>

<!-- Next Steps -->
<tr>
<td style="padding:28px 32px 0;">
<p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;line-height:1.3;font-weight:700;color:#111111;">What happens next?</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#444444;">
<span style="color:#F4B400;font-weight:700;margin-right:8px;">&#9679;</span>Your tournament organiser will contact you regarding fixtures, reporting time, schedule and tournament updates.
</td>
</tr>
<tr>
<td style="padding:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#444444;">
<span style="color:#F4B400;font-weight:700;margin-right:8px;">&#9679;</span>Please stay connected with your organiser for all future communication.
</td>
</tr>
<tr>
<td style="padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#444444;">
<span style="color:#F4B400;font-weight:700;margin-right:8px;">&#9679;</span>Keep your registered email and mobile number active.
</td>
</tr>
</table>
</td>
</tr>

<!-- Support BidWar -->
<tr>
<td style="padding:28px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#FFF8E1 0%,#FFF3CC 100%);border:1px solid #F4B400;border-radius:12px;">
<tr>
<td style="padding:24px;" align="center">
<p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;line-height:1.3;font-weight:700;color:#111111;">&#10084;&#65039; Support BidWar</p>
<p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#444444;text-align:center;">We&apos;re building India&apos;s smartest sports tournament platform.<br/>If you enjoy using BidWar, please support us by sharing BidWar with your sports clubs, academies, schools, colleges and sports communities across India.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td align="center" style="border-radius:8px;background-color:#F4B400;">
<a href="https://bidwar.in" target="_blank" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#111111;text-decoration:none;border-radius:8px;">Visit BidWar</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- Important Notice -->
<tr>
<td style="padding:28px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEEEEE;border-radius:10px;">
<tr>
<td style="padding:20px;">
<p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#555555;">Important Notice</p>
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.65;color:#666666;">This is an automatically generated email.<br/>Please do not reply to this email.<br/><br/>All tournament information shown in this email has been provided and managed by the respective tournament organiser.<br/>BidWar is only the technology platform facilitating tournament operations and is not responsible for the accuracy, completeness or future changes made by the organiser.</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:32px 32px 36px;">
<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111111;">Regards,</p>
<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;font-weight:700;color:#111111;">Team BidWar</p>
<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#777777;">India&apos;s Smart Sports Tournament Platform</p>
<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#444444;">&#128222; +91 8707488250</p>
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#444444;">&#127760; <a href="https://bidwar.in" target="_blank" style="color:#F4B400;text-decoration:none;font-weight:600;">https://bidwar.in</a></p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
