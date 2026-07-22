/**
 * Pre-match Match Control panel.
 * Control Center → Match Control → Live Scoring
 */

import { useState } from "react";
import { Link } from "wouter";
import { isPairMatchKind } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";
import {
  BtnPrimary,
  DarkSelect,
  FormActions,
  FormError,
  FormField,
  FormModal,
  hubCardClass,
  inputClass,
} from "@/components/badminton/page-chrome";
import { CourtAutocomplete } from "@/components/badminton/court-autocomplete";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import {
  DoublesPreMatchSetup,
  SinglesPreMatchSetup,
} from "@/components/badminton/doubles-pre-match-setup";
import { badmintonScorerMatchPath } from "@/lib/badminton-routes";
import {
  buildMatchControlWarnings,
  buildStartPayloadFromPreMatchToss,
  hasBlockingMatchControlWarnings,
  type MatchControlPeerMatch,
  type MatchControlSnapshot,
} from "@/lib/badminton-match-control";
import {
  isPreMatchTossComplete,
  parsePreMatchToss,
} from "@/lib/badminton-pre-match-toss";
import { useBadmintonDirector, useBadmintonScorer } from "@/hooks/use-badminton-match";
import { badmintonFetch } from "@/lib/badminton-api";
import { friendlyBadmintonError, toastSuccess } from "@/lib/badminton-ux";

