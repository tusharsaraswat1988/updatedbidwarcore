import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  useGetTeamReportList,
  useGetTeamReport,
  getGetTournamentQueryKey,
  getGetTeamReportListQueryKey,
  getGetTeamReportQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { TournamentContextLabel } from "@/components/organizer-page-chrome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIndianRupee, formatShortIndianRupee, normalizeAuctionUnit } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import { exportElementToPdf, printElementAsPdf } from "@/lib/export-element-pdf";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { resolveRetainedSpend, type TeamReportAuctionRules } from "@workspace/api-base";
import { PLATFORM_BASE_URL } from "@workspace/api-base/branding-assets";
import { jerseySizeLabel } from "@workspace/api-base/jersey-size";
import { toast } from "@/hooks/use-toast";
import {
  FileText, Printer, Download, Lock, ChevronRight,
  User, AlertTriangle, Loader2, Award,
} from "lucide-react";

const OPTIONAL_COLS = [
  { key: "photo",            label: "Player Photo" },
  { key: "mobileNumber",     label: "Mobile Number" },
  { key: "email",            label: "Email" },
  { key: "age",              label: "Age" },
  { key: "city",             label: "City" },
  { key: "categoryName",     label: "Category" },
  { key: "role",             label: "Role" },
  { key: "jerseyNumber",     label: "Jersey Number" },
  { key: "jerseySize",       label: "Jersey Size" },
  { key: "status",           label: "Type (Retained/Pre-Sold)" },
  { key: "remainingBalance", label: "Remaining Balance" },
] as const;
type ColKey = typeof OPTIONAL_COLS[number]["key"];

const PRESET_KEYS = ["basic", "auction", "detailed"] as const;
type PresetKey = (typeof PRESET_KEYS)[number];

const PRESETS: Record<PresetKey, ColKey[]> = {
  basic:    [],
  auction:  ["photo", "categoryName", "remainingBalance"],
  detailed: ["photo", "mobileNumber", "email", "age", "city", "categoryName", "role", "jerseyNumber", "jerseySize", "status", "remainingBalance"],
};

function matchingPreset(cols: Set<ColKey>): PresetKey | null {
  for (const key of PRESET_KEYS) {
    const preset = PRESETS[key];
    if (preset.length === cols.size && preset.every((col) => cols.has(col))) return key;
  }
  return null;
}

const REPORT_TH =
  "border border-gray-400 px-1.5 py-1 text-[10px] font-bold uppercase leading-tight tracking-wide align-middle select-none";
const REPORT_CELL = "border border-gray-400 px-1.5 py-1 align-middle text-xs";

type ActiveColumnDef = {
  key: string;
  header: string;
  weight: number;
  align: "left" | "center" | "right";
};

function getActiveColumns(cols: Set<ColKey>): ActiveColumnDef[] {
  const result: ActiveColumnDef[] = [
    { key: "serialNo", header: "S.No", weight: 0.55, align: "left" },
    { key: "name", header: "Player Name", weight: 2.2, align: "left" },
  ];

  if (cols.has("age")) {
    result.push({ key: "age", header: "Age", weight: 0.45, align: "center" });
  }
  if (cols.has("city")) {
    result.push({ key: "city", header: "City", weight: 0.8, align: "left" });
  }
  if (cols.has("mobileNumber")) {
    result.push({ key: "mobileNumber", header: "Mobile", weight: 1.05, align: "left" });
  }
  if (cols.has("email")) {
    result.push({ key: "email", header: "Email", weight: 1.35, align: "left" });
  }
  if (cols.has("categoryName")) {
    result.push({ key: "categoryName", header: "Category", weight: 0.8, align: "left" });
  }
  if (cols.has("role")) {
    result.push({ key: "role", header: "Role", weight: 0.8, align: "left" });
  }
  if (cols.has("jerseyNumber")) {
    result.push({ key: "jerseyNumber", header: "Jersey No.", weight: 0.55, align: "center" });
  }
  if (cols.has("jerseySize")) {
    result.push({ key: "jerseySize", header: "Jersey Size", weight: 0.7, align: "center" });
  }
  if (cols.has("status")) {
    result.push({ key: "status", header: "Type", weight: 0.8, align: "left" });
  }

  result.push({ key: "amount", header: "Amount", weight: 1.15, align: "right" });

  if (cols.has("remainingBalance")) {
    result.push({ key: "remainingBalance", header: "Balance", weight: 1.15, align: "right" });
  }

  return result;
}
const PLANNING_ROW_MIN_PX = 28;
const PLANNING_SECTION_TITLE_PX = 22;
const PLANNING_TABLE_HEAD_PX = 30;

