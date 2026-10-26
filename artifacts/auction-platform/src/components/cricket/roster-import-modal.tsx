import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Users,
} from "lucide-react";
import type { Player, Team } from "@workspace/api-client-react";
import {
  exportRosterTemplateToExcel,
  parseRosterExcelFile,
  type ParsedRosterResult,
  type ParsedRosterPlayer,
} from "@/lib/roster-excel-service";
import { toast } from "@/hooks/use-toast";

interface RosterImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: number;
  tournamentName?: string;
  teams: Team[];
  players: Player[];
  onImportComplete?: () => void;
}

export function RosterImportModal({
  open,
  onOpenChange,
  tournamentId,
  tournamentName = "Tournament",
  teams,
  players,
  onImportComplete,
}: RosterImportModalProps) {
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedRosterResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setParseResult(null);
    setSelectedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (mode: "blank" | "prefill") => {
    setDownloadingTemplate(true);
    try {
      await exportRosterTemplateToExcel({
        tournamentName,
        teams,
        existingPlayers: players,
        mode,
      });
      toast({
        title: "Template downloaded",
        description:
          mode === "prefill"
            ? "Current tournament roster downloaded with IDs for editing."
            : "Blank cricket roster template downloaded with instructions.",
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Could not generate Excel template",
        variant: "destructive",
      });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setParsing(true);
    try {
      const result = await parseRosterExcelFile(file, teams, players);
      setParseResult(result);
      if (result.validRows.length === 0 && result.errors.length > 0) {
        toast({
          title: "File parsing error",
          description: "No valid player rows found in the uploaded file.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setParseResult(null);
      toast({
        title: "Could not parse file",
        description: err instanceof Error ? err.message : "Unknown Excel parse error",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleCommitSync = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;

    setSyncing(true);
    try {
      const payload = {
        players: parseResult.validRows.map((r) => ({
          id: r.id,
          teamId: r.teamId,
          name: r.name,
          role: r.role,
          battingStyle: r.battingStyle,
          bowlingStyle: r.bowlingStyle,
          jerseyNumber: r.jerseyNumber,
          jerseySize: r.jerseySize,
          dob: r.dob,
          mobileNumber: r.mobileNumber,
          city: r.city,
          photoUrl: r.photoUrl,
        })),
      };

      const res = await fetch(`/api/tournaments/${tournamentId}/scoring/bulk-roster-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Roster bulk import failed on server");
      }

      const resJson = await res.json();
      toast({
        title: "Roster sync successful",
        description:
          resJson.message ||
          `Synced ${parseResult.validRows.length} players (${parseResult.newCount} added, ${parseResult.updateCount} updated).`,
      });

      resetState();
      onOpenChange(false);
      onImportComplete?.();
    } catch (err) {
      toast({
        title: "Import sync failed",
        description: err instanceof Error ? err.message : "Could not sync roster to database",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 bg-slate-950 border-slate-800 text-slate-100">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <DialogTitle className="text-xl font-bold tracking-tight">
              Import Cricket Roster from Excel
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-sm">
            Download the pre-formatted template, update or add players with batting/bowling styles and jersey numbers, and upload back to sync the scoring roster.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
          {/* Step 1: Download Templates */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Step 1: Download Excel Template</h4>
                <p className="text-xs text-slate-400">
                  Pre-formatted with exact team codes, column headers, and cricket style requirements.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer"
                disabled={downloadingTemplate}
                onClick={() => handleDownload("blank")}
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Download Blank Template</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer"
                disabled={downloadingTemplate || players.length === 0}
                onClick={() => handleDownload("prefill")}
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>Download Current Roster (For Batch Edit)</span>
                {players.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] bg-slate-700 text-slate-300">
                    {players.length} Players
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Step 2: Upload File */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            <h4 className="text-sm font-semibold text-slate-200">Step 2: Upload Completed Sheet</h4>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-900/40"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-medium text-slate-200">
                {selectedFileName ? selectedFileName : "Click or drag your filled .xlsx or .csv file here"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports Excel Workbook (.xlsx, .xls) and CSV</p>
            </div>
          </div>

          {/* Step 3: Parse Results & Dry-Run Preview */}
          {parsing && (
            <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Validating and matching roster rows...</span>
            </div>
          )}

          {parseResult && !parsing && (
            <div className="space-y-4">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400">Total Valid Rows</div>
                  <div className="text-xl font-bold text-slate-100">{parseResult.validRows.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-center">
                  <div className="text-xs text-emerald-400">New Players to Add</div>
                  <div className="text-xl font-bold text-emerald-300">+{parseResult.newCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-800/40 text-center">
                  <div className="text-xs text-sky-400">Existing to Update</div>
                  <div className="text-xl font-bold text-sky-300">{parseResult.updateCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-center">
                  <div className="text-xs text-rose-400">Errors / Skipped</div>
                  <div className="text-xl font-bold text-rose-300">{parseResult.errors.length}</div>
                </div>
              </div>

              {/* Errors & Warnings Alert */}
              {parseResult.errors.length > 0 && (
                <Alert variant="destructive" className="bg-rose-950/40 border-rose-900 text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <AlertTitle className="font-semibold">
                    {parseResult.errors.length} Row(s) with Errors (will be skipped):
                  </AlertTitle>
                  <AlertDescription className="text-xs mt-1 space-y-1 max-h-32 overflow-y-auto">
                    {parseResult.errors.map((err, i) => (
                      <div key={i}>
                        • Row {err.row} ({err.player}): {err.message}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {parseResult.warnings.length > 0 && (
                <Alert className="bg-amber-950/30 border-amber-800/50 text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <AlertTitle className="font-semibold text-xs">
                    {parseResult.warnings.length} Notice(s):
                  </AlertTitle>
                  <AlertDescription className="text-xs mt-1 space-y-1 max-h-24 overflow-y-auto text-amber-300/80">
                    {parseResult.warnings.map((w, i) => (
                      <div key={i}>
                        • Row {w.row} ({w.player}): {w.message}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table */}
              {parseResult.validRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Roster Preview ({parseResult.validRows.length} Players)
                  </div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 uppercase font-medium sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Action</th>
                          <th className="px-3 py-2">Player Name</th>
                          <th className="px-3 py-2">Team</th>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Batting</th>
                          <th className="px-3 py-2">Bowling</th>
                          <th className="px-3 py-2">Jersey #</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                        {parseResult.validRows.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="px-3 py-1.5">
                              {p.action === "new" ? (
                                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                  NEW
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-sky-500/20 text-sky-300 border-sky-500/30">
                                  UPDATE #{p.id}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-slate-100">{p.name}</td>
                            <td className="px-3 py-1.5 text-slate-300">{p.teamName}</td>
                            <td className="px-3 py-1.5">{p.role}</td>
                            <td className="px-3 py-1.5">{p.battingStyle}</td>
                            <td className="px-3 py-1.5">{p.bowlingStyle}</td>
                            <td className="px-3 py-1.5 font-mono">{p.jerseyNumber ? `#${p.jerseyNumber}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-800 pt-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetState();
              onOpenChange(false);
            }}
            disabled={syncing}
          >
            Cancel
          </Button>

          <Button
            type="button"
            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            disabled={syncing || !parseResult || parseResult.validRows.length === 0}
            onClick={handleCommitSync}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>
              {syncing
                ? "Syncing Roster..."
                : `Confirm & Sync Roster (${parseResult?.validRows.length ?? 0} Players)`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
