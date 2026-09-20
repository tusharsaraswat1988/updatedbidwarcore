import { useState } from "react";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityAutocomplete } from "@/components/city-autocomplete";
import {
  Loader2,
  Trophy,
  MapPin,
  Building2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Gavel,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAuctionCreateCatalogBindings } from "./auction-create-bindings";
import {
  emptyTournamentCreationDraft,
  WIZARD_STEPS,
  type TournamentCreationDraft,
  type WizardStepId,
} from "./types";

export type TournamentCreationPayload = {
  name: string;
  sport: string;
  city: string;
  venue?: string;
  variantId: string;
  competitionTypeId: string;
  ruleProfileId: string;
  ruleProfileVersion: string;
  presentationProfileId: string;
  presentationProfileVersion: string;
  basePurse: number;
  minBid: number;
  bidIncrement: number;
  auctionDate?: string;
  auctionTime?: string;
};

type TournamentCreationWizardProps = {
  mode?: "page" | "dialog";
  onCancel?: () => void;
  onCreated: (result: {
    id: number;
    name: string;
    auctionCode?: string | null;
  }) => void;
  submit: (payload: TournamentCreationPayload) => Promise<
    | { success: true; tournament: { id: number; name: string; auctionCode?: string | null } }
    | { success: false; error: string }
  >;
};

function getSportEmoji(id: string) {
  const s = (id || "").toLowerCase();
  if (s.includes("cricket")) return "🏏";
  if (s.includes("badminton")) return "🏸";
  if (s.includes("football") || s.includes("soccer")) return "⚽";
  if (s.includes("tennis") || s.includes("pickleball")) return "🎾";
  if (s.includes("kabaddi")) return "🤼";
  if (s.includes("volleyball")) return "🏐";
  if (s.includes("basketball")) return "🏀";
  return "🏆";
}

const STEP_LABELS = ["1. Tournament Setup", "2. License & Launch"];

