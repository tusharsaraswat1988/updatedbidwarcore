/**
 * Badminton Courts Management
 * Route: /tournament/:id/badminton/courts
 *
 * Venue vs Court:
 * - Venue = tournament location (from Branding today; future Venue entity can replace).
 * - Court = physical playing court inside that venue.
 */

import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { formatCourtEntityStatusLabel, toastError, toastSuccess } from "@/lib/badminton-ux";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { ChevronDown, MapPin } from "lucide-react";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import {
  EmptyState,
  FormField,
  inputClass,
  HubPageShell,
  BtnPrimary,
  DarkSelect,
  FormActions,
  FormError,
  FormModal,
  hubCardClass,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import { BadmintonMovedBanner } from "@/components/badminton/ia-workflow-chrome";
import { BadmintonSetupWizardChrome } from "@/components/badminton/setup-wizard-chrome";
import { BadmintonSetupTabs } from "@/components/badminton/badminton-subnav-tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface BadmintonCourt {
  id: number;
  tournamentId: number;
  name: string;
  shortName?: string | null;
  location?: string | null;
  status: string;
  sortOrder: number;
  scorerPin?: string | null;
  scorerName?: string | null;
  hasScorerPin?: boolean;
}

/**
 * Resolve the tournament venue for court UX.
 * Today: Branding.venue. Tomorrow: swap for a Venue entity without changing call sites.
 */
function resolveTournamentVenue(input: {
  brandingVenue?: string | null;
}): string | null {
  const venue = input.brandingVenue?.trim();
  return venue || null;
}

/** Short label for scoreboards — e.g. "Court 1" → "C1". */
function suggestCourtShortLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const courtNum = trimmed.match(/^(?:court|c)\s*[-#.]?\s*(\d+)$/i);
  if (courtNum) return `C${courtNum[1]}`;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 6);
  }
  return trimmed.slice(0, 6);
}

function nextCourtSortOrder(courts: BadmintonCourt[]): number {
  if (courts.length === 0) return 1;
  return Math.max(...courts.map((c) => c.sortOrder)) + 1;
}

/** Court list + CRUD — reusable inside Tournament Setup (Phase 2). */
export function BadmintonCourtsPanel({ tournamentId }: { tournamentId: number }) {
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editCourt, setEditCourt] = useState<BadmintonCourt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BadmintonCourt | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const openAdd = () => {
    setEditCourt(null);
    setShowForm(true);
  };

  const { data: branding } = useBadmintonBranding(tournamentId);
  const tournamentVenue = resolveTournamentVenue({ brandingVenue: branding?.venue });

  const { data: courts = [], isLoading } = useQuery<BadmintonCourt[]>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/courts`),
    enabled: !!tournamentId,
  });

  const deleteMutation = useMutation({
    mutationFn: (courtId: number) =>
      badmintonFetch(tournamentId, `/courts/${courtId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badminton-courts", tournamentId] });
      toastSuccess("Court deleted");
      setDeleteTarget(null);
      setDeleteError("");
    },
    onError: (e) => {
      setDeleteError(e instanceof Error ? e.message : "Could not delete court");
      toastError(e, "Could not delete court");
    },
  });

  const sorted = [...courts].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Allocated Courts</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold">
              {courts.length}
            </span>
          </div>
          {tournamentVenue ? (
            <span className="text-xs text-muted-foreground hidden sm:inline flex items-center gap-1">
              • at <span className="text-foreground font-medium">{tournamentVenue}</span>
            </span>
          ) : null}
        </div>
        <BtnPrimary onClick={openAdd}>+ Add Court</BtnPrimary>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No courts yet"
          desc={
            tournamentVenue
              ? `Add courts at ${tournamentVenue} — e.g. Court 1, Court 2`
              : "Add courts like Court 1, Court 2. Tip: set the tournament venue under Identity first."
          }
          action={{ label: "Add Court", onClick: openAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              tournamentVenue={tournamentVenue}
              onEdit={() => {
                setEditCourt(court);
                setShowForm(true);
              }}
              onDelete={() => {
                setDeleteError("");
                setDeleteTarget(court);
              }}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CourtFormModal
          tournamentId={tournamentId}
          court={editCourt}
          tournamentVenue={tournamentVenue}
          nextSortOrder={nextCourtSortOrder(courts)}
          onClose={() => {
            setShowForm(false);
            setEditCourt(null);
          }}
          onSaved={(opts) => {
            qc.invalidateQueries({ queryKey: ["badminton-courts", tournamentId] });
            qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
            toastSuccess(editCourt ? "Court updated" : "Court created");
            setShowForm(false);
            setEditCourt(null);
            opts?.continueToNext?.();
          }}
        />
      )}

      <ConfirmActionDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete court?"
        description={
          <div className="space-y-2">
            <p>
              Delete <span className="text-foreground font-medium">{deleteTarget?.name}</span>?
            </p>
            <p>Matches scheduled on this court will need a new court in Schedule.</p>
          </div>
        }
        confirmLabel="Delete court"
        busy={deleteMutation.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </>
  );
}