function loadCols(tid: number): Set<ColKey> {
  try {
    const raw = localStorage.getItem(`team_report_cols_${tid}`);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      const valid = OPTIONAL_COLS.map(c => c.key) as string[];
      return new Set(arr.filter((k): k is ColKey => valid.includes(k)));
    }
  } catch { /* empty */ }
  return new Set<ColKey>(["categoryName", "remainingBalance"]);
}

function saveCols(tid: number, cols: Set<ColKey>) {
  try { localStorage.setItem(`team_report_cols_${tid}`, JSON.stringify([...cols])); } catch { /* empty */ }
}

function loadShowSponsors(tid: number): boolean {
  try {
    return localStorage.getItem(`team_report_sponsors_${tid}`) === "1";
  } catch {
    return false;
  }
}

function saveShowSponsors(tid: number, show: boolean) {
  try { localStorage.setItem(`team_report_sponsors_${tid}`, show ? "1" : "0"); } catch { /* empty */ }
}

function playerAcquisitionAmount(p: Pick<ReportPlayer, "status" | "retainedPrice" | "soldPrice" | "basePrice">): number {
  if (p.status === "retained") {
    return resolveRetainedSpend({
      status: p.status,
      retainedPrice: p.retainedPrice,
      basePrice: p.basePrice,
    });
  }
  return p.soldPrice ?? 0;
}

function buildAuctionRuleLines(
  rules: TeamReportAuctionRules | undefined,
  formatAmount: (amount: number) => string,
): string[] {
  if (!rules) return [];

  const lines: string[] = [];
  if (rules.minBid != null) {
    lines.push(`Base value for all players: ${formatAmount(rules.minBid)}`);
  }
  if (rules.playersChooseBaseValue) {
    lines.push("Players may have their own base value as listed at registration.");
  }
  rules.categoryMinBids.forEach((category) => {
    lines.push(`${category.name} category base value: ${formatAmount(category.minBid)}`);
  });
  lines.push(...rules.bidIncrementLines);
  if (rules.minimumSquadSize != null) {
    lines.push(`Minimum players to acquire: ${rules.minimumSquadSize}`);
  }
  if (rules.maximumSquadSize != null) {
    lines.push(`Maximum squad size: ${rules.maximumSquadSize}`);
  }
  return lines;
}

type ReportPlayer = {
  id: number; serialNo: number; name: string; role: string | null; city: string | null; age: number | null;
  photoUrl: string | null; mobileNumber: string | null; email: string | null; jerseyNumber: string | null; jerseySize: string | null;
  categoryName: string | null; categoryColor: string | null;
  basePrice: number;
  soldPrice: number | null; retainedPrice: number | null;
  status: string; isNonPlayingMember: boolean;
};

type ReportSponsor = { name: string; type?: string | null };

type ReportData = {
  isLicensed: boolean;
  tournament: { id: number; name: string; sport: string; logoUrl: string | null; licenseStatus: string; minimumSquadSize: number; maximumSquadSize: number; auctionUnit?: string };
  team: { id: number; name: string; shortCode: string; ownerName: string; ownerMobile: string; ownerEmail: string | null; ownerPhotoUrl: string | null; logoUrl: string | null; color: string | null; purse: number; purseUsed: number };
  purgeSummary: { totalPurse: number; retainedSpend: number; preSoldSpend: number; remainingPurse: number };
  auctionRules?: TeamReportAuctionRules;
  sponsors?: ReportSponsor[];
  platform?: { brandName: string; websiteUrl: string };
  retainedPlayers: ReportPlayer[];
  preSoldPlayers: ReportPlayer[];
  nonPlayingMembers: ReportPlayer[];
  categories: { id: number; name: string; colorCode: string | null }[];
  squadInfo: { totalAcquired: number; slotsRemaining: number; planningRows: number };
};

