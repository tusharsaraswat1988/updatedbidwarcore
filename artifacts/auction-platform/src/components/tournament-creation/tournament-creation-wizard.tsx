import { useState } from "react";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import { isScoringSupportedSport } from "@workspace/platform-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import {
  Loader2,
  Trophy,
  MapPin,
  Building2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Check,
  Gavel,
  Coins,
  Calendar,
  Layers,
  Sparkles,
  Info,
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
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  basePurse?: number;
  minBid?: number;
  bidIncrement?: number;
  auctionDate?: string;
  auctionTime?: string;
  playerRegistrationMode?: string;
};

type TournamentCreationWizardProps = {
  mode?: "page" | "dialog";
  onCancel?: () => void;
  onCreated: (result: {
    id: number;
    name: string;
    auctionCode?: string | null;
    auctionEnabled?: boolean;
    scoringEnabled?: boolean;
    sport?: string;
  }) => void;
  submit: (payload: TournamentCreationPayload) => Promise<
    | {
        success: true;
        tournament: {
          id: number;
          name: string;
          auctionCode?: string | null;
          auctionEnabled?: boolean;
          scoringEnabled?: boolean;
          sport?: string;
        };
      }
    | { success: false; error: string }
  >;
};

function getSportEmoji(id: string) {
  const s = (id || "").toLowerCase();
  if (s.includes("cricket")) return "🏏";
  if (s.includes("badminton")) return "🏸";
  if (s.includes("football")) return "⚽";
  if (s.includes("kabaddi")) return "🤼";
  if (s.includes("volleyball")) return "🏐";
  if (s.includes("basketball")) return "🏀";
  return "🏆";
}

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

  const sportSupportsScoring = isScoringSupportedSport(draft.sportId);

  function patch(partial: Partial<TournamentCreationDraft>) {
    setDraft((d) => {
      const next = { ...d, ...partial };
      // If sport changed to one that doesn't support scoring, reset productMode to auction_only
      if (partial.sportId && !isScoringSupportedSport(partial.sportId) && next.productMode !== "auction_only") {
        next.productMode = "auction_only";
      }
      return next;
    });
    setError("");
  }

  function validateStep(id: WizardStepId): string | null {
    switch (id) {
      case "details":
        if (draft.name.trim().length < 3) return "Tournament name must be at least 3 characters.";
        if (!draft.sportId) return "Select a sport to continue.";
        if (!draft.city.trim()) return "City is required.";
        return null;
      case "products":
        if (!draft.productMode) return "Select a product module combination to continue.";
        if (
          (draft.productMode === "scoring_only" || draft.productMode === "both") &&
          !isScoringSupportedSport(draft.sportId)
        ) {
          return `Sports scoring is currently only supported for Cricket and Badminton. Choose Live Auction Only for ${draft.sportId}.`;
        }
        return null;
      case "configuration": {
        const auctionEnabled = draft.productMode === "auction_only" || draft.productMode === "both";
        if (auctionEnabled) {
          const basePurse = parseInt(draft.basePurse || "0", 10);
          const minBid = parseInt(draft.minBid || "0", 10);
          const bidIncrement = parseInt(draft.bidIncrement || "0", 10);
          if (isNaN(basePurse) || basePurse < 1) return "Team budget (base purse) must be at least 1.";
          if (isNaN(minBid) || minBid < 1) return "Minimum player bid must be at least 1.";
          if (isNaN(bidIncrement) || bidIncrement < 1) return "Bid increment must be at least 1.";
          if (minBid > basePurse) return "Minimum bid cannot exceed the total team budget.";
        }
        const bindings = resolveAuctionCreateCatalogBindings(draft.sportId, draft.productMode);
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
    const err = validateStep("configuration");
    if (err) {
      setError(err);
      return;
    }

    const bindings = resolveAuctionCreateCatalogBindings(draft.sportId, draft.productMode);
    if ("error" in bindings) {
      setError(bindings.error);
      return;
    }

    setLoading(true);
    setError("");

    const auctionEnabled = draft.productMode === "auction_only" || draft.productMode === "both";
    const scoringEnabled = draft.productMode === "scoring_only" || draft.productMode === "both";

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
      auctionEnabled,
      scoringEnabled,
      basePurse: auctionEnabled ? parseInt(draft.basePurse || "10000000", 10) : undefined,
      minBid: auctionEnabled ? parseInt(draft.minBid || "100000", 10) : undefined,
      bidIncrement: auctionEnabled ? parseInt(draft.bidIncrement || "50000", 10) : undefined,
      auctionDate: auctionEnabled && draft.auctionDate ? draft.auctionDate : undefined,
      playerRegistrationMode: scoringEnabled && !auctionEnabled ? "scoring" : "auction",
    };

    const result = await submit(payload);
    setLoading(false);
    if (!result.success) {
      setError(result.error || "Failed to create tournament.");
      return;
    }
    onCreated({
      ...result.tournament,
      auctionEnabled: result.tournament.auctionEnabled ?? auctionEnabled,
      scoringEnabled: result.tournament.scoringEnabled ?? scoringEnabled,
      sport: result.tournament.sport ?? draft.sportId,
    });
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
                  <span className="tracking-tight truncate">{s.title}</span>
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

        {/* ════════════════════ STEP 2: SELECT PRODUCT MODULES ════════════════════ */}
        {step.id === "products" && (
          <div className="space-y-3">
            {/* Option 1: Live Auction Only */}
            <div
              onClick={() => patch({ productMode: "auction_only" })}
              className={cn(
                "relative flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer",
                draft.productMode === "auction_only"
                  ? "border-amber-500/80 bg-amber-500/10 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/50"
                  : "border-border/60 bg-card/40 hover:bg-card/70 hover:border-border",
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl shrink-0">
                🔨
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-foreground">
                    Live Auction Only
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Auction Only
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Host-controlled player auction console, LED big screen projector view, team owner mobile bidding, and instant purse tracking. No match scoring required.
                </p>
              </div>
              {draft.productMode === "auction_only" ? (
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <div className="w-5 h-5 rounded-full border border-border/80 shrink-0 mt-0.5" />
              )}
            </div>

            {/* Option 2: Standalone Sports Scoring */}
            <div
              onClick={() => {
                if (sportSupportsScoring) patch({ productMode: "scoring_only" });
              }}
              className={cn(
                "relative flex items-start gap-3.5 p-4 rounded-2xl border transition-all",
                sportSupportsScoring ? "cursor-pointer" : "opacity-60 cursor-not-allowed bg-muted/20 border-dashed border-border/40",
                draft.productMode === "scoring_only"
                  ? "border-sky-500/80 bg-sky-500/10 shadow-md shadow-sky-500/10 ring-1 ring-sky-500/50"
                  : sportSupportsScoring
                    ? "border-border/60 bg-card/40 hover:bg-card/70 hover:border-border"
                    : "",
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-2xl shrink-0">
                📊
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-foreground">
                    Sports Scoring Only (No Auction)
                  </p>
                  {sportSupportsScoring ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
                      Live Ready
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {sportSupportsScoring
                    ? "Complete match scoring for leagues and tournaments. Ball-by-ball scoring pad, points table, NRR, player stats, and public match center."
                    : `Live match scoring is currently available for Cricket and Badminton. Support for ${draft.sportId} is coming soon.`}
                </p>
              </div>
              {draft.productMode === "scoring_only" ? (
                <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              ) : (
                <div className="w-5 h-5 rounded-full border border-border/80 shrink-0 mt-0.5" />
              )}
            </div>

            {/* Option 3: Both (Auction + Sports Scoring) */}
            <div
              onClick={() => {
                if (sportSupportsScoring) patch({ productMode: "both" });
              }}
              className={cn(
                "relative flex items-start gap-3.5 p-4 rounded-2xl border transition-all",
                sportSupportsScoring ? "cursor-pointer" : "opacity-60 cursor-not-allowed bg-muted/20 border-dashed border-border/40",
                draft.productMode === "both"
                  ? "border-primary/80 bg-primary/10 shadow-md shadow-primary/10 ring-1 ring-primary/50"
                  : sportSupportsScoring
                    ? "border-border/60 bg-card/40 hover:bg-card/70 hover:border-border"
                    : "",
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-2xl shrink-0">
                ⚡
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-foreground">
                    Both: Auction + Sports Scoring
                  </p>
                  {sportSupportsScoring ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                      Complete Platform
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {sportSupportsScoring
                    ? "Run the player auction first, then seamlessly transition sold squads into tournament fixtures, live match scoring, and leaderboards."
                    : `Requires match scoring support for ${draft.sportId}. Choose Live Auction Only for this sport.`}
                </p>
              </div>
              {draft.productMode === "both" ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              ) : (
                <div className="w-5 h-5 rounded-full border border-border/80 shrink-0 mt-0.5" />
              )}
            </div>
          </div>
        )}

        {/* ════════════════════ STEP 3: CONFIGURE SELECTED PRODUCTS ════════════════════ */}
        {step.id === "configuration" && (
          <div className="space-y-4">
            {/* If Auction is enabled, show Auction Economics */}
            {(draft.productMode === "auction_only" || draft.productMode === "both") && (
              <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm text-foreground">Auction Economics</h3>
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Required for Auction
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Team Budget (₹)</Label>
                    <Input
                      type="number"
                      value={draft.basePurse}
                      onChange={(e) => patch({ basePurse: e.target.value })}
                      placeholder="10000000"
                      className="h-10 text-sm font-medium"
                    />
                    <IndianAmountHint value={draft.basePurse} className="text-[10px]" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Min Player Bid (₹)</Label>
                    <Input
                      type="number"
                      value={draft.minBid}
                      onChange={(e) => patch({ minBid: e.target.value })}
                      placeholder="100000"
                      className="h-10 text-sm font-medium"
                    />
                    <IndianAmountHint value={draft.minBid} className="text-[10px]" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Bid Increment (₹)</Label>
                    <Input
                      type="number"
                      value={draft.bidIncrement}
                      onChange={(e) => patch({ bidIncrement: e.target.value })}
                      placeholder="50000"
                      className="h-10 text-sm font-medium"
                    />
                    <IndianAmountHint value={draft.bidIncrement} className="text-[10px]" />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Auction Date</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={draft.auctionDate}
                    onChange={(e) => patch({ auctionDate: e.target.value })}
                    className="h-10 text-sm font-medium max-w-xs"
                  />
                </div>
              </div>
            )}

            {/* If Scoring is enabled, show Sports Scoring Overview */}
            {(draft.productMode === "scoring_only" || draft.productMode === "both") && (
              <div className="space-y-2.5 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <h3 className="font-bold text-sm text-foreground">Sports Scoring Setup</h3>
                  <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                    {draft.sportId.toUpperCase()}
                  </span>
                </div>

                {draft.productMode === "scoring_only" && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No auction economics required. Teams can register complete squads directly, and match fixtures can be scheduled immediately.
                  </p>
                )}

                {draft.productMode === "both" && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sold players from the auction will automatically populate team squads for match scoring once the auction concludes.
                  </p>
                )}

                <div className="rounded-xl border border-border/50 bg-background/50 p-3 text-xs space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>Included Match Capabilities:</span>
                  </div>
                  {draft.sportId.toLowerCase() === "cricket" ? (
                    <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                      <li>Ball-by-ball digital scoring pad with overs, wickets, boundaries, and extras</li>
                      <li>Automated Net Run Rate (NRR) calculation and tournament points table</li>
                      <li>Match Center with live spectator updates and player statistics</li>
                    </ul>
                  ) : (
                    <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                      <li>Standard BWF scoring engine with point-by-point tracking and service rotation</li>
                      <li>Category management (Singles, Doubles, Mixed) and court allocation</li>
                      <li>Tournament draw progression, standings, and player profiles</li>
                    </ul>
                  )}
                  <p className="text-[10px] text-muted-foreground/80 pt-1 italic">
                    Note: Detailed match rules and squad limits can be fine-tuned inside the Match Command Center after creation.
                  </p>
                </div>
              </div>
            )}
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
          {stepIndex === WIZARD_STEPS.length - 1 ? (
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
              <span>Create Tournament →</span>
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto h-11 px-7 rounded-xl font-display font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 gap-2 cursor-pointer transition-all active:scale-[0.98]"
              onClick={goNext}
            >
              <span>Continue →</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
