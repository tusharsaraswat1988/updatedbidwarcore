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
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";

const API = "/api";

type ImportIssue = {
  row: number;
  column?: string;
  playerId?: number;
  severity: "error" | "warning";
  message: string;
};

type ImportSummary = {
  playersFound: number;
  rowsToUpdate: number;
  rowsSkipped: number;
  errors: number;
  warnings: number;
  changedFields: string[];
};

type ImportPreview = {
  valid: boolean;
  summary: ImportSummary;
  issues: ImportIssue[];
};

type ImportJob = {
  id: number;
  tournamentId: number;
  uploadedBy: string;
  uploadedAt: string;
  fileName: string | null;
  status: string;
  totalRows: number;
  updatedRows: number;
  failedRows: number;
  skippedRows: number;
  processingTimeMs: number | null;
  rolledBackAt: string | null;
};

type View = "main" | "preview" | "history" | "job-detail";

function getTournamentId(pathname: string): number | null {
  const match = pathname.match(/\/admin\/tournaments\/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function downloadExport(tournamentId: number) {
  const r = await fetch(`${API}/tournaments/${tournamentId}/auction-data/export`, {
    credentials: "include",
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Export failed");
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auction-data-t${tournamentId}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuctionDataManagerPage() {
  const [location] = useLocation();
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const tournamentId = getTournamentId(location);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>("main");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewJobId, setPreviewJobId] = useState<number | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<{ job: ImportJob; items: unknown[] } | null>(null);
  const [confirmResult, setConfirmResult] = useState<{ jobId: number; updatedRows: number } | null>(null);

  const loadHistory = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`${API}/tournaments/${tournamentId}/auction-data/import/history`, {
      credentials: "include",
    });
    if (!r.ok) throw new Error("Failed to load history");
    const data = await r.json();
    setJobs(data.jobs ?? []);
  }, [tournamentId]);

  useEffect(() => {
    if (view === "history" && tournamentId) {
      loadHistory().catch(() => setError("Could not load import history"));
    }
  }, [view, tournamentId, loadHistory]);

  if (isLoading || !isLoggedIn) return null;

  if (!isMaster) {
    return (
      <AdminShell title="Access Denied" eyebrow="Auction Data Manager">
        <Card className="border-destructive/40 bg-destructive/10 p-6">
          <p className="text-sm text-destructive">
            Auction Data Manager is restricted to Super Admin only. Organizers and Tournament Admins cannot access this module.
          </p>
          <Link href="/admin">
            <Button variant="outline" className="mt-4">Back to Admin</Button>
          </Link>
        </Card>
      </AdminShell>
    );
  }

  if (!tournamentId) {
    return (
      <AdminShell title="Auction Data Manager" eyebrow="Super Admin">
        <p className="text-muted-foreground">Invalid tournament.</p>
      </AdminShell>
    );
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      await downloadExport(tournamentId!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelect(file: File) {
    setBusy(true);
    setError(null);
    setConfirmResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/auction-data/import/preview`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Preview failed");
      setPreview(data.preview);
      setPreviewJobId(data.jobId);
      setPreviewFileName(data.fileName);
      setView("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmImport() {
    if (!previewJobId || !preview?.valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/auction-data/import/confirm`, {
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

  async function downloadErrorReport(issues: ImportIssue[]) {
    const r = await fetch(`${API}/tournaments/${tournamentId}/auction-data/import/error-report`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issues }),
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openJobDetail(jobId: number) {
    setBusy(true);
    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/auction-data/import/jobs/${jobId}`, {
        credentials: "include",
      });
      const data = await r.json();
      setSelectedJob(data);
      setView("job-detail");
    } catch {
      setError("Could not load job details");
    } finally {
      setBusy(false);
    }
  }

  async function rollbackJob(jobId: number) {
    if (!confirm("Undo entire import? This restores all previous field values.")) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/tournaments/${tournamentId}/auction-data/import/jobs/${jobId}/rollback`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Rollback failed");
      await loadHistory();
      if (selectedJob?.job.id === jobId) {
        setSelectedJob({
          ...selectedJob,
          job: { ...selectedJob.job, status: "rolled_back" },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Auction Data Manager"
      eyebrow={`Tournament #${tournamentId} · Super Admin Only`}
    >
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/admin/tournaments/${tournamentId}/players`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Players
          </Button>
        </Link>
      </div>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        This module manages <strong>tournament auction data only</strong>. Player registration profiles (name, mobile, email, DOB, gender, photo) are not modified here.
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {confirmResult && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Import committed — {confirmResult.updatedRows} field updates applied (Job #{confirmResult.jobId}).
        </div>
      )}

      {view === "main" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card/70 p-5">
            <FileSpreadsheet className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-white">Export Auction Data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Download Excel with locked IDs and editable auction fields. Future fields appear automatically.
            </p>
            <Button className="mt-4 w-full gap-2" onClick={handleExport} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Auction Data
            </Button>
          </Card>

          <Card className="border-border bg-card/70 p-5">
            <Upload className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-white">Import Auction Data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload Excel → validate → preview → confirm. Nothing commits until you confirm.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelect(f);
                e.target.value = "";
              }}
            />
            <Button
              className="mt-4 w-full gap-2"
              variant="secondary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import Auction Data
            </Button>
          </Card>

          <Card className="border-border bg-card/70 p-5">
            <History className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-white">Import History</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              View past imports, field changes, and rollback entire imports.
            </p>
            <Button className="mt-4 w-full gap-2" variant="outline" onClick={() => setView("history")}>
              <History className="h-4 w-4" />
              Import History
            </Button>
          </Card>
        </div>
      )}

      {view === "preview" && preview && (
        <Card className="border-border bg-card/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Import Preview</h3>
              <p className="text-xs text-muted-foreground mt-1">{previewFileName}</p>
            </div>
            <Badge className={preview.valid ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}>
              {preview.valid ? "Ready to import" : "Validation failed"}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Players Found", preview.summary.playersFound],
              ["Rows to Update", preview.summary.rowsToUpdate],
              ["Rows Skipped", preview.summary.rowsSkipped],
              ["Errors", preview.summary.errors],
              ["Warnings", preview.summary.warnings],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-background/50 p-3">
                <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                <div className="text-xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          {preview.summary.changedFields.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Changed Fields</div>
              <div className="flex flex-wrap gap-1.5">
                {preview.summary.changedFields.map((f) => (
                  <Badge key={f} variant="secondary">{f}</Badge>
                ))}
              </div>
            </div>
          )}

          {preview.issues.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Issues ({preview.issues.length})
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadErrorReport(preview.issues)}>
                  Download Error Report
                </Button>
              </div>
              <AdminScrollPanel className="max-h-48 rounded-lg border border-border">
                {preview.issues.slice(0, 100).map((issue, i) => (
                  <div key={i} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                    <span className={issue.severity === "error" ? "text-red-400" : "text-amber-300"}>
                      Row {issue.row}
                    </span>
                    {issue.column && <span className="text-muted-foreground"> · {issue.column}</span>}
                    {issue.playerId && <span className="text-muted-foreground"> · Player #{issue.playerId}</span>}
                    <div className="text-muted-foreground">{issue.message}</div>
                  </div>
                ))}
              </AdminScrollPanel>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setView("main"); setPreview(null); }}>
              Cancel
            </Button>
            {preview.valid && (
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
            {jobs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="grid grid-cols-[1fr_auto] gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0 hover:bg-accent/30 cursor-pointer"
                  onClick={() => openJobDetail(job.id)}
                >
                  <div>
                    <div className="text-white font-medium">{job.fileName || `Job #${job.id}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.uploadedAt).toLocaleString()} · {job.uploadedBy}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {job.updatedRows} updated · {job.failedRows} failed · {job.totalRows} total
                      {job.processingTimeMs != null && ` · ${job.processingTimeMs}ms`}
                    </div>
                  </div>
                  <Badge className={
                    job.status === "committed" ? "bg-green-500/15 text-green-400"
                    : job.status === "rolled_back" ? "bg-amber-500/15 text-amber-300"
                    : job.status === "failed" ? "bg-red-500/15 text-red-400"
                    : "bg-muted text-muted-foreground"
                  }>
                    {job.status}
                  </Badge>
                </div>
              ))
            )}
          </AdminScrollPanel>
        </Card>
      )}

      {view === "job-detail" && selectedJob && (
        <Card className="border-border bg-card/70 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-white">Import Job #{selectedJob.job.id}</h3>
              <p className="text-xs text-muted-foreground">{selectedJob.job.fileName}</p>
            </div>
            <div className="flex gap-2">
              {selectedJob.job.status === "committed" && (
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => rollbackJob(selectedJob.job.id)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Undo Entire Import
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setView("history")}>Back</Button>
            </div>
          </div>
          <AdminScrollPanel className="mt-4 max-h-96 rounded-lg border border-border">
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
        </Card>
      )}
    </AdminShell>
  );
}
