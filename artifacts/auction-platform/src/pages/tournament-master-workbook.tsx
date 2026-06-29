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
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";

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
};

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

function getTournamentId(pathname: string): number | null {
  const match = pathname.match(/\/admin\/tournaments\/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function downloadExport(tournamentId: number) {
  const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/export`, { credentials: "include" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Export failed");
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BidWar-BMW-t${tournamentId}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TournamentMasterWorkbookPage() {
  const [location] = useLocation();
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const tournamentId = getTournamentId(location);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>("main");
  const [importMode, setImportMode] = useState<ImportMode>("merge_data");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [previewJobId, setPreviewJobId] = useState<number | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewSourceType, setPreviewSourceType] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [versions, setVersions] = useState<WorkbookVersion[]>([]);
  const [selectedJob, setSelectedJob] = useState<{ job: ImportJob; items: unknown[] } | null>(null);
  const [confirmResult, setConfirmResult] = useState<{ jobId: number; updatedRows: number; versionId?: number } | null>(null);

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
      setPreview(data.preview);
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
    if (!previewJobId || !preview?.valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/workbook/import/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: previewJobId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Import failed");
      setConfirmResult(data);
      setPreview(null);
      setView("main");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import commit failed");
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
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Workbook imported — {confirmResult.updatedRows} changes (Job #{confirmResult.jobId}
          {confirmResult.versionId ? `, Version #${confirmResult.versionId}` : ""}).
        </div>
      )}

      {view === "main" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card/70 p-5">
              <FileSpreadsheet className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-white">Export Workbook</h3>
              <p className="mt-1 text-xs text-muted-foreground">All 9 sheets + instructions + reference dropdowns. Admin-friendly format.</p>
              <Button className="mt-4 w-full gap-2" onClick={() => downloadExport(tournamentId!).catch((e) => setError(String(e)))} disabled={busy}>
                <Download className="h-4 w-4" />
                Export .xlsx
              </Button>
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

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setView("main"); setPreview(null); }}>Cancel</Button>
            {preview.valid && importMode !== "dry_run" && (
              <Button onClick={handleConfirmImport} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm Import
              </Button>
            )}
          </div>
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
              <div key={job.id} className="border-b border-border px-4 py-3 text-sm last:border-b-0">
                <div className="text-white font-medium">{job.fileName || `Job #${job.id}`}</div>
                <div className="text-xs text-muted-foreground">{new Date(job.uploadedAt).toLocaleString()} · {job.importMode ?? job.sourceType} · {job.status}</div>
                <div className="text-xs text-muted-foreground">{job.updatedRows} updated · {job.totalRows} total</div>
              </div>
            ))}
          </AdminScrollPanel>
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
