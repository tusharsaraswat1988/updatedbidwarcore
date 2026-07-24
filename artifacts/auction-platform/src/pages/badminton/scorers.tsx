/**
 * Manage Scorers — organizer adds mobile + personal PIN for Scorer Login.
 * Route: /tournament/:id/badminton/scorers
 *
 * Accounts are global (one mobile works across tournaments); only organizers can manage.
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";
import { sanitizeMobileInput } from "@workspace/api-base/mobile";
import { badmintonFetch } from "@/lib/badminton-api";
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  FormField,
  inputClass,
  HubPageShell,
  BtnPrimary,
  FormActions,
  FormError,
  FormModal,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import { BadmintonMovedBanner } from "@/components/badminton/ia-workflow-chrome";

type ScorerRow = {
  id: number;
  name: string;
  mobile: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Officials / scorers panel — reusable inside Participants (Phase 2). */
export function BadmintonScorersPanel({ tournamentId }: { tournamentId: number }) {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editScorer, setEditScorer] = useState<ScorerRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["badminton-scorers", tournamentId],
    queryFn: () =>
      badmintonFetch<{ scorers: ScorerRow[] }>(tournamentId, "/scorers"),
    enabled: tournamentId > 0,
  });

  const scorers = data?.scorers ?? [];

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["badminton-scorers", tournamentId] });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground font-display font-bold text-lg">Officials & Scorers</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            People who will score matches. They sign in with mobile + personal PIN.
          </p>
        </div>
        <BtnPrimary
          onClick={() => {
            setEditScorer(null);
            setShowForm(true);
          }}
        >
          + Add Scorer
        </BtnPrimary>
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : scorers.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No scorers yet"
          desc="Add a scorer with name, mobile, and personal PIN so they can open Scorer Home on match day."
          action={{ label: "Add Scorer", onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {scorers.map((scorer) => (
            <ScorerCard
              key={scorer.id}
              scorer={scorer}
              tournamentId={tournamentId}
              onEdit={() => {
                setEditScorer(scorer);
                setShowForm(true);
              }}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {showForm ? (
        <ScorerFormModal
          tournamentId={tournamentId}
          scorer={editScorer}
          onClose={() => {
            setShowForm(false);
            setEditScorer(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditScorer(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Legacy route — scorers also live under Participants. */
export default function BadmintonScorersPage() {
  const [, params] = useRoute("/tournament/:id/badminton/scorers");
  const tournamentId = parseInt(params?.id || "0");

  return (
    <HubPageShell tournamentId={tournamentId}>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <BadmintonMovedBanner
          toHref={`/tournament/${tournamentId}/badminton/players?section=officials`}
          toLabel="Participants"
          message="Scorers and officials belong in Participants → Officials."
        />
        <BadmintonScorersPanel tournamentId={tournamentId} />
      </div>
    </HubPageShell>
  );
}

function ScorerCard({
  scorer,
  tournamentId,
  onEdit,
  onChanged,
}: {
  scorer: ScorerRow;
  tournamentId: number;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const toggle = useMutation({
    mutationFn: async () => {
      await badmintonFetch(tournamentId, `/scorers/${scorer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !scorer.isActive }),
      });
    },
    onSuccess: () => {
      toastSuccess(scorer.isActive ? "Scorer deactivated" : "Scorer activated");
      onChanged();
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className={cn(hubCardClass, "p-4 flex flex-wrap items-center justify-between gap-3")}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-foreground truncate">{scorer.name}</p>
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
              scorer.isActive
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/10 text-white/45",
            )}
          >
            {scorer.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-mono mt-0.5">{scorer.mobile}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Last login · {formatWhen(scorer.lastLoginAt)}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="min-h-10 px-3 rounded-lg bg-secondary hover:bg-accent text-xs font-semibold border border-border"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
          className={cn(
            "min-h-10 px-3 rounded-lg text-xs font-semibold border",
            scorer.isActive
              ? "bg-destructive/10 text-destructive border-destructive/25"
              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
          )}
        >
          {scorer.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}

function ScorerFormModal({
  tournamentId,
  scorer,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  scorer: ScorerRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(scorer);
  const [name, setName] = useState(scorer?.name ?? "");
  const [mobile, setMobile] = useState(scorer?.mobile ?? "");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!isEdit && !mobile.trim()) {
      setError("Mobile number is required");
      return;
    }
    if (!isEdit && pin.trim().length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }
    if (isEdit && pin.trim().length > 0 && pin.trim().length < 4) {
      setError("New PIN must be at least 4 characters");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (isEdit && scorer) {
        const body: Record<string, unknown> = { name: name.trim() };
        if (pin.trim().length >= 4) body.pin = pin.trim();
        await badmintonFetch(tournamentId, `/scorers/${scorer.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toastSuccess("Scorer updated");
      } else {
        await badmintonFetch(tournamentId, "/scorers", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            mobile: mobile.trim(),
            pin: pin.trim(),
          }),
        });
        toastSuccess("Scorer added");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={isEdit ? "Edit Scorer" : "Add Scorer"}
      subtitle="Used on Scorer Login — mobile + personal PIN"
      onClose={onClose}
      size="md"
    >
      <FormField label="Name *">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Scorer name"
          className={inputClass}
          autoFocus
        />
      </FormField>

      {!isEdit ? (
        <FormField label="Mobile number *">
          <input
            value={mobile}
            onChange={(e) => setMobile(sanitizeMobileInput(e.target.value))}
            placeholder="10-digit mobile"
            type="tel"
            inputMode="numeric"
            className={inputClass}
          />
        </FormField>
      ) : (
        <FormField label="Mobile number">
          <input value={scorer?.mobile ?? ""} disabled className={cn(inputClass, "opacity-60")} />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Mobile cannot be changed after create.
          </p>
        </FormField>
      )}

      <FormField label={isEdit ? "New personal PIN (optional)" : "Personal PIN *"}>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={isEdit ? "Leave blank to keep current PIN" : "Min 4 characters"}
          type="password"
          autoComplete="new-password"
          className={inputClass}
        />
      </FormField>

      {error ? <FormError message={error} /> : null}

      <FormActions
        onCancel={onClose}
        onSubmit={() => void handleSave()}
        saving={saving}
        submitLabel={isEdit ? "Save" : "Add Scorer"}
      />
    </FormModal>
  );
}
