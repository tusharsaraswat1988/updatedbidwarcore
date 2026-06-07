import { useState, useRef, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import {
  FileText, Printer, Download, Lock, Users, ChevronRight,
  User, AlertTriangle, Loader2,
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
  { key: "status",           label: "Type (Retained/Pre-Sold)" },
  { key: "remainingBalance", label: "Remaining Balance" },
] as const;
type ColKey = typeof OPTIONAL_COLS[number]["key"];

const PRESETS: Record<"basic" | "auction" | "detailed", ColKey[]> = {
  basic:    [],
  auction:  ["photo", "categoryName", "remainingBalance"],
  detailed: ["photo", "mobileNumber", "email", "age", "city", "categoryName", "role", "jerseyNumber", "status", "remainingBalance"],
};

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

type ReportPlayer = {
  id: number; name: string; role: string | null; city: string | null; age: number | null;
  photoUrl: string | null; mobileNumber: string | null; email: string | null; jerseyNumber: string | null;
  categoryName: string | null; categoryColor: string | null;
  soldPrice: number | null; retainedPrice: number | null;
  status: string; isNonPlayingMember: boolean;
};

type ReportData = {
  isLicensed: boolean;
  tournament: { id: number; name: string; sport: string; logoUrl: string | null; licenseStatus: string; minimumSquadSize: number; maximumSquadSize: number };
  team: { id: number; name: string; shortCode: string; ownerName: string; ownerMobile: string; ownerEmail: string | null; ownerPhotoUrl: string | null; logoUrl: string | null; color: string | null; purse: number; purseUsed: number };
  purgeSummary: { totalPurse: number; retainedSpend: number; preSoldSpend: number; remainingPurse: number };
  retainedPlayers: ReportPlayer[];
  preSoldPlayers: ReportPlayer[];
  nonPlayingMembers: ReportPlayer[];
  categories: { id: number; name: string; colorCode: string | null }[];
  squadInfo: { totalAcquired: number; slotsRemaining: number; planningRows: number };
};

function PlayerPhoto({ url, name, small }: { url: string | null; name: string; small?: boolean }) {
  const size = small ? "w-7 h-7" : "w-10 h-10";
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

function PlayerTable({
  players, startSno, cols, initialBalance, sectionLabel, showPhoto,
}: {
  players: ReportPlayer[];
  startSno: number;
  cols: Set<ColKey>;
  initialBalance: number;
  sectionLabel: string;
  showPhoto: boolean;
}) {
  if (players.length === 0) return null;

  let balance = initialBalance;

  return (
    <div className="mb-4 flex-shrink-0 print-section">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 px-1 print-section-heading">{sectionLabel}</h3>
      <table className="w-full table-fixed border-collapse border border-gray-400 text-sm">
        <thead>
          <tr className="bg-slate-800 text-yellow-400 print-table-header">
            <th className="w-12 border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">S.No</th>
            {showPhoto && <th className="w-14 border border-gray-400 px-2 py-2" />}
            <th className="border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Player Name</th>
            {cols.has("age") && <th className="w-14 border border-gray-400 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">Age</th>}
            {cols.has("city") && <th className="w-24 border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">City</th>}
            {cols.has("mobileNumber") && <th className="w-28 border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Mobile</th>}
            {cols.has("email") && <th className="w-36 border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Email</th>}
            {cols.has("categoryName") && <th className="w-28 border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Category</th>}
            {cols.has("role") && <th className="w-24 border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Role</th>}
            {cols.has("jerseyNumber") && <th className="w-16 border border-gray-400 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">Jersey</th>}
            {cols.has("status") && <th className="w-24 border border-gray-400 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Type</th>}
            <th className="w-24 border border-gray-400 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Amount</th>
            {cols.has("remainingBalance") && <th className="w-24 border border-gray-400 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Balance</th>}
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const price = p.status === "retained" ? (p.retainedPrice ?? 0) : (p.soldPrice ?? 0);
            balance -= price;
            const rowBalance = balance;
            const cell = "border border-gray-400 px-3 py-2 align-top";
            return (
              <tr key={p.id} className={`print-row ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className={`${cell} text-xs text-gray-500`}>{startSno + i}</td>
                {showPhoto && (
                  <td className={`${cell} py-1`}>
                    <PlayerPhoto url={p.photoUrl} name={p.name} small />
                  </td>
                )}
                <td className={`${cell} font-semibold text-gray-900`}>{p.name}</td>
                {cols.has("age") && <td className={`${cell} text-center text-gray-600`}>{p.age ?? "-"}</td>}
                {cols.has("city") && <td className={`${cell} text-gray-600`}>{p.city || "-"}</td>}
                {cols.has("mobileNumber") && <td className={`${cell} font-mono text-xs text-gray-600`}>{p.mobileNumber || "-"}</td>}
                {cols.has("email") && <td className={`${cell} text-xs text-gray-600 break-all`}>{p.email || "-"}</td>}
                {cols.has("categoryName") && (
                  <td className={cell}>
                    {p.categoryName ? (
                      <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: (p.categoryColor || "#3B82F6") + "22", color: p.categoryColor || "#3B82F6" }}>
                        {p.categoryName}
                      </span>
                    ) : "-"}
                  </td>
                )}
                {cols.has("role") && <td className={`${cell} capitalize text-gray-600`}>{p.role?.replace(/_/g, " ") || "-"}</td>}
                {cols.has("jerseyNumber") && <td className={`${cell} text-center text-gray-600`}>{p.jerseyNumber || "-"}</td>}
                {cols.has("status") && (
                  <td className={cell}>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${p.status === "retained" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {p.status === "retained" ? "Retained" : "Pre-Sold"}
                    </span>
                  </td>
                )}
                <td className={`${cell} text-right font-mono font-semibold text-gray-900`}>{formatShortIndianRupee(price)}</td>
                {cols.has("remainingBalance") && (
                  <td className={`${cell} text-right font-mono font-semibold text-emerald-700`}>{formatShortIndianRupee(rowBalance)}</td>
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
  planningRows,
  startSno,
  className,
}: {
  planningRows: number;
  startSno: number;
  className?: string;
}) {
  const headCell = "border border-gray-400 px-3 py-2 text-xs font-bold uppercase tracking-wider";
  const bodyCell = "border border-gray-400 px-3 py-2 align-top";

  return (
    <div className={cn("print-section flex min-h-0 flex-col", className)}>
      <h3 className="mb-2 flex-shrink-0 px-1 text-xs font-bold uppercase tracking-widest text-gray-500">
        Auction Working Sheet — {planningRows} Slots
      </h3>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <table className="h-full w-full table-fixed border-collapse border border-gray-400 text-sm">
          <colgroup>
            <col style={{ width: "48px" }} />
            <col />
            <col style={{ width: "28%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-800 text-yellow-400 print-table-header">
              <th className={`${headCell} text-left`}>S.No</th>
              <th className={`${headCell} text-left`}>Player Name</th>
              <th className={`${headCell} text-left`}>Category</th>
              <th className={`${headCell} text-right`}>Amount</th>
              <th className={`${headCell} text-right`}>Balance</th>
            </tr>
          </thead>
          <tbody className="h-full">
            {Array.from({ length: planningRows }, (_, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                style={{ height: `${100 / planningRows}%` }}
              >
                <td className={`${bodyCell} text-xs text-gray-500`}>{startSno + i}</td>
                <td className={bodyCell}>&nbsp;</td>
                <td className={bodyCell}>&nbsp;</td>
                <td className={bodyCell}>&nbsp;</td>
                <td className={bodyCell}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportPreview({ report, cols }: { report: ReportData; cols: Set<ColKey> }) {
  const { tournament, team, purgeSummary, retainedPlayers, preSoldPlayers, nonPlayingMembers, squadInfo } = report;
  const { logos, brandName, poweredByText, miniBrandText, loading: brandingLoading, visibility } = useBranding();
  const showPhoto = cols.has("photo");
  const allAcquired = retainedPlayers.length + preSoldPlayers.length;
  const isLicensed = report.isLicensed;
  const brandLogoUrl = cldUrl(logos.mini || logos.main, "headerLogo") || logos.mini || logos.main;

  return (
    <div
      id="print-report"
      className="relative flex min-h-[297mm] flex-col bg-white text-gray-900"
      style={{ height: "297mm", width: "210mm", maxWidth: "100%", margin: "0 auto" }}
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
      <div className="print-header flex-shrink-0 bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {tournament.logoUrl ? (
              <img src={cldUrl(tournament.logoUrl, "teamLogo") || tournament.logoUrl} alt={tournament.name} className="h-10 w-10 object-contain rounded" />
            ) : (
              <div className="h-10 w-10 rounded bg-yellow-400 flex items-center justify-center">
                <span className="text-slate-900 font-black text-xs">BW</span>
              </div>
            )}
            <div>
              <p className="text-yellow-400 font-black text-base uppercase tracking-wide">{tournament.name}</p>
              <p className="text-slate-400 text-xs uppercase tracking-wider">{tournament.sport} · Pre-Auction Team Report</p>
            </div>
          </div>
          <p className="text-slate-400 text-xs">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Left: Team + Owner */}
          <div className="flex items-start gap-3">
            {team.logoUrl ? (
              <img src={cldUrl(team.logoUrl, "teamLogo") || team.logoUrl} alt={team.name} className="h-12 w-12 object-contain rounded flex-shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded flex-shrink-0 flex items-center justify-center font-black text-sm" style={{ backgroundColor: (team.color || "#3B82F6") + "33", color: team.color || "#3B82F6" }}>
                {team.shortCode}
              </div>
            )}
            <div>
              <p className="font-black text-lg leading-tight" style={{ color: team.color || "#FBBF24" }}>{team.name}</p>
              <p className="text-slate-400 text-xs">{team.shortCode}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                {team.ownerPhotoUrl && (
                  <img
                    src={cldUrl(team.ownerPhotoUrl, "playerCard") || team.ownerPhotoUrl}
                    alt={team.ownerName}
                    className="h-6 w-6 flex-shrink-0 rounded-full border border-slate-600 object-cover"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-200">{team.ownerName}</p>
                  {team.ownerMobile && <p className="font-mono text-xs text-slate-400">{team.ownerMobile}</p>}
                  {team.ownerEmail && <p className="text-xs text-slate-400 break-all">{team.ownerEmail}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Center: Purse Summary */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Purse Summary</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { label: "Total Purse", value: formatShortIndianRupee(purgeSummary.totalPurse), highlight: false },
                { label: "Retained Spend", value: formatShortIndianRupee(purgeSummary.retainedSpend), highlight: false },
                { label: "Pre-Sold Spend", value: formatShortIndianRupee(purgeSummary.preSoldSpend), highlight: false },
                { label: "Remaining Purse", value: formatShortIndianRupee(purgeSummary.remainingPurse), highlight: true },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-slate-500 text-xs">{item.label}</p>
                  <p className={`font-bold text-sm ${item.highlight ? "text-yellow-400" : "text-slate-200"}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Non-playing members */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Non-Playing Members</p>
            {nonPlayingMembers.length === 0 ? (
              <p className="text-slate-600 text-xs italic">None listed</p>
            ) : (
              <div className="space-y-1">
                {nonPlayingMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                    <span className="text-slate-300 text-xs">{m.name}{m.role ? <span className="text-slate-500"> ({m.role.replace(/_/g, " ")})</span> : null}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-3">
        {retainedPlayers.length === 0 && preSoldPlayers.length === 0 && (
          <p className="mb-4 flex-shrink-0 text-sm italic text-gray-400">No retained or pre-sold players assigned to this team.</p>
        )}

        <PlayerTable
          players={retainedPlayers}
          startSno={1}
          cols={cols}
          initialBalance={purgeSummary.totalPurse}
          sectionLabel={`Retained Players (${retainedPlayers.length})`}
          showPhoto={showPhoto}
        />

        <PlayerTable
          players={preSoldPlayers}
          startSno={retainedPlayers.length + 1}
          cols={cols}
          initialBalance={purgeSummary.totalPurse - purgeSummary.retainedSpend}
          sectionLabel={`Pre-Sold Players (${preSoldPlayers.length})`}
          showPhoto={showPhoto}
        />

        <AuctionPlanningTable
          planningRows={squadInfo.planningRows}
          startSno={allAcquired + 1}
          className="min-h-0 flex-1"
        />
      </div>

      {/* Footer */}
      <div className="print-footer mt-0 flex flex-shrink-0 items-center justify-between bg-slate-900 px-6 py-3 text-white">
        {visibility.showBrandingPdf ? (
          <div className="flex items-center gap-2">
            {!brandingLoading && brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={brandName}
                className="h-5 w-5 flex-shrink-0 rounded object-contain"
              />
            ) : (
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-yellow-400">
                <span className="text-xs font-black text-slate-900">{miniBrandText}</span>
              </div>
            )}
            <span className="text-xs font-bold text-yellow-400">{poweredByText}</span>
          </div>
        ) : (
          <div />
        )}
        <span className="text-slate-500 text-xs">{team.name} — Pre-Auction Team Sheet — Confidential</span>
        {!isLicensed && (
          <span className="text-red-400 text-xs font-semibold">UNLICENSED COPY</span>
        )}
      </div>
    </div>
  );
}

export default function TeamReportsPage() {
  const [, params] = useRoute("/tournament/:id/team-reports");
  const tournamentId = parseInt(params?.id || "0");

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [cols, setCols] = useState<Set<ColKey>>(() => loadCols(tournamentId));
  const [exporting, setExporting] = useState(false);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: teamList, isLoading: loadingTeams } = useGetTeamReportList(tournamentId, {
    query: { queryKey: getGetTeamReportListQueryKey(tournamentId), enabled: !!tournamentId && tournament?.licenseStatus === "active" },
  });

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

  function applyPreset(preset: keyof typeof PRESETS) {
    const next = new Set<ColKey>(PRESETS[preset]);
    setCols(next);
    saveCols(tournamentId, next);
  }

  function handlePrint() {
    window.print();
  }

  async function handleExportPdf() {
    if (!selectedTeamId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/team-reports/${selectedTeamId}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ columns: [...cols] }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const teamName = report?.team.name || "team";
      a.download = `${teamName.replace(/[^a-zA-Z0-9]/g, "_")}_PreAuction_Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* empty */
    } finally {
      setExporting(false);
    }
  }

  const isLicensed = tournament?.licenseStatus === "active";

  if (!isLicensed && tournament) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="flex flex-col items-center justify-center min-h-96 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">Team Reports — Licensed Feature</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Pre-auction team reports are available only for licensed tournaments. Contact support to activate the license for this tournament.
            </p>
          </div>
        </div>
      </AppLayout>
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
          @page { size: A4 portrait; margin: 12mm; }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Hide entire app chrome; show only the report sheet */
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
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            width: 210mm !important;
            max-width: 100% !important;
            height: 297mm !important;
            min-height: 297mm !important;
            z-index: 2147483647 !important;
          }

          .print-hide { display: none !important; }
        }
      `}</style>

      <AppLayout tournamentId={tournamentId}>
        <div className="flex gap-0 h-full -m-8">
          {/* Left panel: team list + column selector */}
          <aside className="w-72 flex-shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden print-hide">
            <div className="p-4 border-b border-border">
              <h1 className="font-bold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Team Reports
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Pre-Auction Planning Sheets</p>
            </div>

            {/* Team list */}
            <div className="flex-shrink-0 border-b border-border">
              <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Team</p>
              <div className="overflow-y-auto max-h-60">
                {loadingTeams ? (
                  <div className="space-y-1 px-2 pb-2">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : !teamList?.length ? (
                  <p className="px-4 pb-3 text-xs text-muted-foreground italic">No teams found.</p>
                ) : (
                  <div className="space-y-0.5 px-2 pb-2">
                    {teamList.map(team => (
                      <button
                        key={team.teamId}
                        onClick={() => setSelectedTeamId(team.teamId)}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors ${
                          selectedTeamId === team.teamId
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {team.logoUrl ? (
                          <img src={cldUrl(team.logoUrl, "teamLogo") || team.logoUrl} alt={team.teamName} className="w-8 h-8 object-contain rounded flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: (team.color || "#3B82F6") + "33", color: team.color || "#3B82F6" }}>
                            {team.shortCode.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs truncate">{team.teamName}</p>
                          <p className="text-xs text-muted-foreground/70">
                            {team.retainedCount + team.preSoldCount} acquired · {team.nonPlayingCount} non-playing
                          </p>
                        </div>
                        {selectedTeamId === team.teamId && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Column selector */}
            <div className="flex-1 overflow-y-auto">
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Columns</p>
              <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                {(["basic", "auction", "detailed"] as const).map(preset => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    className="text-xs px-2 py-1 rounded border border-border hover:border-primary hover:text-primary transition-colors capitalize"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="px-3 pb-4 space-y-2">
                {OPTIONAL_COLS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                    <Checkbox
                      checked={cols.has(col.key)}
                      onCheckedChange={() => toggleCol(col.key)}
                      className="flex-shrink-0"
                    />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            {selectedTeamId && (
              <div className="p-3 border-t border-border flex flex-col gap-2">
                <Button onClick={handlePrint} variant="outline" size="sm" className="w-full" disabled={!report}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print
                </Button>
                <Button onClick={handleExportPdf} size="sm" className="w-full" disabled={!report || exporting}>
                  {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                  {exporting ? "Exporting..." : "Export PDF"}
                </Button>
              </div>
            )}
          </aside>

          {/* Main content: report preview */}
          <main className="flex-1 overflow-y-auto bg-muted/30">
            {!selectedTeamId ? (
              <div className="flex flex-col items-center justify-center min-h-full gap-4 text-center p-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">Select a Team</h2>
                  <p className="text-muted-foreground text-sm">Choose a team from the left panel to preview their pre-auction report.</p>
                </div>
              </div>
            ) : loadingReport ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-36" />
                <Skeleton className="h-48" />
                <Skeleton className="h-64" />
              </div>
            ) : !report ? (
              <div className="flex flex-col items-center justify-center min-h-full gap-3 text-center p-8">
                <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Could not load report data. Check that this tournament has an active license.</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Screen action bar */}
                <div className="print-hide flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: report.team.color || "#3B82F6" }} />
                    <span className="font-semibold text-sm">{report.team.name}</span>
                    <Badge variant="outline" className="text-xs">Pre-Auction Report</Badge>
                    {!report.isLicensed && (
                      <Badge variant="destructive" className="text-xs">Unlicensed</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handlePrint} variant="outline" size="sm">
                      <Printer className="w-3.5 h-3.5 mr-1.5" />
                      Print
                    </Button>
                    <Button onClick={handleExportPdf} size="sm" disabled={exporting}>
                      {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                      {exporting ? "Exporting..." : "Export PDF (A4)"}
                    </Button>
                  </div>
                </div>

                {/* Report preview card */}
                <div className="border border-border rounded-lg overflow-hidden shadow-xl max-w-5xl mx-auto">
                  <ReportPreview report={report} cols={cols} />
                </div>
              </div>
            )}
          </main>
        </div>
      </AppLayout>
    </>
  );
}
