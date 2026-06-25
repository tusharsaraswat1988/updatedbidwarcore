import { formatPlayerGender } from "@/components/player-gender-select";
import { playerTagLabel } from "@/lib/tag-theme";
import { bidValueSourceLabel } from "@workspace/api-base/bid-value";
import {
  collectSpecColumnLabels,
  resolvePlayerSpecifications,
  type PlayerSpecSource,
} from "@/lib/player-spec-display";

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
  specColumns: string[],
) {
  const categoryId = player.categoryId as number | null | undefined;
  const teamId = player.teamId as number | null | undefined;
  const tagTeamId = player.playerTagTeamId as number | null | undefined;
  const status = String(player.status ?? "");
  const specs = resolvePlayerSpecifications(player as PlayerSpecSource);
  const specByLabel = new Map(specs.map((s) => [s.label, s.value]));

  const row: Record<string, string | number> = {
    "Serial #": (player.serialNo ?? player.id ?? "") as string | number,
    Name: (player.name ?? "") as string,
    Status: STATUS_LABELS[status] ?? status,
    Category: categoryId ? (catMap[categoryId]?.name ?? "") : "",
    Team: teamId ? (teamMap[teamId]?.name ?? "") : "",
    "Player Tag": playerTagLabel(player.playerTag as string | null | undefined) ?? "",
    "Tag Team": tagTeamId ? (teamMap[tagTeamId]?.name ?? "") : "",
    "Non-Playing Member": yesNo(player.isNonPlayingMember as boolean | undefined),
    Role: (player.role ?? "") as string,
    City: (player.city ?? "") as string,
    Age: (player.age ?? "") as string | number,
    Gender: formatPlayerGender(player.gender as string | null | undefined) ?? "",
    Mobile: (player.mobileNumber ?? "") as string,
    Email: (player.email ?? "") as string,
    "Base Price": (player.basePrice ?? "") as string | number,
    "Bid Value Source": bidValueSourceLabel(player.bidValueSource as "system" | "player" | null | undefined),
    "Selected Bid Value": (player.selectedBidValue ?? "") as string | number,
    "Sold Price": (player.soldPrice ?? "") as string | number,
    "Retained Price": (player.retainedPrice ?? "") as string | number,
    "Jersey Number": (player.jerseyNumber ?? "") as string,
    "Jersey Size": (player.jerseySize ?? "") as string,
    Achievements: (player.achievements ?? "") as string,
    "Availability Dates": (player.availabilityDates ?? "") as string,
    "CricHero URL": (player.cricheroUrl ?? "") as string,
    "Photo URL": (player.photoUrl ?? "") as string,
    "Registration Payment Status": (player.registrationPaymentStatus ?? "") as string,
    "UTR Number": (player.utrNumber ?? "") as string,
    "Payment Screenshot URL": (player.paymentScreenshotUrl ?? "") as string,
    "Payment Submitted At": formatDate(player.paymentSubmittedAt as string | null | undefined),
    "WhatsApp Consent": yesNo(player.whatsappConsent as boolean | undefined),
    "WhatsApp Consent At": formatDate(player.whatsappConsentAt as string | null | undefined),
    "WhatsApp Consent Method": (player.whatsappConsentMethod ?? "") as string,
    "Global Player ID": (player.globalPlayerId ?? "") as string,
    "Created At": formatDate(player.createdAt as string | null | undefined),
    "Updated At": formatDate(player.updatedAt as string | null | undefined),
  };

  for (const label of specColumns) {
    row[label] = specByLabel.get(label) ?? "";
  }

  return row;
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

  const specColumns = collectSpecColumnLabels(players as PlayerSpecSource[]);
  const XLSX = await import("xlsx");
  const rows = players.map((player) => buildRow(player, catMap, teamMap, specColumns));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Players");
  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