function formatWhen(iso: string | null): string {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not scheduled";
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeInput(iso: string | null): string {
  if (!iso) return "09:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "09:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PreMatchControlPanel({
  snapshot,
  peerMatches = [],
  onRefresh,
  scorerPin,
}: {
  snapshot: MatchControlSnapshot;
  peerMatches?: MatchControlPeerMatch[];
  onRefresh: () => void;
  /** Match/court PIN shown to organizers so they can share with the scorer. */
  scorerPin?: string | null;
}) {
  const scorer = useBadmintonScorer(snapshot.tournamentId, snapshot.matchId);
  const director = useBadmintonDirector(snapshot.tournamentId, snapshot.matchId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTossSetup, setShowTossSetup] = useState(false);
  const [showWalkover, setShowWalkover] = useState(false);
  const [showRetire, setShowRetire] = useState(false);
  const [showDelay, setShowDelay] = useState(false);

  const warnings = buildMatchControlWarnings(snapshot, peerMatches);
  const blocking = hasBlockingMatchControlWarnings(warnings);
  const softWarnings = warnings.filter((w) => w.soft);
  const hardWarnings = warnings.filter((w) => !w.soft);
  const canStart = !blocking;
  const needsCourtOrTime = hardWarnings.some((w) => w.id === "court" || w.id === "scheduled");
  const pinHint = typeof scorerPin === "string" && scorerPin.trim().length >= 4 ? scorerPin.trim() : null;
  const isPair = isPairMatchKind(snapshot.matchType);
  const savedToss = parsePreMatchToss(snapshot.preMatchTossJson);
  const hasSavedToss = isPreMatchTossComplete(snapshot.matchType, savedToss);

  const startDetail = {
    matchType: snapshot.matchType,
    matchFormatJson: snapshot.matchFormat,
    leftSideJson: snapshot.leftSideJson,
    rightSideJson: snapshot.rightSideJson,
  };

  async function handleTossStart(payload: unknown) {
    setBusy(true);
    setError("");
    try {
      await scorer.startMatch(payload);
      toastSuccess("Match started", "Director controls are ready on this page.");
      onRefresh();
    } catch (e) {
      const msg = friendlyBadmintonError(e, "Could not start the match");
      setError(msg);
      setBusy(false);
      throw new Error(msg);
    }
  }

  async function handleStartWithSavedToss() {
    if (!savedToss || !hasSavedToss) return;
    setBusy(true);
    setError("");
    try {
      const payload = buildStartPayloadFromPreMatchToss(startDetail, savedToss);
      await scorer.startMatch(payload);
      toastSuccess("Match started", "Using the toss recorded when the match was created.");
      onRefresh();
    } catch (e) {
      setError(friendlyBadmintonError(e, "Could not start the match"));
      setBusy(false);
    }
  }

  if (showTossSetup && canStart) {
    return (
      <div className="space-y-4">
        {error ? <FormError message={error} /> : null}
        {isPair ? (
          <DoublesPreMatchSetup
            detail={startDetail}
            embedded
            onCancel={() => {
              setShowTossSetup(false);
              setError("");
            }}
            onStart={handleTossStart}
          />
        ) : (
          <SinglesPreMatchSetup
            detail={startDetail}
            embedded
            onCancel={() => {
              setShowTossSetup(false);
              setError("");
            }}
            onStart={handleTossStart}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={cn(hubCardClass, "p-5 space-y-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
              Pre-match
            </p>
            <h2 className="text-white font-bold text-xl mt-1">
              {snapshot.leftLabel} vs {snapshot.rightLabel}
            </h2>
            <p className="text-white/40 text-sm mt-1">{snapshot.tournamentName}</p>
          </div>
          <ScoringFormatBadge label={snapshot.matchFormatLabel} />
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="Category" value={snapshot.categoryName ?? "—"} />
          <InfoRow label="Court" value={snapshot.courtLabel ?? "Unassigned"} />
          <InfoRow label="Scheduled time" value={formatWhen(snapshot.scheduledAt)} />
          <InfoRow
            label="Match format"
            value={snapshot.matchFormatLabel}
          />
          <InfoRow label="Team / Player (left)" value={snapshot.leftLabel} />
          <InfoRow label="Team / Player (right)" value={snapshot.rightLabel} />
          {pinHint ? <InfoRow label="Scorer PIN" value={pinHint} /> : null}
        </dl>
        {pinHint ? (
          <p className="text-white/45 text-xs">
            Share PIN <span className="text-white font-semibold tracking-wider">{pinHint}</span> with
            the court scorer — or open{" "}
            <Link
              href={badmintonScorerMatchPath(snapshot.matchId, snapshot.tournamentId)}
              className="text-[#4fc3f7] font-semibold hover:underline"
            >
              Live Scoring
            </Link>{" "}
            after start (scorer enters this PIN).
          </p>
        ) : null}
      </div>

      {hardWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <p className="text-amber-200 text-xs font-bold uppercase tracking-wider">
            Cannot start yet
          </p>
          <ul className="space-y-2">
            {hardWarnings.map((w) => (
              <li key={w.id} className="text-sm text-amber-100/90 flex flex-wrap items-center gap-2">
                <span>{w.message}</span>
                {w.href ? (
                  <Link href={w.href} className="text-[#4fc3f7] font-semibold hover:underline min-h-11 inline-flex items-center">
                    {w.hrefLabel ?? "Fix"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          {needsCourtOrTime ? (
            <button
              type="button"
              onClick={() => setShowDelay(true)}
              className="min-h-11 px-4 rounded-xl bg-amber-500/30 hover:bg-amber-500/40 border border-amber-400/40 text-amber-50 text-sm font-bold"
            >
              Set court & time now
            </button>
          ) : null}
        </div>
      ) : softWarnings.length > 0 ? (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-4 space-y-2">
          <p className="text-sky-200 text-xs font-bold uppercase tracking-wider">
            Check before starting
          </p>
          <ul className="space-y-2">
            {softWarnings.map((w) => (
              <li key={w.id} className="text-sm text-sky-100/90 flex flex-wrap items-center gap-2">
                <span>{w.message}</span>
                {w.href ? (
                  <Link href={w.href} className="text-[#4fc3f7] font-semibold hover:underline min-h-11 inline-flex items-center">
                    {w.hrefLabel ?? "Review"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-emerald-400/90 text-sm pt-1">
            Ready to start when you confirm — format, roster, and court will freeze.
          </p>
        </div>
      ) : (
        <p className="text-emerald-400/90 text-sm">
          Ready to start — format, roster, and court will freeze when the match begins.
        </p>
      )}

      {error ? <FormError message={error} /> : null}

      <div className="space-y-3">
        {hasSavedToss ? (
          <>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
              Toss already recorded when this match was created. You can start immediately, or re-do the toss on court.
            </div>
            <BtnPrimary
              disabled={busy || !canStart}
              onClick={() => {
                if (!canStart) {
                  setError("Fix the blocking warnings below, then start the match.");
                  return;
                }
                void handleStartWithSavedToss();
              }}
              className="w-full sm:w-auto min-h-12 text-base px-8"
            >
              Start Match (saved toss)
            </BtnPrimary>
            <button
              type="button"
              disabled={busy || !canStart}
              onClick={() => {
                if (!canStart) {
                  setError("Fix the blocking warnings below, then start the match.");
                  return;
                }
                setError("");
                setShowTossSetup(true);
              }}
              className="min-h-11 px-4 rounded-xl bg-white/6 hover:bg-white/10 text-white/70 text-sm font-semibold"
            >
              Re-do toss on court
            </button>
          </>
        ) : (
          <>
            <BtnPrimary
              disabled={busy || !canStart}
              onClick={() => {
                if (!canStart) {
                  setError("Fix the blocking warnings below, then start the match.");
                  return;
                }
                setError("");
                setShowTossSetup(true);
              }}
              className="w-full sm:w-auto min-h-12 text-base px-8"
            >
              Toss & Start Match
            </BtnPrimary>
            <p className="text-white/40 text-xs max-w-md">
              {isPair
                ? "Next: toss winner, serve/receive, first server, and first receiver."
                : "Next: choose which side serves first after the toss."}
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowWalkover(true)}
            className="min-h-11 px-4 rounded-xl bg-white/6 hover:bg-white/10 text-white/55 text-sm font-semibold"
          >
            Walkover
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowRetire(true)}
            className="min-h-11 px-4 rounded-xl bg-white/6 hover:bg-white/10 text-white/55 text-sm font-semibold"
          >
            Retire Before Start
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowDelay(true)}
            className={cn(
              "min-h-11 px-4 rounded-xl text-sm font-semibold",
              needsCourtOrTime
                ? "bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/40 text-amber-100"
                : "bg-white/6 hover:bg-white/10 text-white/55",
            )}
          >
            {needsCourtOrTime ? "Set court & time" : "Change time"}
          </button>
          <Link
            href={`/tournament/${snapshot.tournamentId}/badminton/matches?edit=${snapshot.matchId}`}
            className="min-h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/45 text-sm font-semibold inline-flex items-center"
          >
            Edit match
          </Link>
          {snapshot.fixtureId ? (
            <Link
              href={`/tournament/${snapshot.tournamentId}/badminton/schedule?fixture=${snapshot.fixtureId}`}
              className="min-h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/45 text-sm font-semibold inline-flex items-center"
            >
              Fixture schedule
            </Link>
          ) : null}
          <Link
            href={`/tournament/${snapshot.tournamentId}/badminton/control`}
            className="min-h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 text-sm font-semibold inline-flex items-center"
          >
            Control Center
          </Link>
        </div>
      </div>

      {showWalkover ? (
        <SideOutcomeModal
          title="Walkover"
          subtitle="Award the match without playing"
          leftLabel={snapshot.leftLabel}
          rightLabel={snapshot.rightLabel}
          confirmLabel="Confirm walkover"
          onClose={() => setShowWalkover(false)}
          onConfirm={async (winningSide) => {
            await director.walkover(winningSide, "opponent_absent");
            setShowWalkover(false);
            onRefresh();
          }}
        />
      ) : null}

      {showRetire ? (
        <SideOutcomeModal
          title="Retire Before Start"
          subtitle="Select the side that cannot continue — opponent wins"
          leftLabel={snapshot.leftLabel}
          rightLabel={snapshot.rightLabel}
          confirmLabel="Confirm retirement"
          pickRetiring
          onClose={() => setShowRetire(false)}
          onConfirm={async (retiringSide) => {
            const winningSide = retiringSide === "left" ? "right" : "left";
            // Pre-start retirement uses walkover (scoring engine retirement requires live).
            await director.walkover(winningSide, "forfeit");
            setShowRetire(false);
            onRefresh();
          }}
        />
      ) : null}

      {showDelay ? (
        <AssignCourtTimeModal
          tournamentId={snapshot.tournamentId}
          matchId={snapshot.matchId}
          fixtureId={snapshot.fixtureId}
          courtId={snapshot.courtId}
          courtLabel={snapshot.courtLabel}
          initialAt={snapshot.scheduledAt}
          needsCourt={!snapshot.courtId && !snapshot.courtLabel?.trim()}
          onClose={() => setShowDelay(false)}
          onSaved={() => {
            setShowDelay(false);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/4 border border-white/8 px-3 py-2.5">
      <dt className="text-white/35 text-[10px] font-bold uppercase tracking-wider">{label}</dt>
      <dd className="text-white text-sm font-medium mt-0.5 truncate">{value}</dd>
    </div>
  );
}

function SideOutcomeModal({
  title,
  subtitle,
  leftLabel,
  rightLabel,
  confirmLabel,
  pickRetiring,
  onClose,
  onConfirm,
}: {
  title: string;
  subtitle: string;
  leftLabel: string;
  rightLabel: string;
  confirmLabel: string;
  pickRetiring?: boolean;
  onClose: () => void;
  onConfirm: (side: "left" | "right") => Promise<void>;
}) {
  const [side, setSide] = useState<"left" | "right">("left");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <FormModal title={title} subtitle={subtitle} onClose={onClose} size="md">
      <FormField label={pickRetiring ? "Retiring side" : "Winning side"}>
        <DarkSelect
          value={side}
          onValueChange={(v) => setSide(v as "left" | "right")}
          options={[
            { value: "left", label: leftLabel },
            { value: "right", label: rightLabel },
          ]}
        />
      </FormField>
      <FormError message={error} />
      <FormActions
        onCancel={onClose}
        saving={saving}
        submitLabel={confirmLabel}
        onSubmit={() => {
          setSaving(true);
          setError("");
          void onConfirm(side)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
            .finally(() => setSaving(false));
        }}
      />
    </FormModal>
  );
}

function AssignCourtTimeModal({
  tournamentId,
  matchId,
  fixtureId,
  courtId: initialCourtId,
  courtLabel: initialCourtLabel,
  initialAt,
  needsCourt,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  matchId: number;
  fixtureId: number | null;
  courtId: number | null;
  courtLabel: string | null;
  initialAt: string | null;
  needsCourt: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [courtId, setCourtId] = useState<number | null>(initialCourtId);
  const [courtNumber, setCourtNumber] = useState(initialCourtLabel?.trim() || "");
  const [date, setDate] = useState(toDateInput(initialAt) || toDateInput(new Date().toISOString()));
  const [time, setTime] = useState(toTimeInput(initialAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (courtId == null) {
      setError("Select a court from the list");
      return;
    }
    if (!date || !time) {
      setError("Date and time are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      await badmintonFetch(tournamentId, `/matches/${matchId}`, {
        method: "PATCH",
        body: JSON.stringify({
          scheduledAt,
          courtId: courtId ?? undefined,
          courtNumber: courtNumber.trim() || undefined,
        }),
      });
      if (fixtureId != null && courtId != null) {
        await badmintonFetch(tournamentId, `/fixtures/${fixtureId}/schedule`, {
          method: "PATCH",
          body: JSON.stringify({ courtId, scheduledAt }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save court and time");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={needsCourt || !initialAt ? "Set court & time" : "Change scheduled time"}
      subtitle="Required before Toss & Start — also queues the match on Scorer Home"
      onClose={onClose}
      size="md"
    >
      <FormField label="Court (required)">
        <CourtAutocomplete
          tournamentId={tournamentId}
          value={courtNumber}
          courtId={courtId}
          onChange={({ courtNumber: nextLabel, courtId: nextId }) => {
            setCourtNumber(nextLabel);
            setCourtId(nextId);
          }}
          placeholder="Search courts…"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Time">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </FormField>
      </div>
      <FormError message={error} />
      <FormActions
        onCancel={onClose}
        onSubmit={() => void handleSave()}
        submitLabel="Save court & time"
        saving={saving}
      />
    </FormModal>
  );
}
