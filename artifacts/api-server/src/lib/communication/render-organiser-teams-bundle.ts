import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import { db, teamsTable, tournamentsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { buildPublicUrl, getPublicOrigin } from "../runtime-env.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return mobile.trim() || "—";
}

function teamLogoHtml(team: { name: string; logoUrl: string | null; color: string | null }): string {
  if (team.logoUrl?.startsWith("https://")) {
    return `<img src="${escapeHtml(team.logoUrl)}" alt="${escapeHtml(team.name)}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:12px;object-fit:cover;border:2px solid #e5e7eb;" />`;
  }
  const initial = escapeHtml(team.name.slice(0, 2).toUpperCase());
  const color = escapeHtml(team.color ?? "#2563eb");
  return `<div style="width:72px;height:72px;border-radius:12px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;">${initial}</div>`;
}

function whatsAppCopyBlock(params: {
  teamName: string;
  ownerName: string;
  ownerMobile: string;
  accessCode: string;
  ownerAppLink: string;
  tournamentName: string;
  index: number;
}): string {
  return [
    `*Team ${params.index} — ${params.teamName}*`,
    `Tournament: ${params.tournamentName}`,
    `Owner: ${params.ownerName}`,
    `Mobile: ${params.ownerMobile}`,
    `Access Code: ${params.accessCode}`,
    `Owner App: ${params.ownerAppLink}`,
    ``,
    `_Share this block with the ${params.teamName} owner group on WhatsApp._`,
  ].join("\n");
}

export type OrganiserTeamsBundlePreview = {
  tournamentId: number;
  tournamentName: string;
  organiserName: string | null;
  organiserEmail: string | null;
  ownerAppLink: string;
  teamCount: number;
  teamsCredentialsBlock: string;
  mergeData: Record<string, unknown>;
};

export async function buildOrganiserTeamsCredentialsData(
  tournamentId: number,
): Promise<OrganiserTeamsBundlePreview | null> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) return null;

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(asc(teamsTable.createdAt), asc(teamsTable.id));

  const appOrigin = process.env.APP_URL?.trim() || getPublicOrigin();
  const ownerAppLink = buildPublicUrl(ownerJoinPath(tournamentId));

  const teamBlocks: string[] = [];

  teams.forEach((team, index) => {
    const accessCode = team.accessCode?.trim() || "Not set";
    const ownerMobile = formatMobile(team.ownerMobile);
    const waCopy = whatsAppCopyBlock({
      teamName: team.name,
      ownerName: team.ownerName,
      ownerMobile,
      accessCode,
      ownerAppLink,
      tournamentName: tournament.name,
      index: index + 1,
    });

    teamBlocks.push(`
<section style="margin:0 0 28px 0;padding:20px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
    <tr>
      <td width="88" valign="top" style="padding-right:16px;">${teamLogoHtml(team)}</td>
      <td valign="top">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Team ${index + 1}</p>
        <h3 style="margin:0 0 8px;font-size:20px;color:#111827;">${escapeHtml(team.name)}</h3>
        <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Owner:</strong> ${escapeHtml(team.ownerName)}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Mobile:</strong> ${escapeHtml(ownerMobile)}</p>
        <p style="margin:0;font-size:14px;color:#374151;"><strong>Access Code:</strong> <span style="font-family:monospace;font-size:16px;font-weight:700;color:#1d4ed8;">${escapeHtml(accessCode)}</span></p>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Copy for WhatsApp</p>
  <pre style="margin:0;padding:14px;background:#f3f4f6;border:1px dashed #d1d5db;border-radius:8px;font-family:ui-monospace,monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#111827;">${escapeHtml(waCopy)}</pre>
</section>`);
  });

  const teamsCredentialsBlock =
    teamBlocks.length > 0
      ? teamBlocks.join("\n")
      : `<p style="color:#6b7280;font-style:italic;">No teams registered for this tournament yet.</p>`;

  const mergeData: Record<string, unknown> = {
    organiser_name: tournament.organizerName ?? "Organiser",
    tournament_name: tournament.name,
    owner_app_link: ownerAppLink,
    teams_credentials_block: teamsCredentialsBlock,
    team_count: String(teams.length),
    current_year: String(new Date().getFullYear()),
    app_url: appOrigin,
    email: tournament.organizerEmail ?? "",
  };

  return {
    tournamentId,
    tournamentName: tournament.name,
    organiserName: tournament.organizerName,
    organiserEmail: tournament.organizerEmail,
    ownerAppLink,
    teamCount: teams.length,
    teamsCredentialsBlock,
    mergeData,
  };
}