export function TournamentCreationWizard({
  mode = "page",
  onCancel,
  onCreated,
  submit,
}: TournamentCreationWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<TournamentCreationDraft>(() =>
    emptyTournamentCreationDraft(),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const step = WIZARD_STEPS[stepIndex]!;
  const sports = CatalogRegistry.listSportsForCreation();
  const isDialog = mode === "dialog";

  function patch(partial: Partial<TournamentCreationDraft>) {
    setDraft((d) => ({ ...d, ...partial }));
    setError("");
  }

  function validateStep(id: WizardStepId): string | null {
    switch (id) {
      case "details":
        if (draft.name.trim().length < 3) return "Tournament name must be at least 3 characters.";
        if (!draft.sportId) return "Select a sport to continue.";
        if (!draft.city.trim()) return "City is required.";
        return null;
      case "experience": {
        const bindings = resolveAuctionCreateCatalogBindings(draft.sportId);
        if ("error" in bindings) return bindings.error;
        return null;
      }
      default:
        return null;
    }
  }

  function goNext() {
    const err = validateStep(step.id);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleCreate() {
    const err = validateStep("experience");
    if (err) {
      setError(err);
      return;
    }

    const bindings = resolveAuctionCreateCatalogBindings(draft.sportId);
    if ("error" in bindings) {
      setError(bindings.error);
      return;
    }

    setLoading(true);
    setError("");

    const payload: TournamentCreationPayload = {
      name: draft.name.trim(),
      sport: draft.sportId,
      city: draft.city.trim(),
      venue: draft.venue.trim() || undefined,
      variantId: bindings.variantId,
      competitionTypeId: bindings.competitionTypeId,
      ruleProfileId: bindings.ruleProfileId,
      ruleProfileVersion: bindings.ruleProfileVersion,
      presentationProfileId: bindings.presentationProfileId,
      presentationProfileVersion: bindings.presentationProfileVersion,
      basePurse: parseInt(draft.basePurse || "10000000", 10),
      minBid: parseInt(draft.minBid || "100000", 10),
      bidIncrement: parseInt(draft.bidIncrement || "50000", 10),
    };

    const result = await submit(payload);
    setLoading(false);
    if (!result.success) {
      setError(result.error || "Failed to create tournament.");
      return;
    }
    onCreated(result.tournament);
  }

  return (
    <div className={cn(isDialog ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-5")}>
      {/* ── Stepper Indicator ── */}
      <div className="space-y-1.5 pb-1">
        <div className="flex items-center gap-2">
          {WIZARD_STEPS.map((s, idx) => {
            const isPast = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            return (
              <div key={s.id} className="flex-1 flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-1.5 py-1 px-2.5 rounded-full transition-all select-none text-xs font-semibold",
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isPast
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/5 border border-white/10 text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      isCurrent
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : isPast
                          ? "bg-emerald-500/30 text-emerald-300"
                          : "bg-white/10 text-muted-foreground",
                    )}
                  >
                    {isPast ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : idx + 1}
                  </div>
                  <span className="tracking-tight truncate">{STEP_LABELS[idx]}</span>
                </div>
                {idx < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-[2px] rounded-full mx-1 transition-all",
                      idx < stepIndex ? "bg-emerald-500/40" : "bg-white/10",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.job}</p>
      </div>

      {error ? (
        <div className="text-xs text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* ── Main Content Area ── */}
      <div className="min-h-0 flex-1">
        {/* ════════════════════ STEP 1: TOURNAMENT SETUP ════════════════════ */}
        {step.id === "details" && (
          <div className="space-y-4">
            {/* Tournament Name */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
                <Trophy className="w-3.5 h-3.5 text-primary" />
                <span>Tournament Name</span>
                <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Mumbai Super League Season 3"
                className="h-11 rounded-xl bg-background/80 border-border focus:border-primary text-foreground text-sm font-medium"
                autoFocus
              />
            </div>

            {/* Sport Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
                Select Sport <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {sports.map((sport) => {
                  const selected = draft.sportId === sport.id;
                  const emoji = getSportEmoji(sport.id);
                  return (
                    <button
                      key={sport.id}
                      type="button"
                      onClick={() => patch({ sportId: sport.id })}
                      className={cn(
                        "flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border text-center sm:text-left transition-all duration-150 cursor-pointer select-none",
                        selected
                          ? "border-primary bg-primary/15 shadow-sm ring-1 ring-primary/40 text-primary font-bold"
                          : "border-border/60 bg-muted/10 hover:border-primary/40 hover:bg-muted/30 text-foreground",
                      )}
                    >
                      <span className="text-xl shrink-0">{emoji}</span>
                      <span className="text-xs font-semibold truncate">{sport.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* City & Venue */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>City</span>
                  <span className="text-destructive">*</span>
                </Label>
                <CityAutocomplete
                  value={draft.city}
                  onChange={(v) => patch({ city: v })}
                  placeholder="Type city (e.g. Pune, Delhi)"
                  minChars={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Venue / Ground</span>
                  <span className="text-[10px] text-muted-foreground lowercase font-normal">(optional)</span>
                </Label>
                <Input
                  value={draft.venue}
                  onChange={(e) => patch({ venue: e.target.value })}
                  placeholder="e.g. DY Patil Stadium, Court 1"
                  className="h-11 rounded-xl bg-background/80 border-border focus:border-primary text-foreground text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ STEP 2: LICENSE SELECTION ONLY (SUPER CLEAN) ════════════════════ */}
        {step.id === "experience" && (
          <div className="space-y-3">
            {/* Option 1: Auction Only (Active) */}
            <div
              onClick={() => patch({ licenseType: "auction_only" })}
              className="relative flex items-start gap-3.5 p-4 rounded-2xl border border-primary/60 bg-primary/10 shadow-md shadow-primary/5 ring-1 ring-primary/40 cursor-pointer transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-2xl shrink-0">
                🔨
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-foreground">
                    Live Auction Suite (Auction Only)
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Available Now
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Real-time auction host console, projector LED big screen view, team owner mobile bidding app & instant WhatsApp receipts.
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            </div>

            {/* Option 2: Match Scoring Only (Coming Soon) */}
            <div className="relative flex items-start gap-3.5 p-4 rounded-2xl border border-border/40 bg-muted/10 opacity-55 cursor-not-allowed select-none">
              <div className="w-11 h-11 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center text-2xl shrink-0 opacity-75">
                📊
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground/80">
                    Match Scoring Engine
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-amber-400 border border-amber-400/20">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Point-by-point digital match scoring, live scoreboard overlay & draw-based bracket manager.
                </p>
              </div>
              <Lock className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-1" />
            </div>

            {/* Option 3: Auction + Scoring (Coming Soon) */}
            <div className="relative flex items-start gap-3.5 p-4 rounded-2xl border border-border/40 bg-muted/10 opacity-55 cursor-not-allowed select-none">
              <div className="w-11 h-11 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center text-2xl shrink-0 opacity-75">
                ⚡
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground/80">
                    Auction + Match Scoring Bundle
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-amber-400 border border-amber-400/20">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  All-in-one tournament platform: player auction, squads, fixtures, match scoring & trophy presentation.
                </p>
              </div>
              <Lock className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-1" />
            </div>
          </div>
        )}
      </div>

      {/* ── Footer Actions ── */}
      <div className="shrink-0 pt-3 border-t border-border/40 flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-2">
        <div>
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 px-5 rounded-xl font-semibold gap-1.5 cursor-pointer border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground"
              onClick={goBack}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : onCancel ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-4 rounded-xl font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>

        <div className="w-full sm:w-auto">
          {step.id === "experience" ? (
            <Button
              type="button"
              className="w-full sm:w-auto h-12 px-8 rounded-xl font-display font-black text-base tracking-wide bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-xl shadow-amber-400/25 hover:shadow-amber-400/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              disabled={loading}
              onClick={() => void handleCreate()}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
              ) : (
                <Gavel className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              )}
              <span>Let&apos;s Go Inside →</span>
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto h-11 px-7 rounded-xl font-display font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 gap-2 cursor-pointer transition-all active:scale-[0.98]"
              onClick={goNext}
            >
              <span>Continue to License</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
