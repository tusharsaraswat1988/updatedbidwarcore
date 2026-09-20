import { useState } from "react";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Trophy,
  MapPin,
  Building2,
  Gavel,
  Users,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CatalogOptionList } from "./catalog-option-list";
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
  registrationDeadline?: string;
  registrationLimit?: number;
  enableRegistrationPayment?: boolean;
  registrationFee?: number;
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

const TIME_HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const TIME_MINUTES = ["00", "15", "30", "45"];

function to24HourTime(hour: number, minute: number, period: "AM" | "PM"): string {
  let h = hour % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatIndianNumberPreview(val: string): string | null {
  const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num) || num <= 0) return null;
  const formatted = num.toLocaleString("en-IN");
  if (num >= 10000000) {
    const cr = (num / 10000000).toFixed(2).replace(/\.00$/, "");
    return `₹${formatted} (${cr} Cr)`;
  }
  if (num >= 100000) {
    const lk = (num / 100000).toFixed(2).replace(/\.00$/, "");
    return `₹${formatted} (${lk} Lakh)`;
  }
  if (num >= 1000) {
    const k = (num / 1000).toFixed(1).replace(/\.0$/, "");
    return `₹${formatted} (${k}k)`;
  }
  return `₹${formatted}`;
}

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

const STEP_LABELS = ["Details", "Sport", "Economics", "Review"];

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
  const sportEntry = CatalogRegistry.getSport(draft.sportId);
  const isDialog = mode === "dialog";

  function patch(partial: Partial<TournamentCreationDraft>) {
    setDraft((d) => ({ ...d, ...partial }));
    setError("");
  }

  function validateStep(id: WizardStepId): string | null {
    switch (id) {
      case "identity":
        if (draft.name.trim().length < 3) return "Tournament name must be at least 3 characters.";
        if (!draft.city.trim()) return "City is required.";
        return null;
      case "sport":
        if (!draft.sportId) return "Select a sport to continue.";
        return null;
      case "registration":
        if (!draft.basePurse || parseInt(draft.basePurse, 10) < 1) {
          return "Team budget (purse) is required.";
        }
        if (!draft.minBid || parseInt(draft.minBid, 10) < 1) {
          return "Minimum player value is required.";
        }
        if (!draft.bidIncrement || parseInt(draft.bidIncrement, 10) < 1) {
          return "Bid increase amount is required.";
        }
        return null;
      case "review": {
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
    const err = validateStep("review");
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

    const auctionTime =
      draft.auctionDate && draft.auctionTimeHour
        ? to24HourTime(
            parseInt(draft.auctionTimeHour, 10),
            parseInt(draft.auctionTimeMinute, 10) || 0,
            draft.auctionTimePeriod,
          )
        : undefined;

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
      registrationDeadline: draft.registrationDeadline || undefined,
      registrationLimit: draft.registrationLimit
        ? parseInt(draft.registrationLimit, 10)
        : undefined,
      enableRegistrationPayment: draft.enableRegistrationPayment,
      registrationFee: draft.registrationFee
        ? parseInt(draft.registrationFee, 10)
        : undefined,
      basePurse: parseInt(draft.basePurse, 10),
      minBid: parseInt(draft.minBid, 10),
      bidIncrement: parseInt(draft.bidIncrement, 10),
      auctionDate: draft.auctionDate || undefined,
      auctionTime,
    };

    const result = await submit(payload);
    setLoading(false);
    if (!result.success) {
      setError(result.error || "Failed to create tournament.");
      return;
    }
    onCreated(result.tournament);
  }

  const actions = (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-between items-center",
        isDialog &&
          "border-t border-slate-700/50 bg-slate-900/90 px-1 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-0",
      )}
    >
      <div className="flex gap-2 w-full sm:w-auto">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 sm:flex-none px-4 rounded-xl font-medium gap-1.5 cursor-pointer border-slate-700/60 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-slate-100"
            onClick={goBack}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
        ) : onCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="h-10 flex-1 sm:flex-none px-4 rounded-xl font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        {step.id === "review" ? (
          <Button
            type="button"
            className="h-10 flex-1 sm:flex-none px-6 rounded-xl font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 gap-2 cursor-pointer transition-all active:scale-[0.98]"
            disabled={loading}
            onClick={() => void handleCreate()}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-200" />
            )}
            Create Tournament
          </Button>
        ) : (
          <Button
            type="button"
            className="h-10 flex-1 sm:flex-none px-6 rounded-xl font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/15 gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
            onClick={goNext}
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn(isDialog ? "flex min-h-0 flex-1 flex-col gap-0" : "space-y-5")}>
      <div
        className={cn(
          isDialog
            ? "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
            : "space-y-5",
        )}
      >
        {/* Soothing Horizontal Stepper */}
        <div className="space-y-2.5 pb-1">
          <div className="flex items-center justify-between gap-1">
            {WIZARD_STEPS.map((s, idx) => {
              const isPast = idx < stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div key={s.id} className="flex-1 flex items-center gap-1 sm:gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-2 py-1 px-1.5 sm:px-2 rounded-lg transition-all select-none",
                      isCurrent
                        ? "text-sky-400 font-semibold"
                        : isPast
                          ? "text-emerald-400 font-medium"
                          : "text-slate-500 font-normal",
                    )}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
                        isCurrent
                          ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                          : isPast
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-800/80 text-slate-500 border border-slate-700/50",
                      )}
                    >
                      {isPast ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : idx + 1}
                    </div>
                    <span className="text-xs hidden sm:inline-block tracking-tight">
                      {STEP_LABELS[idx]}
                    </span>
                  </div>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-[2px] rounded-full mx-1 transition-all",
                        idx < stepIndex ? "bg-emerald-500/40" : "bg-slate-800",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Header Text */}
          <div className="pt-1">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-100">
              {step.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 leading-relaxed">{step.job}</p>
          </div>
        </div>

        {error ? (
          <div className="text-xs sm:text-sm text-rose-300 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="min-h-[220px] pb-2">
          {/* STEP 1: DETAILS */}
          {step.id === "identity" && (
            <div className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/25 p-4 sm:p-5 shadow-sm">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                  <Trophy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Tournament Name</span>
                  <span className="text-rose-400">*</span>
                </Label>
                <Input
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g. Mumbai Super League Season 3"
                  className="h-10 rounded-xl bg-slate-900/60 border-slate-700/60 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20 text-slate-100 placeholder:text-slate-500 text-sm font-medium"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400">
                  Visible to players, team owners, and spectators on auction screens.
                </p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2 pt-1">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    <span>City</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <CityAutocomplete
                    value={draft.city}
                    onChange={(v) => patch({ city: v })}
                    placeholder="Type city (e.g. Pune, Delhi)"
                    minChars={2}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Venue / Ground</span>
                    <span className="text-[10px] text-slate-500">(Optional)</span>
                  </Label>
                  <Input
                    value={draft.venue}
                    onChange={(e) => patch({ venue: e.target.value })}
                    placeholder="e.g. DY Patil Stadium, Court 1"
                    className="h-10 rounded-xl bg-slate-900/60 border-slate-700/60 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20 text-slate-100 placeholder:text-slate-500 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SPORT SELECTION */}
          {step.id === "sport" && (
            <div className="space-y-3">
              <CatalogOptionList
                entries={sports}
                value={draft.sportId}
                onSelect={(entry) => patch({ sportId: entry.id })}
              />
            </div>
          )}

          {/* STEP 3: AUCTION ECONOMICS & REGISTRATION */}
          {step.id === "registration" && (
            <div className="space-y-4">
              {/* Card 1: Auction Economics */}
              <section className="space-y-3.5 rounded-2xl border border-slate-700/50 bg-slate-800/25 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-700/40">
                  <Gavel className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Auction Economics</h3>
                    <p className="text-[11px] text-slate-400">
                      Configure budget purse, minimum player value, and bid increase.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-slate-300">
                        Team Budget (Purse) <span className="text-rose-400">*</span>
                      </Label>
                      {draft.basePurse && (
                        <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          {formatIndianNumberPreview(draft.basePurse)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={draft.basePurse}
                        onChange={(e) => patch({ basePurse: e.target.value })}
                        placeholder="e.g. 10000000 (1 Cr)"
                        className="h-10 pl-8 rounded-xl bg-slate-900/60 border-slate-700/60 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20 text-slate-100 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-slate-300">
                        Min Player Value <span className="text-rose-400">*</span>
                      </Label>
                      {draft.minBid && (
                        <span className="text-[11px] font-semibold text-sky-300">
                          {formatIndianNumberPreview(draft.minBid)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={draft.minBid}
                        onChange={(e) => patch({ minBid: e.target.value })}
                        placeholder="e.g. 100000"
                        className="h-10 pl-8 rounded-xl bg-slate-900/60 border-slate-700/60 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20 text-slate-100 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-slate-300">
                        Bid Increase <span className="text-rose-400">*</span>
                      </Label>
                      {draft.bidIncrement && (
                        <span className="text-[11px] font-semibold text-indigo-300">
                          {formatIndianNumberPreview(draft.bidIncrement)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={draft.bidIncrement}
                        onChange={(e) => patch({ bidIncrement: e.target.value })}
                        placeholder="e.g. 50000"
                        className="h-10 pl-8 rounded-xl bg-slate-900/60 border-slate-700/60 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20 text-slate-100 text-sm font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Auction Schedule */}
                <div className="grid gap-3.5 sm:grid-cols-2 pt-2 border-t border-slate-700/30">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-sky-400" />
                      <span>Auction Date</span>
                    </Label>
                    <DatePicker
                      value={draft.auctionDate}
                      onChange={(auctionDate) => patch({ auctionDate })}
                      placeholder="Select date (Optional)"
                      disablePastDates
                      className="min-h-10 rounded-xl bg-slate-900/60 border-slate-700/60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Auction Time</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={draft.auctionTimeHour || undefined}
                        onValueChange={(v) => patch({ auctionTimeHour: v })}
                      >
                        <SelectTrigger aria-label="Hour" className="h-10 flex-1 rounded-xl bg-slate-900/60 border-slate-700/60 text-slate-200 text-xs sm:text-sm font-medium">
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent className="max-h-52 bg-slate-900 border-slate-700 text-slate-100">
                          {TIME_HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, "0")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={draft.auctionTimeMinute}
                        onValueChange={(v) => patch({ auctionTimeMinute: v })}
                      >
                        <SelectTrigger aria-label="Minute" className="h-10 flex-1 rounded-xl bg-slate-900/60 border-slate-700/60 text-slate-200 text-xs sm:text-sm font-medium">
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          {TIME_MINUTES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={draft.auctionTimePeriod}
                        onValueChange={(v) =>
                          patch({ auctionTimePeriod: v as "AM" | "PM" })
                        }
                      >
                        <SelectTrigger aria-label="AM or PM" className="h-10 w-20 rounded-xl bg-slate-900/60 border-slate-700/60 text-slate-200 text-xs sm:text-sm font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Card 2: Registration Options */}
              <section className="space-y-3.5 rounded-2xl border border-slate-700/50 bg-slate-800/25 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-700/40">
                  <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Player Registration</h3>
                    <p className="text-[11px] text-slate-400">
                      Optional public player registration settings and fee collection.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300">
                      Registration Deadline
                    </Label>
                    <DatePicker
                      value={draft.registrationDeadline}
                      onChange={(registrationDeadline) => patch({ registrationDeadline })}
                      placeholder="Optional deadline"
                      className="min-h-10 rounded-xl bg-slate-900/60 border-slate-700/60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300">
                      Registration Limit
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draft.registrationLimit}
                      onChange={(e) => patch({ registrationLimit: e.target.value })}
                      placeholder="e.g. 150 players (Optional)"
                      className="h-10 rounded-xl bg-slate-900/60 border-slate-700/60 focus:border-sky-400 text-slate-100 text-sm"
                    />
                  </div>
                </div>

                {/* Registration Fee Toggle Strip */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 shrink-0">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Collect Registration Fee</p>
                      <p className="text-[11px] text-slate-400">Collect payment when players register online</p>
                    </div>
                  </div>
                  <Switch
                    checked={draft.enableRegistrationPayment}
                    onCheckedChange={(enableRegistrationPayment) =>
                      patch({ enableRegistrationPayment })
                    }
                  />
                </div>

                {draft.enableRegistrationPayment ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-slate-300">
                        Registration Fee per Player
                      </Label>
                      {draft.registrationFee && (
                        <span className="text-xs font-semibold text-emerald-300">
                          {formatIndianNumberPreview(draft.registrationFee)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={draft.registrationFee}
                        onChange={(e) => patch({ registrationFee: e.target.value })}
                        placeholder="e.g. 500"
                        className="h-10 pl-8 rounded-xl bg-slate-900/60 border-slate-700/60 focus:border-sky-400 text-slate-100 text-sm font-semibold"
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {step.id === "review" && (
            <div className="space-y-3.5">
              {/* Header Blueprint Card */}
              <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/20 via-slate-900/40 to-slate-900/20 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow flex items-center justify-center text-3xl shrink-0">
                    {getSportEmoji(draft.sportId)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25">
                        {sportEntry?.displayName ?? draft.sportId}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/50">
                        {draft.city.trim()}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                      {draft.name.trim()}
                    </h3>
                    {draft.venue.trim() ? (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span>{draft.venue.trim()}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Economics & Schedule Details Grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/25 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 border-b border-slate-700/30 pb-1.5">
                    <Gavel className="w-3.5 h-3.5 text-sky-400" />
                    <span>Auction Economics</span>
                  </div>
                  <BlueprintRow
                    label="Purse"
                    value={formatIndianNumberPreview(draft.basePurse) || draft.basePurse || "—"}
                  />
                  <BlueprintRow
                    label="Min Value"
                    value={formatIndianNumberPreview(draft.minBid) || draft.minBid || "—"}
                  />
                  <BlueprintRow
                    label="Bid Step"
                    value={formatIndianNumberPreview(draft.bidIncrement) || draft.bidIncrement || "—"}
                  />
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-slate-800/25 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 border-b border-slate-700/30 pb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Schedule & Registration</span>
                  </div>
                  <BlueprintRow
                    label="Auction Time"
                    value={
                      draft.auctionDate
                        ? `${draft.auctionDate}${
                            draft.auctionTimeHour
                              ? ` · ${String(draft.auctionTimeHour).padStart(2, "0")}:${draft.auctionTimeMinute} ${draft.auctionTimePeriod}`
                              : ""
                          }`
                        : "Not scheduled"
                    }
                  />
                  <BlueprintRow
                    label="Registration"
                    value={
                      draft.registrationDeadline
                        ? `Till ${draft.registrationDeadline}`
                        : "Open"
                    }
                  />
                  <BlueprintRow
                    label="Payment"
                    value={
                      draft.enableRegistrationPayment
                        ? `₹${draft.registrationFee || 0} / player`
                        : "Free"
                    }
                  />
                </div>
              </div>

              {/* Reassuring Note */}
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-700/40 bg-slate-800/20 p-3 text-xs text-slate-400 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  After creation, your tournament will be instantly available on your organizer dashboard. You can customize squads, rules, and posters anytime in Settings.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {isDialog ? <div className="shrink-0 pt-2">{actions}</div> : actions}
    </div>
  );
}

function BlueprintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs py-0.5">
      <span className="text-slate-400 text-[11px] font-medium shrink-0">
        {label}
      </span>
      <span className="font-semibold text-slate-200 text-right truncate">{value}</span>
    </div>
  );
}