function PlayerPhoto({ url, name, small }: { url: string | null; name: string; small?: boolean }) {
  const size = small ? "w-6 h-6" : "w-10 h-10";
  if (url) {
    return (
      <img
        src={cldUrl(url, "playerCard") || url}
        alt={name}
        className={`${size} rounded-full object-cover flex-shrink-0 border border-gray-200`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={`${size} rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200`}>
      <User className="w-3 h-3 text-gray-400" />
    </div>
  );
}

function PlayerNameCell({
  name,
  photoUrl,
  showPhoto,
  placeholder,
}: {
  name?: string;
  photoUrl?: string | null;
  showPhoto: boolean;
  placeholder?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden" title={name || undefined}>
      {showPhoto ? (
        placeholder ? (
          <div className="h-6 w-6 flex-shrink-0" />
        ) : (
          <PlayerPhoto url={photoUrl ?? null} name={name ?? ""} small />
        )
      ) : null}
      <span className={cn("min-w-0 truncate text-xs leading-normal", name ? "font-semibold text-gray-900" : "text-gray-300")}>
        {name ?? (placeholder ? "—" : "\u00A0")}
      </span>
    </div>
  );
}

function PlayerTable({
  players, cols, initialBalance, sectionLabel, showPhoto,
}: {
  players: ReportPlayer[];
  cols: Set<ColKey>;
  initialBalance: number;
  sectionLabel: string;
  showPhoto: boolean;
}) {
  if (players.length === 0) return null;

  const activeCols = getActiveColumns(cols);
  const totalWeight = activeCols.reduce((sum, c) => sum + c.weight, 0);
  let balance = initialBalance;

  return (
    <div className="mb-2 flex-shrink-0 print-section">
      <h3 className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 print-section-heading">{sectionLabel}</h3>
      <table className="w-full table-fixed border-collapse border border-gray-400 text-xs">
        <colgroup>
          {activeCols.map((col) => {
            const widthPct = `${((col.weight / totalWeight) * 100).toFixed(2)}%`;
            return <col key={col.key} style={{ width: widthPct }} />;
          })}
        </colgroup>
        <thead>
          <tr className="bg-slate-800 text-yellow-400 print-table-header">
            {activeCols.map((col) => (
              <th
                key={col.key}
                className={cn(
                  REPORT_TH,
                  col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left",
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const price = playerAcquisitionAmount(p);
            balance -= price;
            const rowBalance = balance;
            const cell = REPORT_CELL;
            return (
              <tr key={p.id} className={`print-row ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className={cn(cell, "text-left font-mono text-[11px] text-gray-500 whitespace-nowrap")}>
                  {p.serialNo ?? p.id}
                </td>
                <td className={cn(cell, "text-left")}>
                  <PlayerNameCell name={p.name} photoUrl={p.photoUrl} showPhoto={showPhoto} />
                </td>
                {cols.has("age") && (
                  <td className={cn(cell, "text-center text-gray-600 whitespace-nowrap")}>
                    {p.age ?? "-"}
                  </td>
                )}
                {cols.has("city") && (
                  <td className={cn(cell, "text-left text-gray-600 truncate")} title={p.city || ""}>
                    {p.city || "-"}
                  </td>
                )}
                {cols.has("mobileNumber") && (
                  <td className={cn(cell, "text-left font-mono text-[11px] text-gray-600 whitespace-nowrap")}>
                    {p.mobileNumber || "-"}
                  </td>
                )}
                {cols.has("email") && (
                  <td className={cn(cell, "text-left text-[11px] text-gray-600 truncate")} title={p.email || ""}>
                    {p.email || "-"}
                  </td>
                )}
                {cols.has("categoryName") && (
                  <td className={cn(cell, "text-left truncate")}>
                    {p.categoryName ? (
                      <span
                        className="inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: (p.categoryColor || "#3B82F6") + "22", color: p.categoryColor || "#3B82F6" }}
                      >
                        {p.categoryName}
                      </span>
                    ) : "-"}
                  </td>
                )}
                {cols.has("role") && (
                  <td className={cn(cell, "text-left capitalize text-gray-600 truncate")} title={p.role || ""}>
                    {p.role?.replace(/_/g, " ") || "-"}
                  </td>
                )}
                {cols.has("jerseyNumber") && (
                  <td className={cn(cell, "text-center text-gray-600 font-mono text-[11px] whitespace-nowrap")}>
                    {p.jerseyNumber || "-"}
                  </td>
                )}
                {cols.has("jerseySize") && (
                  <td className={cn(cell, "text-center text-gray-600 whitespace-nowrap text-[11px]")}>
                    {p.jerseySize ? jerseySizeLabel(p.jerseySize) : "-"}
                  </td>
                )}
                {cols.has("status") && (
                  <td className={cn(cell, "text-left")}>
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                        p.status === "retained" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700",
                      )}
                    >
                      {p.status === "retained" ? "Retained" : "Pre-Sold"}
                    </span>
                  </td>
                )}
                <td className={cn(cell, "text-right font-mono font-semibold text-gray-900 whitespace-nowrap")}>
                  {formatShortIndianRupee(price)}
                </td>
                {cols.has("remainingBalance") && (
                  <td className={cn(cell, "text-right font-mono font-semibold text-emerald-700 whitespace-nowrap")}>
                    {formatShortIndianRupee(rowBalance)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AuctionPlanningTable({
  displayRows,
  rowHeight,
  startSno,
  cols,
  showPhoto,
  className,
}: {
  displayRows: number;
  rowHeight: number;
  startSno: number;
  cols: Set<ColKey>;
  showPhoto: boolean;
  className?: string;
}) {
  const activeCols = getActiveColumns(cols);
  const totalWeight = activeCols.reduce((sum, c) => sum + c.weight, 0);
  const bodyCell = REPORT_CELL;
  const rowStyle = { height: rowHeight, minHeight: rowHeight };

  return (
    <div className={cn("print-section flex min-h-0 flex-1 flex-col", className)}>
      <h3 className="mb-1.5 flex-shrink-0 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        Auction Working Sheet — {displayRows} Slots
      </h3>
      <div className="flex min-h-0 flex-1 flex-col">
        <table className="h-full w-full table-fixed border-collapse border border-gray-400 text-xs print-table">
          <colgroup>
            {activeCols.map((col) => {
              const widthPct = `${((col.weight / totalWeight) * 100).toFixed(2)}%`;
              return <col key={col.key} style={{ width: widthPct }} />;
            })}
          </colgroup>
          <thead>
            <tr className="bg-slate-800 text-yellow-400 print-table-header">
              {activeCols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    REPORT_TH,
                    col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: displayRows }, (_, i) => (
              <tr
                key={i}
                style={rowStyle}
                className={cn("print-row", i % 2 === 0 ? "bg-white" : "bg-gray-50")}
              >
                <td className={cn(bodyCell, "text-left font-mono text-[11px] text-gray-500 whitespace-nowrap")} style={rowStyle}>
                  {startSno + i}
                </td>
                <td className={cn(bodyCell, "text-left")} style={rowStyle}>
                  <PlayerNameCell showPhoto={showPhoto} placeholder />
                </td>
                {cols.has("age") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("city") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("mobileNumber") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("email") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("categoryName") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("role") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("jerseyNumber") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("jerseySize") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                {cols.has("status") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
                <td className={bodyCell} style={rowStyle}>&nbsp;</td>
                {cols.has("remainingBalance") && <td className={bodyCell} style={rowStyle}>&nbsp;</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ReportPreview({
  report,
  cols,
  showSponsors,
  orientation = "portrait",
  zoomMode = "fit",
  tournamentStatus,
}: {
  report: ReportData;
  cols: Set<ColKey>;
  showSponsors: boolean;
  orientation?: "portrait" | "landscape";
  zoomMode?: "fit" | "actual";
  tournamentStatus?: string;
}) {
  const { tournament, team, purgeSummary, retainedPlayers, preSoldPlayers, nonPlayingMembers, squadInfo, auctionRules, sponsors = [] } = report;
  const { logos, brandName, poweredByText, miniBrandText, loading: brandingLoading, visibility, iconVersion } = useBranding();
  const logoAlt = getBrandLogoAlt(brandName);
  const showPhoto = cols.has("photo");
  const allAcquired = retainedPlayers.length + preSoldPlayers.length;
  const isLicensed = report.isLicensed;
  const isCompleted = (tournament as any)?.status === "completed" || report.tournament?.licenseStatus === "completed" || tournamentStatus === "completed";
  const isLive = (tournament as any)?.status === "live" || (tournament as any)?.status === "in_progress" || tournamentStatus === "live" || tournamentStatus === "in_progress";
  const reportHeading = isCompleted ? "Official Squad & Purse Reconciliation" : isLive ? "Live Squad & Purse Tracker" : "Pre-Auction Team Report";
  const acquiredSectionLabel = isCompleted ? `Auction Acquisitions (${preSoldPlayers.length})` : `Pre-Sold Players (${preSoldPlayers.length})`;
  const acquiredSpendLabel = isCompleted || isLive ? "Auction Spend" : "Pre-Sold Spend";
  const remainingPurseLabel = isCompleted ? "Unspent Purse" : "Remaining Purse";
  const brandLogoUrl = cldUrl(logos.mainReverse || logos.main || logos.mini, "brandWordmark") || logos.mainReverse || logos.main || logos.mini;
  const platformLogoUrl = getPublicBrandLogoSrc(["mainReverse", "main", "mini"], iconVersion);
  const websiteUrl = report.platform?.websiteUrl ?? PLATFORM_BASE_URL;
  const auctionUnit = normalizeAuctionUnit(tournament.auctionUnit);
  const formatAmount = (amount: number) => formatShortIndianRupee(amount, auctionUnit);
  const auctionRuleLines = buildAuctionRuleLines(auctionRules, formatAmount);
  const hasNonPlayingMembers = nonPlayingMembers.length > 0;
  const visibleSponsors = showSponsors ? sponsors.filter((sponsor) => sponsor.name?.trim()) : [];
  const tablesRef = useRef<HTMLDivElement>(null);
  const acquiredTablesRef = useRef<HTMLDivElement>(null);
  const [planningSheetLayout, setPlanningSheetLayout] = useState({
    displayRows: squadInfo.planningRows,
    rowHeight: PLANNING_ROW_MIN_PX,
  });

  useLayoutEffect(() => {
    const tablesEl = tablesRef.current;
    if (!tablesEl) return;

    const measure = () => {
      const tablesHeight = tablesEl.clientHeight;
      const acquiredHeight = acquiredTablesRef.current?.offsetHeight ?? 0;
      const availableForRows = tablesHeight
        - acquiredHeight
        - PLANNING_SECTION_TITLE_PX
        - PLANNING_TABLE_HEAD_PX
        - 8;

      const minRows = squadInfo.planningRows;
      const maxRows = Math.max(minRows, squadInfo.slotsRemaining || minRows);

      if (availableForRows <= 0) {
        setPlanningSheetLayout({ displayRows: minRows, rowHeight: PLANNING_ROW_MIN_PX });
        return;
      }

      const rowsThatFit = Math.floor(availableForRows / PLANNING_ROW_MIN_PX);
      const displayRows = Math.max(minRows, Math.min(rowsThatFit, maxRows));
      const rowHeight = Math.max(PLANNING_ROW_MIN_PX, Math.floor(availableForRows / displayRows));

      setPlanningSheetLayout({ displayRows, rowHeight });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tablesEl);
    return () => observer.disconnect();
  }, [
    squadInfo.planningRows,
    squadInfo.slotsRemaining,
    retainedPlayers.length,
    preSoldPlayers.length,
    cols,
    showPhoto,
    showSponsors,
    auctionRuleLines.length,
    hasNonPlayingMembers,
    visibleSponsors.length,
  ]);

  return (
    <div
      id="print-report"
      className={cn(
        "report-sheet relative mx-auto flex flex-col bg-white text-gray-900 transition-all",
        zoomMode === "actual"
          ? orientation === "landscape"
            ? "w-[297mm] min-h-[210mm] max-w-[297mm]"
            : "w-[210mm] min-h-[297mm] max-w-[210mm]"
          : orientation === "landscape"
            ? "w-full max-w-[297mm] min-h-[210mm]"
            : "w-full max-w-[210mm] min-h-[297mm]",
      )}
    >
      {!isLicensed && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden"
          aria-hidden
        >
          <span
            className="text-gray-300 font-black select-none"
            style={{
              fontSize: "clamp(48px, 10vw, 96px)",
              transform: "rotate(-30deg)",
              opacity: 0.18,
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
            }}
          >
            UNLICENSED COPY
          </span>
        </div>
      )}

      {/* Header */}
      <div className="print-header flex-shrink-0 bg-slate-900 text-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 px-4 py-2">
          <img
            src={platformLogoUrl}
            alt={logoAlt}
            className="h-9 w-auto max-w-[150px] flex-shrink-0 object-contain"
          />
          <p className="flex-1 text-center text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
            {reportHeading}
          </p>
          <p className="flex-shrink-0 text-[10px] text-slate-500">
            {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 px-4 py-1.5">
          <div className="flex min-w-0 items-start gap-2">
            {tournament.logoUrl ? (
              <img src={cldUrl(tournament.logoUrl, "teamLogo") || tournament.logoUrl} alt={tournament.name} className="mt-0.5 h-8 w-8 flex-shrink-0 rounded object-contain" />
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase leading-snug text-yellow-400">{tournament.name}</p>
              <p className="text-[10px] capitalize text-slate-500">{tournament.sport}</p>
            </div>
          </div>
          <div className="flex-shrink-0 rounded border border-slate-500/70 bg-white px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">{isCompleted ? "Status" : "Access Code"}</p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-[0.2em] text-slate-500">{isCompleted ? "COMPLETED" : "_ _ _ _ _ _"}</p>
          </div>
        </div>

        <div className={cn(
          "grid gap-3 px-4 py-2",
          hasNonPlayingMembers ? "grid-cols-3" : "grid-cols-2",
        )}>
          <div className="flex min-w-0 items-center gap-2.5">
            {team.logoUrl ? (
              <img src={cldUrl(team.logoUrl, "teamLogo") || team.logoUrl} alt={team.name} className="h-10 w-10 flex-shrink-0 rounded object-contain" />
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-xs font-black" style={{ backgroundColor: (team.color || "#3B82F6") + "33", color: team.color || "#3B82F6" }}>
                {team.shortCode}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black leading-tight" style={{ color: team.color || "#FBBF24" }}>{team.name}</p>
              <div className="mt-1 flex items-center gap-2">
                {team.ownerPhotoUrl ? (
                  <img
                    src={cldUrl(team.ownerPhotoUrl, "playerCard") || team.ownerPhotoUrl}
                    alt={team.ownerName}
                    className="h-11 w-11 flex-shrink-0 rounded-full border border-slate-600 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-800">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-200">{team.ownerName}</p>
                  {team.ownerMobile ? <p className="font-mono text-[11px] text-slate-400">{team.ownerMobile}</p> : null}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Purse Summary</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {[
                { label: "Total Purse", value: formatAmount(purgeSummary.totalPurse), highlight: false },
                { label: "Retained Spend", value: formatAmount(purgeSummary.retainedSpend), highlight: false },
                { label: acquiredSpendLabel, value: formatAmount(purgeSummary.preSoldSpend), highlight: false },
                { label: remainingPurseLabel, value: formatAmount(purgeSummary.remainingPurse), highlight: true },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] text-slate-500">{item.label}</p>
                  <p className={cn("text-xs font-bold", item.highlight ? "text-yellow-400" : "text-slate-200")}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {hasNonPlayingMembers ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Non-Playing Members</p>
              <div className="space-y-0.5">
                {nonPlayingMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-600" />
                    <span className="truncate text-[11px] text-slate-300">
                      {member.name}
                      {member.role ? <span className="text-slate-500"> ({member.role.replace(/_/g, " ")})</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tables */}
      <div ref={tablesRef} className="flex min-h-0 flex-1 flex-col px-4 py-2 print-tables">
        <div ref={acquiredTablesRef} className="flex-shrink-0">
          {retainedPlayers.length === 0 && preSoldPlayers.length === 0 && (
            <p className="mb-4 flex-shrink-0 text-sm italic text-gray-400">No retained or pre-sold players assigned to this team.</p>
          )}

          <PlayerTable
            players={retainedPlayers}
            cols={cols}
            initialBalance={purgeSummary.totalPurse}
            sectionLabel={`Retained Players (${retainedPlayers.length})`}
            showPhoto={showPhoto}
          />

          <PlayerTable
            players={preSoldPlayers}
            cols={cols}
            initialBalance={purgeSummary.totalPurse - purgeSummary.retainedSpend}
            sectionLabel={acquiredSectionLabel}
            showPhoto={showPhoto}
          />
        </div>

        <AuctionPlanningTable
          displayRows={planningSheetLayout.displayRows}
          rowHeight={planningSheetLayout.rowHeight}
          startSno={allAcquired + 1}
          cols={cols}
          showPhoto={showPhoto}
        />
      </div>

      {/* Footer */}
      <div className="print-footer mt-auto flex flex-shrink-0 flex-col bg-slate-900 text-white">
        {auctionRuleLines.length > 0 ? (
          <div className="border-b border-slate-700/60 px-4 py-1">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Auction Rules</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {auctionRuleLines.map((line) => (
                <p key={line} className="text-[9px] leading-snug text-slate-400">{line}</p>
              ))}
            </div>
          </div>
        ) : null}
        {visibleSponsors.length > 0 ? (
          <div className="border-b border-slate-700/60 px-4 py-2 text-center">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Sponsors</p>
            <p className="text-[10px] leading-relaxed text-slate-300">
              {visibleSponsors.map((sponsor) => sponsor.name).join("  ·  ")}
            </p>
          </div>
        ) : null}
        <div className="flex items-center justify-between px-4 py-2.5">
          {visibility.showBrandingPdf ? (
            <div className="flex min-w-0 items-center gap-2">
              {!brandingLoading && brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={logoAlt}
                  className="h-5 w-auto max-w-[72px] flex-shrink-0 rounded object-contain"
                />
              ) : (
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-yellow-400">
                  <span className="text-xs font-black text-slate-900">{miniBrandText}</span>
                </div>
              )}
              <span className="truncate text-[10px] font-bold text-yellow-400">{poweredByText}</span>
            </div>
          ) : (
            <div />
          )}
          <span className="max-w-[45%] truncate text-center text-[10px] text-slate-500">{team.name} — Confidential</span>
          {!isLicensed ? (
            <span className="flex-shrink-0 text-[10px] font-semibold text-red-400">UNLICENSED COPY</span>
          ) : (
            <span className="flex-shrink-0 text-[10px] text-slate-500">{websiteUrl.replace(/^https?:\/\//, "")}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const TEAM_PLANNING_SHEET_ID = "team_planning_sheet";

export function TeamPlanningWorkspace({
  tournamentId,
  embedded = false,
}: {
  tournamentId: number;
  embedded?: boolean;
}) {

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [cols, setCols] = useState<Set<ColKey>>(() => loadCols(tournamentId));
  const [showSponsors, setShowSponsors] = useState(() => loadShowSponsors(tournamentId));
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [zoomMode, setZoomMode] = useState<"fit" | "actual">("fit");
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: teamList, isLoading: loadingTeams } = useGetTeamReportList(tournamentId, {
    query: { queryKey: getGetTeamReportListQueryKey(tournamentId), enabled: !!tournamentId && tournament?.licenseStatus === "active" },
  });

  useEffect(() => {
    if (selectedTeamId != null || !teamList?.length) return;
    setSelectedTeamId(teamList[0].teamId);
  }, [teamList, selectedTeamId]);

  const { data: report, isLoading: loadingReport } = useGetTeamReport(tournamentId, selectedTeamId ?? 0, {
    query: { queryKey: getGetTeamReportQueryKey(tournamentId, selectedTeamId ?? 0), enabled: !!selectedTeamId && tournament?.licenseStatus === "active" },
  }) as { data: ReportData | undefined; isLoading: boolean };

  function toggleCol(key: ColKey) {
    const next = new Set(cols);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCols(next);
    saveCols(tournamentId, next);
  }

  function toggleShowSponsors(checked: boolean) {
    setShowSponsors(checked);
    saveShowSponsors(tournamentId, checked);
  }

  function applyPreset(preset: keyof typeof PRESETS) {
    const next = new Set<ColKey>(PRESETS[preset]);
    setCols(next);
    saveCols(tournamentId, next);
  }

  async function handlePrint() {
    if (!selectedTeamId || !report) return;
    const element = document.getElementById("print-report");
    if (!element) {
      toast({ title: "Print failed", description: "Report preview not found.", variant: "destructive" });
      return;
    }

    setPrinting(true);
    try {
      await printElementAsPdf(element, { orientation });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while preparing the print preview.";
      toast({ title: "Print failed", description: message, variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  }

  async function handleExportPdf() {
    if (!selectedTeamId || !report) return;
    const element = document.getElementById("print-report");
    if (!element) {
      toast({ title: "Export failed", description: "Report preview not found.", variant: "destructive" });
      return;
    }

    setExporting(true);
    try {
      const teamName = report.team.name || "team";
      const isCompleted = tournament?.status === "completed" || report.tournament?.licenseStatus === "completed";
      await exportElementToPdf(
        element,
        `${teamName.replace(/[^a-zA-Z0-9]/g, "_")}_${isCompleted ? "Squad_Reconciliation" : "PreAuction"}_Report.pdf`,
        { orientation },
      );
      toast({ title: "PDF exported", description: isCompleted ? "Your squad reconciliation report has been downloaded." : "Your pre-auction report has been downloaded." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while creating the PDF.";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const isLicensed = tournament?.licenseStatus === "active";
  const currentPreset = matchingPreset(cols);
  const reportReady = Boolean(selectedTeamId && report);

  if (!isLicensed && tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-1">Licensed feature</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            Team planning sheets are available for licensed tournaments. Contact support to activate the license.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { size: A4 ${orientation}; margin: 0; }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          .print-hide { display: none !important; }

          body * {
            visibility: hidden !important;
          }
          #print-report,
          #print-report * {
            visibility: visible !important;
          }
          #print-report {
            position: fixed !important;
            inset: 0 !important;
            width: ${orientation === "landscape" ? "297mm" : "210mm"} !important;
            max-width: ${orientation === "landscape" ? "297mm" : "210mm"} !important;
            min-height: ${orientation === "landscape" ? "210mm" : "297mm"} !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
            height: auto !important;
            z-index: 2147483647 !important;
            page-break-inside: avoid;
          }

          #print-report .print-header,
          #print-report .print-footer,
          #print-report .bg-slate-900,
          #print-report .bg-slate-800,
          #print-report .bg-white {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #print-report .print-tables {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
          }

          #print-report .print-row,
          #print-report .print-section,
          #print-report .print-table {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #print-report .print-header,
          #print-report .print-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

        <div className={embedded ? "flex h-full min-h-[680px] flex-col" : "flex h-full min-h-0 flex-col -m-8"}>
          <header className="print-hide flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0">
              <TournamentContextLabel tournament={tournament} className="mb-1" />
              <h1 className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4 text-primary" />
                {tournament?.status === "completed" ? "Squad & purse reports" : "Planning sheets"}
              </h1>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="outline" size="sm" disabled={!reportReady || printing || exporting}>
                {printing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-1.5 h-3.5 w-3.5" />}
                {printing ? "Preparing..." : "Print"}
              </Button>
              <Button onClick={handleExportPdf} size="sm" disabled={!reportReady || exporting || printing}>
                {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                {exporting ? "Exporting..." : "Export PDF"}
              </Button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <aside className={cn("print-hide flex shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-card", embedded ? "w-52" : "w-60")}>
              <p className="px-4 pb-1.5 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Teams</p>
              {loadingTeams ? (
                <div className="space-y-1 px-2 pb-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : !teamList?.length ? (
                <p className="px-4 pb-3 text-xs text-muted-foreground">No teams yet.</p>
              ) : (
                <div className="space-y-0.5 px-2 pb-3">
                  {teamList.map((team) => {
                    const acquired = team.retainedCount + team.preSoldCount;
                    const detail = acquired > 0 || team.nonPlayingCount > 0
                      ? `${acquired} acquired${team.nonPlayingCount > 0 ? ` · ${team.nonPlayingCount} non-playing` : ""}`
                      : team.shortCode;
                    return (
                      <button
                        key={team.teamId}
                        type="button"
                        onClick={() => setSelectedTeamId(team.teamId)}
                        className={`flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${
                          selectedTeamId === team.teamId
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {team.logoUrl ? (
                          <img src={cldUrl(team.logoUrl, "teamLogo") || team.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold" style={{ backgroundColor: (team.color || "#3B82F6") + "33", color: team.color || "#3B82F6" }}>
                            {team.shortCode.slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{team.teamName}</p>
                          <p className="truncate text-xs text-muted-foreground/70">{detail}</p>
                        </div>
                        {selectedTeamId === team.teamId ? <ChevronRight className="h-3 w-3 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <main className="flex min-w-0 flex-1 flex-col bg-muted/30">
              <div className="print-hide border-b border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Columns</span>
                    {PRESET_KEYS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={cn(
                          "rounded border px-2 py-1 text-xs capitalize transition-colors",
                          currentPreset === preset
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">View</span>
                      <button
                        type="button"
                        onClick={() => setZoomMode("fit")}
                        title="Fit sheet width cleanly to your screen"
                        className={cn(
                          "rounded border px-2 py-1 text-xs transition-colors",
                          zoomMode === "fit"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        Fit to Screen
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomMode("actual")}
                        title="Inspect exact A4 print size (100%)"
                        className={cn(
                          "rounded border px-2 py-1 text-xs transition-colors",
                          zoomMode === "actual"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        100% (A4)
                      </button>
                    </div>
                    <div className="flex items-center gap-1 border-l border-border pl-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Orientation</span>
                      <button
                        type="button"
                        onClick={() => setOrientation("portrait")}
                        className={cn(
                          "rounded border px-2.5 py-1 text-xs transition-colors",
                          orientation === "portrait"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        Portrait (A4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrientation("landscape")}
                        className={cn(
                          "rounded border px-2.5 py-1 text-xs transition-colors",
                          orientation === "landscape"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        Landscape (Wide)
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-4">
                  {OPTIONAL_COLS.map((col) => (
                    <label key={col.key} className="flex min-w-0 cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={cols.has(col.key)}
                        onCheckedChange={() => toggleCol(col.key)}
                        className="shrink-0"
                      />
                      <span className="truncate text-xs text-muted-foreground">{col.label}</span>
                    </label>
                  ))}
                  <label className="flex min-w-0 cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={showSponsors}
                      onCheckedChange={(checked) => toggleShowSponsors(checked === true)}
                      className="shrink-0"
                    />
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Award className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Sponsors in footer</span>
                    </span>
                  </label>
                </div>
                {showSponsors && report && !report.sponsors?.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">No sponsors configured for this tournament.</p>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loadingTeams || (selectedTeamId != null && loadingReport) ? (
                  <div className="space-y-4 p-6">
                    <Skeleton className="h-36" />
                    <Skeleton className="h-48" />
                    <Skeleton className="h-64" />
                  </div>
                ) : !teamList?.length ? (
                  <div className="flex h-full items-center justify-center p-8 text-center">
                    <p className="text-sm text-muted-foreground">Add teams before building a planning sheet.</p>
                  </div>
                ) : !report ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Could not load this sheet. Check that the tournament license is active.</p>
                  </div>
                ) : (
                  <div className={embedded ? "p-3 sm:p-4" : "p-4 sm:p-6"}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: report.team.color || "#3B82F6" }} />
                        <span className="text-sm font-semibold">{report.team.name}</span>
                        <Badge variant="outline" className="text-xs">{tournament?.status === "completed" ? "Squad sheet" : "Planning sheet"}</Badge>
                        {!report.isLicensed ? (
                          <Badge variant="destructive" className="text-xs">Unlicensed</Badge>
                        ) : null}
                      </div>
                      {zoomMode === "actual" && (
                        <span className="text-[11px] text-muted-foreground">Showing 100% A4 print size (horizontal scroll enabled)</span>
                      )}
                    </div>
                    <div className="mx-auto max-w-full overflow-x-auto rounded-lg border border-border bg-slate-900/40 p-1 sm:p-2 shadow-xl">
                      <ReportPreview
                        report={report}
                        cols={cols}
                        showSponsors={showSponsors}
                        orientation={orientation}
                        zoomMode={zoomMode}
                        tournamentStatus={tournament?.status}
                      />
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
    </>
  );
}

export default function TeamReportsPage() {
  const [, params] = useRoute("/tournament/:id/team-reports");
  const tournamentId = parseInt(params?.id || "0");
  return (
    <AppLayout tournamentId={tournamentId}>
      <TeamPlanningWorkspace tournamentId={tournamentId} />
    </AppLayout>
  );
}
