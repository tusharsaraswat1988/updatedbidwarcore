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
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { ChevronDown, MapPin } from "lucide-react";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import {
  EmptyState,
  FormField,
  inputClass,
  PageHeader,
  HubPageShell,
  BtnPrimary,
  DarkSelect,
  FormActions,
  FormError,
  FormModal,
  hubCardClass,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
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

export default function BadmintonCourtsPage() {
  const [, params] = useRoute("/tournament/:id/badminton/courts");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editCourt, setEditCourt] = useState<BadmintonCourt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BadmintonCourt | null>(null);
  const [deleteError, setDeleteError] = useState("");

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
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Courts"
        subtitle="Courts used for Scheduling and Control Center — add them before match day"
        actions={
          <BtnPrimary onClick={() => { setEditCourt(null); setShowForm(true); }}>
            + Add Court
          </BtnPrimary>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
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
                : "Add courts like Court 1, Court 2. Tip: set the tournament venue in Branding first."
            }
            action={
              tournamentVenue
                ? { label: "Add Court", onClick: () => setShowForm(true) }
                : {
                    label: "Open Branding",
                    href: `/tournament/${tournamentId}/badminton/branding`,
                  }
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                tournamentVenue={tournamentVenue}
                onEdit={() => { setEditCourt(court); setShowForm(true); }}
                onDelete={() => {
                  setDeleteError("");
                  setDeleteTarget(court);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <CourtFormModal
          tournamentId={tournamentId}
          court={editCourt}
          tournamentVenue={tournamentVenue}
          nextSortOrder={nextCourtSortOrder(courts)}
          onClose={() => { setShowForm(false); setEditCourt(null); }}
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
            <p>Fixtures scheduled on this court will need a new court assigned in Scheduling.</p>
          </div>
        }
        confirmLabel="Delete court"
        busy={deleteMutation.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </HubPageShell>
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
    <div className={cn(hubCardClass, "p-5 flex flex-col gap-3")}>
      <div className="min-w-0 space-y-1">
        {tournamentVenue ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
            <span className="truncate">{tournamentVenue}</span>
          </p>
        ) : null}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-display font-bold text-foreground">
            {court.name}
          </span>
          <StatusBadge status={court.status} />
        </div>
        {court.shortName && court.shortName !== court.name ? (
          <p className="text-muted-foreground text-sm">Label: {court.shortName}</p>
        ) : null}
      </div>

      <div className="flex gap-2 pt-1 mt-auto">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 min-h-11 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors border border-border"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-11 px-4 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-colors border border-destructive/25"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    available: "bg-green-500/15 text-green-400",
    in_use: "bg-red-500/15 text-red-400",
    maintenance: "bg-amber-500/15 text-amber-400",
  };
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", styles[status] ?? "bg-white/10 text-white/50")}>
      {status.replace("_", " ")}
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
      // Court = physical playing area only. Venue comes from Branding (read-only).
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
          ? () => setLocation(`/tournament/${tournamentId}/badminton/categories`)
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
              set venue in Branding
            </Link>
          </p>
        )}
      </div>

      <FormField label="Court Name *">
        <input
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
                { value: "in_use", label: "In Use" },
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
