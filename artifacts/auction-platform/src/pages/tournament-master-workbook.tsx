import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Download,
  Upload,
  History,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  ArrowLeft,
  Loader2,
  Link2,
  GitBranch,
  ImageIcon,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = "/api";

type ImportMode =
  | "merge_data"
  | "update_tournament"
  | "replace_data"
  | "clone_tournament"
  | "dry_run";

type WorkbookIssue = {
  sheet: string;
  row: number;
  column?: string;
  identity?: string;
  severity: "error" | "warning" | "suggestion";
  message: string;
};

type WorkbookSummary = {
  rowsTotal: number;
  creates: number;
  updates: number;
  skips: number;
  errors: number;
  warnings: number;
  suggestions?: number;
  changedFields: string[];
  sheetsProcessed: string[];
};

type WorkbookHealth = {
  score: number;
  grade: string;
  errors: number;
  warnings: number;
  suggestions: number;
};

type FieldDiff = {
  sheet: string;
  row: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: string;
};

type WorkbookPreview = {
  valid: boolean;
  summary: WorkbookSummary;
  issues: WorkbookIssue[];
  mode?: string;
  dryRun?: boolean;
  health?: WorkbookHealth;
  diffs?: FieldDiff[];
  photoValidation?: PhotoValidationSummary;
  photoQualityResults?: PhotoQualityResult[];
};

type PhotoImportMode = "replace_all" | "skip_existing" | "replace_empty_only";

type PhotoQualityResult = {
  url: string;
  qualityWarnings?: string[];
  width?: number;
  height?: number;
};

type PhotoValidationSummary = {
  found: number;
  accessible: number;
  private: number;
  broken: number;
  notImage: number;
  unsupported: number;
  skipped: number;
  qualityWarnings: number;
};

type PhotoJobProgress = {
  total: number;
  pending: number;
  processing: number;
  uploaded: number;
  failed: number;
  skipped: number;
  complete: boolean;
};

type PhotoImportSummary = PhotoJobProgress & {
  playersWithPhotos: number;
  newPhotosUploaded: number;
  existingPhotosReused: number;
  photosReplaced: number;
  warnings: number;
  processingTimeMs: number | null;
};

type PhotoJobItem = {
  id: number;
  playerId: number | null;
  playerName: string | null;
  sourceUrl: string;
  status: string;
  storedUrl: string | null;
  failureReason: string | null;
  skipReason: string | null;
  validationStatus: string | null;
  qualityWarnings?: string[] | null;
  originalStoredUrl?: string | null;
  driveFileId?: string | null;
  processingVersion?: string | null;
};

