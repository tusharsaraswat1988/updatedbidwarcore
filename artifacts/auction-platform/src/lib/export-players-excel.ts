import { formatPlayerGender } from "@/components/player-gender-select";
import { playerTagLabel } from "@/lib/tag-theme";

type CategoryMap = Record<number, { name: string; colorCode?: string | null }>;
type TeamMap = Record<number, { name: string; color?: string | null }>;

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  sold: "Sold",
  retained: "Retained",
  unsold: "Unsold",
};

function yesNo(value: boolean | null | undefined): string {
  return value ? "Yes" : "No";
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRow(
  player: Record<string, unknown>,
  catMap: CategoryMap,
  teamMap: TeamMap,
) {
  const categoryId = player.categoryId as number | null | undefined;
  const teamId = player.teamId as number | null | undefined;
  const tagTeamId = player.playerTagTeamId as number | null | undefined;
  const status = String(player.status ?? "");

  return {
    "Serial #": player.id ?? "",
    Name: player.name ?? "",
    Status: STATUS_LABELS[status] ?? status,
    Category: categoryId ? (catMap[categoryId]?.name ?? "") : "",
    Team: teamId ? (teamMap[teamId]?.name ?? "") : "",
    "Player Tag": playerTagLabel(player.playerTag as string | null | undefined) ?? "",
    "Tag Team": tagTeamId ? (teamMap[tagTeamId]?.name ?? "") : "",
    "Non-Playing Member": yesNo(player.isNonPlayingMember as boolean | undefined),
    Role: player.role ?? "",
    City: player.city ?? "",
    Age: player.age ?? "",
    Gender: formatPlayerGender(player.gender as string | null | undefined) ?? "",
    Mobile: player.mobileNumber ?? "",
    Email: player.email ?? "",
    "Base Price": player.basePrice ?? "",
    "Sold Price": player.soldPrice ?? "",
    "Retained Price": player.retainedPrice ?? "",
    "Jersey Number": player.jerseyNumber ?? "",
    "Jersey Size": player.jerseySize ?? "",
    "Batting Style": player.battingStyle ?? "",
    "Bowling Style": player.bowlingStyle ?? "",
    Specialization: player.specialization ?? "",
    Achievements: player.achievements ?? "",
    "Availability Dates": player.availabilityDates ?? "",
    "CricHero URL": player.cricheroUrl ?? "",
    "Photo URL": player.photoUrl ?? "",
    "Registration Payment Status": player.registrationPaymentStatus ?? "",
    "UTR Number": player.utrNumber ?? "",
    "Payment Screenshot URL": player.paymentScreenshotUrl ?? "",
    "Payment Submitted At": formatDate(player.paymentSubmittedAt as string | null | undefined),
    "WhatsApp Consent": yesNo(player.whatsappConsent as boolean | undefined),
    "WhatsApp Consent At": formatDate(player.whatsappConsentAt as string | null | undefined),
    "WhatsApp Consent Method": player.whatsappConsentMethod ?? "",
    "Global Player ID": player.globalPlayerId ?? "",
    "Created At": formatDate(player.createdAt as string | null | undefined),
    "Updated At": formatDate(player.updatedAt as string | null | undefined),
  };
}

export async function exportPlayersToExcel(
  players: Record<string, unknown>[],
  catMap: CategoryMap,
  teamMap: TeamMap,
  fileName: string,
): Promise<void> {
  if (players.length === 0) {
    throw new Error("No players to export.");
  }

  const XLSX = await import("xlsx");
  const rows = players.map(player => buildRow(player, catMap, teamMap));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Players");
  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