/** Legacy route — redirects mental model to Tournament Setup while keeping URL. */
export default function BadmintonCourtsPage() {
  const [, params] = useRoute("/tournament/:id/badminton/courts");
  const tournamentId = parseInt(params?.id ?? "0");

  const { data: courts = [] } = useQuery<BadmintonCourt[]>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/courts`),
    enabled: !!tournamentId,
  });

  return (
    <HubPageShell tournamentId={tournamentId}>
      <BadmintonSetupWizardChrome
        tournamentId={tournamentId}
        stepId="courts"
        tabs={<BadmintonSetupTabs tournamentId={tournamentId} activeSection="courts" courtsCount={courts.length} />}
        continueHref={`/tournament/${tournamentId}/badminton/branding?section=rules`}
        continueLabel="Continue to Rules"
      >
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <BadmintonMovedBanner
            toHref={`/tournament/${tournamentId}/badminton/branding?section=courts`}
            toLabel="Tournament Setup"
            message="Court creation belongs in Tournament Setup → Courts."
          />
          <BadmintonCourtsPanel tournamentId={tournamentId} />
        </div>
      </BadmintonSetupWizardChrome>
    </HubPageShell>
  );
}

function BadmintonCourtIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-5 h-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="2" width="18" height="20" rx="1.5" />
      <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" />
      <line x1="5" y1="2" x2="5" y2="22" strokeDasharray="1 1" />
      <line x1="19" y1="2" x2="19" y2="22" strokeDasharray="1 1" />
      <line x1="3" y1="5" x2="21" y2="5" />
      <line x1="3" y1="19" x2="21" y2="19" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function CourtCard({
  court,
  tournamentVenue,
  onEdit,
  onDelete,
}: {
  court: BadmintonCourt;
  tournamentVenue: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(hubCardClass, "p-5 flex flex-col justify-between group hover:border-primary/40 transition-all duration-200")}>
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <BadmintonCourtIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-display font-bold text-foreground">
                  {court.name}
                </span>
                {court.shortName && court.shortName !== court.name ? (
                  <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border">
                    {court.shortName}
                  </span>
                ) : null}
              </div>
              {tournamentVenue ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-primary/70 shrink-0" aria-hidden />
                  <span className="truncate">{tournamentVenue}</span>
                </p>
              ) : null}
            </div>
          </div>
          <StatusBadge status={court.status} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-lg bg-card/40 border border-border/50 my-2">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Sequence</span>
            <span className="font-semibold text-foreground">Court #{court.sortOrder}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Court Code</span>
            <span className="font-mono font-semibold text-foreground">{court.shortName || suggestCourtShortLabel(court.name) || "—"}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 mt-auto">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 min-h-9 px-3 rounded-lg bg-secondary hover:bg-accent text-foreground text-xs font-semibold transition-colors border border-border"
        >
          Edit Court
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-9 px-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-colors border border-destructive/25"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isAvailable = status === "available";
  const isInUse = status === "in_use";
  const isMaintenance = status === "maintenance";

  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 border",
        isAvailable
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
          : isInUse
            ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
            : isMaintenance
              ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
              : "bg-muted text-muted-foreground border-border",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isAvailable
            ? "bg-emerald-400 animate-pulse"
            : isInUse
              ? "bg-rose-400 animate-pulse"
              : isMaintenance
                ? "bg-amber-400"
                : "bg-muted-foreground",
        )}
      />
      {formatCourtEntityStatusLabel(status)}
    </span>
  );
}

function CourtFormModal({
  tournamentId,
  court,
  tournamentVenue,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  court: BadmintonCourt | null;
  tournamentVenue: string | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (opts?: { continueToNext?: () => void }) => void;
}) {
  const [, setLocation] = useLocation();
  const isEdit = Boolean(court);

  const [form, setForm] = useState({
    name: court?.name ?? "",
    shortName: court?.shortName ?? "",
    sortOrder: court?.sortOrder ?? nextSortOrder,
    status: court?.status ?? "available",
  });
  const [shortNameTouched, setShortNameTouched] = useState(Boolean(court?.shortName));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setName(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      shortName: shortNameTouched ? prev.shortName : suggestCourtShortLabel(name),
    }));
  }

  async function handleSave(andContinue: boolean) {
    if (!form.name.trim()) {
      setError("Court name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const shortName =
        form.shortName.trim() || suggestCourtShortLabel(form.name) || undefined;
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        shortName,
        sortOrder: form.sortOrder,
      };
      if (court) {
        body.status = form.status;
        await badmintonFetch(tournamentId, `/courts/${court.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await badmintonFetch(tournamentId, `/courts`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onSaved({
        continueToNext: andContinue
          ? () => setLocation(`/tournament/${tournamentId}/badminton/players`)
          : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={isEdit ? "Edit Court" : "Add Court"}
      subtitle="A court is a playing area inside the tournament venue"
      onClose={onClose}
      size="md"
    >
      <div className={cn(hubPanelClass, "space-y-1 !p-3")}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Tournament Venue
        </p>
        {tournamentVenue ? (
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
            {tournamentVenue}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not set yet —{" "}
            <Link
              href={`/tournament/${tournamentId}/badminton/branding`}
              className="text-primary hover:underline font-medium"
            >
            set venue in Tournament Setup
              </Link>
          </p>
        )}
      </div>

      <FormField label="Court Name" required>
        <input
          required
          aria-required="true"
          value={form.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Court 1"
          className={inputClass}
          autoFocus
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Examples: Court 1, Court 2, Court A, Center Court
        </p>
      </FormField>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-border/60",
            "bg-muted/20 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground",
            "hover:text-foreground hover:border-border transition-colors",
          )}
        >
          <span>Advanced settings</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 shrink-0 transition-transform",
              advancedOpen && "rotate-180",
            )}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Short Label">
              <input
                value={form.shortName}
                onChange={(e) => {
                  setShortNameTouched(true);
                  setForm((p) => ({ ...p, shortName: e.target.value }));
                }}
                placeholder="C1"
                maxLength={10}
                className={inputClass}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Shown on scoreboards. Filled in automatically from the court name.
              </p>
            </FormField>
            <FormField label="Sort Order">
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sortOrder: parseInt(e.target.value, 10) || 0,
                  }))
                }
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField label="Court Status">
            <DarkSelect
              value={form.status}
              onValueChange={(status) => setForm((p) => ({ ...p, status }))}
              options={[
                { value: "available", label: "Available" },
                { value: "in_use", label: "Live" },
                { value: "maintenance", label: "Maintenance" },
              ]}
            />
          </FormField>
        </CollapsibleContent>
      </Collapsible>

      <FormError message={error} />

      {isEdit ? (
        <FormActions
          onCancel={onClose}
          onSubmit={() => handleSave(false)}
          submitLabel="Save Court"
          saving={saving}
        />
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          <FormActions
            onCancel={onClose}
            onSubmit={() => handleSave(true)}
            submitLabel="Save & Continue"
            saving={saving}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Save Court only
          </button>
        </div>
      )}
    </FormModal>
  );
}