function formatProcessingTime(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

type ImportJob = {
  id: number;
  fileName: string | null;
  uploadedAt: string;
  uploadedBy: string;
  status: string;
  importMode: string | null;
  sourceType: string | null;
  totalRows: number;
  updatedRows: number;
  failedRows: number;
  processingTimeMs: number | null;
};

type WorkbookVersion = {
  id: number;
  versionLabel: string;
  createdAt: string;
  createdBy: string;
  jobId: number | null;
};

type View = "main" | "preview" | "history" | "versions" | "job-detail";

type ExportPhase = "preparing" | "building" | "downloading";

const EXPORT_STATUS: Record<ExportPhase, string> = {
  preparing: "Preparing workbook…",
  building: "Building Excel sheets…",
  downloading: "Starting download…",
};

function getTournamentId(pathname: string): number | null {
  const match = pathname.match(/\/admin\/tournaments\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^"]+)"?/);
  return match?.[1]?.trim() || fallback;
}

async function downloadExport(tournamentId: number) {
  const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/export`, { credentials: "include" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Export failed");
  }
  const blob = await r.blob();
  const fileName = filenameFromContentDisposition(
    r.headers.get("Content-Disposition"),
    `BidWar-BMW-t${tournamentId}.xlsx`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TournamentMasterWorkbookPage() {
  const [location] = useLocation();
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const { toast } = useToast();
  const tournamentId = getTournamentId(location);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportPhaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [view, setView] = useState<View>("main");
  const [importMode, setImportMode] = useState<ImportMode>("merge_data");
  const [photoImportMode, setPhotoImportMode] = useState<PhotoImportMode>("replace_empty_only");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPhase, setExportPhase] = useState<ExportPhase>("preparing");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [previewJobId, setPreviewJobId] = useState<number | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewSourceType, setPreviewSourceType] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [versions, setVersions] = useState<WorkbookVersion[]>([]);
  const [selectedJob, setSelectedJob] = useState<{
    job: ImportJob;
    items: unknown[];
    photoProgress?: PhotoJobProgress;
    photoSummary?: PhotoImportSummary;
    photoItems?: PhotoJobItem[];
  } | null>(null);
  const [confirmResult, setConfirmResult] = useState<{
    jobId: number;
    updatedRows: number;
    versionId?: number;
    photoQueued?: number;
  } | null>(null);
  const [photoProgress, setPhotoProgress] = useState<PhotoJobProgress | null>(null);
  const [photoSummary, setPhotoSummary] = useState<PhotoImportSummary | null>(null);
  const photoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/history`, { credentials: "include" });
    if (!r.ok) throw new Error("Failed to load history");
    const data = await r.json();
    setJobs(data.jobs ?? []);
  }, [tournamentId]);

  const loadVersions = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/versions`, { credentials: "include" });
    if (!r.ok) throw new Error("Failed to load versions");
    const data = await r.json();
    setVersions(data.versions ?? []);
  }, [tournamentId]);

  useEffect(() => {
    if (view === "history" && tournamentId) loadHistory().catch(() => setError("Could not load history"));
    if (view === "versions" && tournamentId) loadVersions().catch(() => setError("Could not load versions"));
  }, [view, tournamentId, loadHistory, loadVersions]);

  useEffect(() => {
    return () => {
      exportPhaseTimersRef.current.forEach(clearTimeout);
      if (photoPollRef.current) clearInterval(photoPollRef.current);
    };
  }, []);

  const pollPhotoProgress = useCallback(async (jobId: number) => {
    if (!tournamentId) return null;
    const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/jobs/${jobId}/photos`, {
      credentials: "include",
    });
    if (!r.ok) return null;
    const data = await r.json();
    setPhotoProgress(data.progress ?? null);
    setPhotoSummary(data.summary ?? null);
    return data.progress as PhotoJobProgress | null;
  }, [tournamentId]);

  const startPhotoPolling = useCallback((jobId: number) => {
    if (photoPollRef.current) clearInterval(photoPollRef.current);
    void pollPhotoProgress(jobId);
    photoPollRef.current = setInterval(() => {
      void pollPhotoProgress(jobId).then((progress) => {
        if (progress?.complete && photoPollRef.current) {
          clearInterval(photoPollRef.current);
          photoPollRef.current = null;
        }
      });
    }, 3000);
  }, [pollPhotoProgress]);

  async function loadJobDetail(jobId: number) {
    if (!tournamentId) return;
    const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/jobs/${jobId}`, {
      credentials: "include",
    });
    if (!r.ok) throw new Error("Failed to load job detail");
    const data = await r.json();
    const photoR = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/jobs/${jobId}/photos`, {
      credentials: "include",
    });
    const photoData = photoR.ok ? await photoR.json() : { progress: null, items: [] };
    setSelectedJob({
      job: data.job,
      items: data.items ?? [],
      photoProgress: data.photoProgress ?? photoData.progress,
      photoSummary: data.photoSummary ?? photoData.summary,
      photoItems: photoData.items ?? [],
    });
    setView("job-detail");
  }

  async function retryFailedPhotos(jobId: number) {
    if (!tournamentId) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/jobs/${jobId}/photos/retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Retry failed");
      toast({
        title: "Photo retry started",
        description: `${data.requeued ?? 0} failed photos re-queued for processing.`,
      });
      startPhotoPolling(jobId);
      await loadJobDetail(jobId);
    } catch (e) {
      toast({
        title: "Retry failed",
        description: e instanceof Error ? e.message : "Could not retry photos",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!tournamentId || exporting) return;

    exportPhaseTimersRef.current.forEach(clearTimeout);
    exportPhaseTimersRef.current = [];

    setExporting(true);
    setExportPhase("preparing");
    setError(null);

    exportPhaseTimersRef.current.push(
      setTimeout(() => setExportPhase("building"), 700),
      setTimeout(() => setExportPhase("downloading"), 2500),
    );

    try {
      await downloadExport(tournamentId);
      toast({
        title: "Workbook exported",
        description: "Your BidWar Master Workbook download has started.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      setError(message);
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      exportPhaseTimersRef.current.forEach(clearTimeout);
      exportPhaseTimersRef.current = [];
      setExporting(false);
      setExportPhase("preparing");
    }
  }

  async function runPreview(file?: File) {
    setBusy(true);
    setError(null);
    setConfirmResult(null);

    const form = new FormData();
    form.append("mode", importMode);
    if (file) form.append("file", file);
    if (googleSheetUrl.trim()) form.append("googleSheetUrl", googleSheetUrl.trim());

    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/preview`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Preview failed");
      setPreview({ ...data.preview, photoValidation: data.photoValidation ?? data.preview?.photoValidation, photoQualityResults: data.photoQualityResults ?? data.preview?.photoQualityResults });
      setPreviewJobId(data.jobId);
      setPreviewFileName(data.fileName);
      setPreviewSourceType(data.sourceType);
      setView("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmImport() {
    if (!previewJobId || !preview?.valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: previewJobId, photoImportMode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Import failed");
      setConfirmResult(data);
      setPreview(null);
      setView("main");
      if (data.photoQueued > 0) {
        startPhotoPolling(data.jobId);
      }
      toast({
        title: "Workbook imported",
        description: `${data.updatedRows ?? 0} changes applied (Job #${data.jobId}).${
          data.photoQueued > 0 ? ` ${data.photoQueued} photos queued.` : ""
        }`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import commit failed";
      setError(message);
      toast({ title: "Import failed", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function downloadValidationReport(issues: WorkbookIssue[]) {
    const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/validation-report`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issues }),
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bmw-validation-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !isLoggedIn) return null;

  if (!isMaster) {
    return (
      <AdminShell title="Access Denied" eyebrow="BidWar Master Workbook">
        <Card className="border-destructive/40 bg-destructive/10 p-6">
          <p className="text-sm text-destructive">BidWar Master Workbook is restricted to Super Admin only.</p>
        </Card>
      </AdminShell>
    );
  }

  if (!tournamentId) {
    return (
      <AdminShell title="BidWar Master Workbook" eyebrow="Super Admin">
        <p className="text-muted-foreground">Invalid tournament.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="BidWar Master Workbook (BMW)"
      eyebrow={`Tournament #${tournamentId} · Official Data Exchange Standard`}
    >
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/admin/tournaments/${tournamentId}/players`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Players
          </Button>
        </Link>
      </div>

      <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <strong>One Tournament = One Master Workbook.</strong> Export, edit offline in Excel, Google Sheets, or ZIP package, and import back.
        Sport-aware validation. No database IDs — players matched by Registration Code → Mobile → Email → Name+DOB.
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {confirmResult && (
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Players imported — {confirmResult.updatedRows} changes (Job #{confirmResult.jobId}
            {confirmResult.versionId ? `, Version #${confirmResult.versionId}` : ""}).
          </div>
          {photoProgress && photoProgress.total > 0 && (
            <div className="rounded-lg border border-border bg-card/70 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-white font-medium">
                {photoProgress.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                Photos {photoProgress.uploaded + photoProgress.skipped}/{photoProgress.total}
                {!photoProgress.complete && " · Processing"}
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.round(((photoProgress.uploaded + photoProgress.skipped + photoProgress.failed) / photoProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{photoProgress.uploaded} uploaded</span>
                {photoProgress.skipped > 0 && <span>{photoProgress.skipped} skipped</span>}
                {photoProgress.failed > 0 && <span className="text-amber-300">{photoProgress.failed} failed</span>}
                {!photoProgress.complete && <span>{photoProgress.pending + photoProgress.processing} remaining</span>}
              </div>
              {photoProgress.complete && photoSummary && (
                <div className="mt-4 rounded-md border border-border bg-background/40 p-3 text-xs">
                  <div className="font-medium text-white mb-2">Photo Import Summary</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                    <div><span className="text-muted-foreground">Players</span> <strong className="text-white ml-1">{photoSummary.playersWithPhotos}</strong></div>
                    <div><span className="text-muted-foreground">New Uploaded</span> <strong className="text-green-400 ml-1">{photoSummary.newPhotosUploaded}</strong></div>
                    <div><span className="text-muted-foreground">Reused</span> <strong className="text-white ml-1">{photoSummary.existingPhotosReused}</strong></div>
                    <div><span className="text-muted-foreground">Replaced</span> <strong className="text-white ml-1">{photoSummary.photosReplaced}</strong></div>
                    <div><span className="text-muted-foreground">Skipped</span> <strong className="text-white ml-1">{photoSummary.skipped}</strong></div>
                    <div><span className="text-muted-foreground">Failed</span> <strong className="text-amber-300 ml-1">{photoSummary.failed}</strong></div>
                    <div><span className="text-muted-foreground">Warnings</span> <strong className="text-amber-300 ml-1">{photoSummary.warnings}</strong></div>
                    <div><span className="text-muted-foreground">Time</span> <strong className="text-white ml-1">{formatProcessingTime(photoSummary.processingTimeMs)}</strong></div>
                  </div>
                </div>
              )}
              {photoProgress.failed > 0 && photoProgress.complete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5"
                  disabled={busy}
                  onClick={() => void retryFailedPhotos(confirmResult.jobId)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry Failed Photos
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {view === "main" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className={cn(
              "border-border bg-card/70 p-5 transition-all",
              exporting && "border-primary/40 ring-1 ring-primary/30",
            )}>
              <FileSpreadsheet className={cn("h-8 w-8 text-primary mb-3", exporting && "animate-pulse")} />
              <h3 className="font-semibold text-white">Export Workbook</h3>
              <p className="mt-1 text-xs text-muted-foreground">All 9 sheets + instructions + reference dropdowns. Admin-friendly format.</p>
              <Button
                className="mt-4 w-full gap-2"
                onClick={() => void handleExport()}
                disabled={exporting || busy}
                aria-busy={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {EXPORT_STATUS[exportPhase]}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" aria-hidden />
                    Export .xlsx
                  </>
                )}
              </Button>
              {exporting && (
                <div className="mt-3 space-y-2" role="status" aria-live="polite">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
                  </div>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Large tournaments can take a few seconds — please wait.
                  </p>
                </div>
              )}
            </Card>

            <Card className="border-border bg-card/70 p-5 md:col-span-2">
              <Upload className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-white">Import Workbook</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Import Mode</Label>
                  <Select value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge_data">Merge Data</SelectItem>
                      <SelectItem value="update_tournament">Update Tournament</SelectItem>
                      <SelectItem value="replace_data">Replace Existing</SelectItem>
                      <SelectItem value="clone_tournament">Clone Tournament</SelectItem>
                      <SelectItem value="dry_run">Dry Run (validate only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Google Sheet URL (optional)</Label>
                  <Input className="mt-1" placeholder="https://docs.google.com/spreadsheets/d/..." value={googleSheetUrl} onChange={(e) => setGoogleSheetUrl(e.target.value)} />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void runPreview(f); e.target.value = ""; }} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" className="gap-2" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload Excel or ZIP
                </Button>
                {googleSheetUrl.trim() && (
                  <Button className="gap-2" disabled={busy} onClick={() => runPreview()}>
                    <Link2 className="h-4 w-4" /> Import from Google Sheet
                  </Button>
                )}
              </div>
            </Card>

            <Card className="border-border bg-card/70 p-5">
              <History className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-white">History & Versions</h3>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="outline" className="gap-2" onClick={() => setView("history")}><History className="h-4 w-4" /> Import History</Button>
                <Button variant="outline" className="gap-2" onClick={() => setView("versions")}><GitBranch className="h-4 w-4" /> Version History</Button>
              </div>
            </Card>
          </div>

          <Card className="border-border bg-card/50 p-4">
            <h4 className="text-sm font-medium text-white mb-2">Workbook Sheets</h4>
            <div className="flex flex-wrap gap-1.5">
              {["01_Tournament", "02_Categories", "03_Players", "04_Teams", "05_Sponsors", "06_Auction_Settings", "07_Match_Settings", "08_Organizers", "09_Assets"].map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          </Card>
        </div>
      )}

      {view === "preview" && preview && (
        <Card className="border-border bg-card/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Import Preview</h3>
              <p className="text-xs text-muted-foreground mt-1">{previewFileName} · {previewSourceType ?? "excel"} · {importMode}</p>
            </div>
            <Badge className={preview.valid ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}>
              {preview.valid ? "Ready" : "Validation failed"}
            </Badge>
            {preview.health && (
              <Badge className={
                preview.health.score >= 85 ? "bg-green-500/15 text-green-400"
                : preview.health.score >= 70 ? "bg-amber-500/15 text-amber-300"
                : "bg-red-500/15 text-red-400"
              }>
                Health {preview.health.score}%
              </Badge>
            )}
          </div>

          {preview.health && (
            <div className="mt-3 rounded-lg border border-border bg-background/50 px-4 py-2 text-sm">
              Data Health: <strong className="text-white">{preview.health.score}%</strong>
              <span className="text-muted-foreground"> ({preview.health.grade})</span>
              {" · "}{preview.health.errors} errors · {preview.health.warnings} warnings
              {(preview.health.suggestions ?? 0) > 0 && ` · ${preview.health.suggestions} suggestions`}
            </div>
          )}

          {preview.photoValidation && preview.photoValidation.found > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-background/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                <ImageIcon className="h-4 w-4 text-primary" />
                Photo Validation
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                {[["Found", preview.photoValidation.found], ["Accessible", preview.photoValidation.accessible], ["Private", preview.photoValidation.private], ["Broken", preview.photoValidation.broken], ["Not Image", preview.photoValidation.notImage], ["Unsupported", preview.photoValidation.unsupported], ["Quality", preview.photoValidation.qualityWarnings ?? 0]].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border border-border px-3 py-2">
                    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                    <div className={cn(
                      "text-lg font-bold",
                      label === "Accessible" && Number(value) > 0 ? "text-green-400"
                      : (label === "Private" || label === "Broken" || label === "Quality") && Number(value) > 0 ? "text-amber-300"
                      : "text-white",
                    )}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              {(preview.photoValidation.private + preview.photoValidation.broken) > 0 && (
                <p className="mt-3 text-xs text-amber-300">
                  Some photos may fail during import. Player data will still import successfully.
                </p>
              )}
              {(preview.photoQualityResults?.length ?? 0) > 0 && (
                <AdminScrollPanel className="mt-3 max-h-32 rounded-md border border-border">
                  {preview.photoQualityResults!.slice(0, 20).map((item) => (
                    <div key={item.url} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                      <div className="text-muted-foreground truncate">{item.url}</div>
                      <div className="text-amber-300 mt-0.5">
                        {item.qualityWarnings?.join(" · ")}
                        {item.width && item.height ? ` (${item.width}×${item.height})` : ""}
                      </div>
                    </div>
                  ))}
                </AdminScrollPanel>
              )}
            </div>
          )}

          {preview.photoValidation && preview.photoValidation.found > 0 && importMode !== "dry_run" && (
            <div className="mt-4 rounded-lg border border-border bg-background/50 p-4">
              <div className="text-sm font-medium text-white mb-3">Photo Import Mode</div>
              <RadioGroup
                value={photoImportMode}
                onValueChange={(v) => setPhotoImportMode(v as PhotoImportMode)}
                className="space-y-2"
              >
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="replace_empty_only" className="mt-0.5" />
                  <span>
                    <span className="text-white">Replace Empty Photos Only</span>
                    <span className="block text-xs text-muted-foreground">Default — only import photos for players without a photo.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="skip_existing" className="mt-0.5" />
                  <span>
                    <span className="text-white">Skip Existing Photos</span>
                    <span className="block text-xs text-muted-foreground">Only import photos for players without a photo.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="replace_all" className="mt-0.5" />
                  <span>
                    <span className="text-white">Replace Existing Photos</span>
                    <span className="block text-xs text-muted-foreground">Replace every player photo from the workbook.</span>
                  </span>
                </label>
              </RadioGroup>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {[["Total Rows", preview.summary.rowsTotal], ["Creates", preview.summary.creates], ["Updates", preview.summary.updates], ["Skips", preview.summary.skips], ["Errors", preview.summary.errors], ["Warnings", preview.summary.warnings]].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-background/50 p-3">
                <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                <div className="text-xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          {preview.summary.sheetsProcessed.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Sheets Processed</div>
              <div className="flex flex-wrap gap-1.5">{preview.summary.sheetsProcessed.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
            </div>
          )}

          {preview.diffs && preview.diffs.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Field Changes ({preview.diffs.length})</div>
              <AdminScrollPanel className="max-h-48 rounded-lg border border-border">
                {preview.diffs.slice(0, 50).map((diff, i) => (
                  <div key={i} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                    <span className="text-white">{diff.sheet} · Row {diff.row} · {diff.field}</span>
                    <div className="text-muted-foreground">
                      <span className="line-through">{diff.oldValue ?? "(empty)"}</span>
                      {" → "}
                      <span className="text-green-400">{diff.newValue ?? "(empty)"}</span>
                    </div>
                  </div>
                ))}
              </AdminScrollPanel>
            </div>
          )}

          {preview.issues.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-amber-300"><AlertTriangle className="h-4 w-4" /> Issues ({preview.issues.length})</div>
                <Button size="sm" variant="outline" onClick={() => downloadValidationReport(preview.issues)}>Download Validation Report</Button>
              </div>
              <AdminScrollPanel className="max-h-48 rounded-lg border border-border">
                {preview.issues.slice(0, 100).map((issue, i) => (
                  <div key={i} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                    <span className={issue.severity === "error" ? "text-red-400" : "text-amber-300"}>{issue.sheet} · Row {issue.row}</span>
                    <div className="text-muted-foreground">{issue.message}</div>
                  </div>
                ))}
              </AdminScrollPanel>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => { setView("main"); setPreview(null); }} disabled={busy}>
              Cancel
            </Button>
            {preview.valid && importMode !== "dry_run" && (
              <Button onClick={() => void handleConfirmImport()} disabled={busy} className="gap-2" aria-busy={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Applying import…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Confirm Import
                  </>
                )}
              </Button>
            )}
          </div>
          {busy && (
            <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
              Saving player updates and audit logs — large imports can take up to a minute. Please keep this tab open.
            </p>
          )}
        </Card>
      )}

      {view === "history" && (
        <Card className="border-border bg-card/70 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-semibold text-white">Import History</h3>
            <Button size="sm" variant="ghost" onClick={() => setView("main")}>Back</Button>
          </div>
          <AdminScrollPanel>
            {jobs.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No imports yet.</p> : jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                className="w-full border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted/30 transition-colors"
                onClick={() => void loadJobDetail(job.id).catch(() => setError("Could not load job detail"))}
              >
                <div className="text-white font-medium">{job.fileName || `Job #${job.id}`}</div>
                <div className="text-xs text-muted-foreground">{new Date(job.uploadedAt).toLocaleString()} · {job.importMode ?? job.sourceType} · {job.status}</div>
                <div className="text-xs text-muted-foreground">{job.updatedRows} updated · {job.totalRows} total</div>
              </button>
            ))}
          </AdminScrollPanel>
        </Card>
      )}

      {view === "job-detail" && selectedJob && (
        <Card className="border-border bg-card/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Import Job #{selectedJob.job.id}</h3>
              <p className="text-xs text-muted-foreground">{selectedJob.job.fileName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(selectedJob.job.uploadedAt).toLocaleString()} · {selectedJob.job.status}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedJob.photoProgress && selectedJob.photoProgress.failed > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => void retryFailedPhotos(selectedJob.job.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry Failed Photos
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setView("history")}>Back</Button>
            </div>
          </div>

          {selectedJob.photoProgress && selectedJob.photoProgress.total > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-background/50 p-4">
              <div className="text-sm font-medium text-white mb-2">Photo Import Status</div>
              {selectedJob.photoSummary?.complete && selectedJob.photoSummary && (
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                  <div><span className="text-muted-foreground">New Uploaded</span> <strong className="text-green-400 ml-1">{selectedJob.photoSummary.newPhotosUploaded}</strong></div>
                  <div><span className="text-muted-foreground">Reused</span> <strong className="text-white ml-1">{selectedJob.photoSummary.existingPhotosReused}</strong></div>
                  <div><span className="text-muted-foreground">Replaced</span> <strong className="text-white ml-1">{selectedJob.photoSummary.photosReplaced}</strong></div>
                  <div><span className="text-muted-foreground">Time</span> <strong className="text-white ml-1">{formatProcessingTime(selectedJob.photoSummary.processingTimeMs)}</strong></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
                <div><span className="text-muted-foreground">Total</span> <strong className="text-white ml-1">{selectedJob.photoProgress.total}</strong></div>
                <div><span className="text-muted-foreground">Uploaded</span> <strong className="text-green-400 ml-1">{selectedJob.photoProgress.uploaded}</strong></div>
                <div><span className="text-muted-foreground">Failed</span> <strong className="text-amber-300 ml-1">{selectedJob.photoProgress.failed}</strong></div>
                <div><span className="text-muted-foreground">Skipped</span> <strong className="text-white ml-1">{selectedJob.photoProgress.skipped}</strong></div>
                <div><span className="text-muted-foreground">Pending</span> <strong className="text-white ml-1">{selectedJob.photoProgress.pending + selectedJob.photoProgress.processing}</strong></div>
              </div>
            </div>
          )}

          {selectedJob.photoItems && selectedJob.photoItems.length > 0 && (
            <AdminScrollPanel className="mt-4 max-h-64 rounded-lg border border-border">
              {selectedJob.photoItems.map((item) => (
                <div key={item.id} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white">{item.playerName || `Player #${item.playerId ?? "?"}`}</span>
                    <Badge variant="outline" className={
                      item.status === "uploaded" ? "text-green-400 border-green-500/30"
                      : item.status === "failed" ? "text-amber-300 border-amber-500/30"
                      : item.status === "processing" ? "text-primary border-primary/30"
                      : "text-muted-foreground"
                    }>
                      {item.status}
                    </Badge>
                  </div>
                  {item.failureReason && (
                    <div className="text-muted-foreground mt-0.5">{item.failureReason}</div>
                  )}
                  {item.skipReason && (
                    <div className="text-muted-foreground mt-0.5">{item.skipReason}</div>
                  )}
                  {item.qualityWarnings && item.qualityWarnings.length > 0 && (
                    <div className="text-amber-300 mt-0.5">{item.qualityWarnings.join(" · ")}</div>
                  )}
                  {item.sourceUrl && (
                    <div className="text-muted-foreground mt-0.5 truncate" title={item.sourceUrl}>Source: {item.sourceUrl}</div>
                  )}
                </div>
              ))}
            </AdminScrollPanel>
          )}

          {(selectedJob.items as Array<{ fieldName: string; oldValue: string | null; newValue: string | null; playerId: number; status: string }>).length > 0 && (
            <>
              <div className="mt-4 text-xs uppercase text-muted-foreground">Field Changes</div>
              <AdminScrollPanel className="mt-2 max-h-48 rounded-lg border border-border">
                {(selectedJob.items as Array<{ fieldName: string; oldValue: string | null; newValue: string | null; playerId: number; status: string }>).map((item, i) => (
                  <div key={i} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                    <span className="text-white">Player #{item.playerId}</span>
                    <span className="text-muted-foreground"> · {item.fieldName}</span>
                    <div className="text-muted-foreground">
                      {item.oldValue ?? "(empty)"} → {item.newValue ?? "(empty)"}
                    </div>
                  </div>
                ))}
              </AdminScrollPanel>
            </>
          )}
        </Card>
      )}

      {view === "versions" && (
        <Card className="border-border bg-card/70 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-semibold text-white">Workbook Versions</h3>
            <Button size="sm" variant="ghost" onClick={() => setView("main")}>Back</Button>
          </div>
          <AdminScrollPanel>
            {versions.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No versions yet.</p> : versions.map((v) => (
              <div key={v.id} className="border-b border-border px-4 py-3 text-sm last:border-b-0">
                <div className="text-white font-medium">{v.versionLabel}</div>
                <div className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()} · {v.createdBy}</div>
              </div>
            ))}
          </AdminScrollPanel>
        </Card>
      )}
    </AdminShell>
  );
}
