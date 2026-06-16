/**
 * Badminton Courts Management
 * Route: /tournament/:id/badminton/courts
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { EmptyState, FormField, inputClass, PageHeader, HubPageShell, BtnPrimary, DarkSelect, FormActions, FormError, FormModal, CheckboxRow } from "@/components/badminton/page-chrome";

interface BadmintonCourt {
  id: number;
  tournamentId: number;
  name: string;
  shortName?: string | null;
  location?: string | null;
  status: string;
  sortOrder: number;
  streamUrl?: string | null;
  hasDisplay: boolean;
}

export default function BadmintonCourtsPage() {
  const [, params] = useRoute("/tournament/:id/badminton/courts");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();
  const hubHref = `/tournament/${tournamentId}/badminton`;

  const [showForm, setShowForm] = useState(false);
  const [editCourt, setEditCourt] = useState<BadmintonCourt | null>(null);

  const { data: courts = [], isLoading } = useQuery<BadmintonCourt[]>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/courts`),
    enabled: !!tournamentId,
  });

  const deleteMutation = useMutation({
    mutationFn: (courtId: number) =>
      badmintonFetch(tournamentId, `/courts/${courtId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badminton-courts", tournamentId] }),
  });

  const sorted = [...courts].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return (
    <HubPageShell>
      <PageHeader
        title="Courts"
        subtitle={`${courts.length} court${courts.length !== 1 ? "s" : ""} configured`}
        backHref={hubHref}
        actions={
          <BtnPrimary onClick={() => { setEditCourt(null); setShowForm(true); }}>
            + Add Court
          </BtnPrimary>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-white/4 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="🏟"
            title="No courts yet"
            desc="Add courts so you can assign matches and stream URLs"
            action={{ label: "Add Court", onClick: () => setShowForm(true) }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                onEdit={() => { setEditCourt(court); setShowForm(true); }}
                onDelete={() => {
                  if (window.confirm(`Delete ${court.name}?`)) {
                    deleteMutation.mutate(court.id);
                  }
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
          onClose={() => { setShowForm(false); setEditCourt(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["badminton-courts", tournamentId] });
            qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
            setShowForm(false);
            setEditCourt(null);
          }}
        />
      )}
    </HubPageShell>
  );
}

function CourtCard({
  court,
  onEdit,
  onDelete,
}: {
  court: BadmintonCourt;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[#0d1529] border border-white/8 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white">{court.shortName || court.name}</span>
            <StatusBadge status={court.status} />
          </div>
          {court.shortName && court.shortName !== court.name && (
            <p className="text-white/50 text-sm mt-0.5">{court.name}</p>
          )}
        </div>
        {court.hasDisplay && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#4fc3f7]/15 text-[#4fc3f7] px-2 py-1 rounded-full">
            Display
          </span>
        )}
      </div>

      {court.location && (
        <p className="text-white/40 text-sm flex items-center gap-1.5">
          <span>📍</span> {court.location}
        </p>
      )}

      {court.streamUrl && (
        <p className="text-white/30 text-xs truncate" title={court.streamUrl}>
          Stream: {court.streamUrl}
        </p>
      )}

      <div className="flex gap-2 pt-1 mt-auto">
        <button
          onClick={onEdit}
          className="flex-1 h-9 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs font-semibold transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="h-9 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold transition-colors"
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
  onClose,
  onSaved,
}: {
  tournamentId: number;
  court: BadmintonCourt | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: court?.name ?? "",
    shortName: court?.shortName ?? "",
    location: court?.location ?? "",
    sortOrder: court?.sortOrder ?? 0,
    streamUrl: court?.streamUrl ?? "",
    hasDisplay: court?.hasDisplay ?? false,
    status: court?.status ?? "available",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const f = (key: keyof typeof form) => ({
    value: form[key] as string | number | boolean,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : e.target.type === "number"
          ? parseInt(e.target.value, 10) || 0
          : e.target.value;
      setForm((prev) => ({ ...prev, [key]: val }));
    },
  });

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Court name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        shortName: form.shortName.trim() || undefined,
        location: form.location.trim() || undefined,
        sortOrder: form.sortOrder,
        streamUrl: form.streamUrl.trim() || undefined,
        hasDisplay: form.hasDisplay,
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
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={court ? "Edit Court" : "Add Court"}
      subtitle="Configure court details for match assignment"
      onClose={onClose}
      size="md"
    >
      <FormField label="Court Name *">
        <input {...f("name")} placeholder="Court 1" className={inputClass} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Short Label">
          <input {...f("shortName")} placeholder="C1" maxLength={10} className={inputClass} />
        </FormField>
        <FormField label="Sort Order">
          <input {...f("sortOrder")} type="number" min={0} className={inputClass} />
        </FormField>
      </div>

      <FormField label="Location / Hall">
        <input {...f("location")} placeholder="Main Hall" className={inputClass} />
      </FormField>

      <FormField label="Stream URL (OBS)">
        <input {...f("streamUrl")} placeholder="https://…" className={inputClass} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Status">
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
        <FormField label="Options">
          <CheckboxRow
            checked={form.hasDisplay}
            onChange={(hasDisplay) => setForm((p) => ({ ...p, hasDisplay }))}
            label="Has display screen"
            description="Enable court-side LED display"
          />
        </FormField>
      </div>

      <FormError message={error} />

      <FormActions
        onCancel={onClose}
        onSubmit={handleSave}
        submitLabel={court ? "Save Changes" : "Add Court"}
        saving={saving}
      />
    </FormModal>
  );
}
