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
import { Loader2 } from "lucide-react";
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
        if (!draft.sportId) return "Select a sport.";
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
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-between",
        isDialog &&
          "border-t border-border/60 bg-card/95 px-1 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-0",
      )}
    >
      <div className="flex gap-2">
        {stepIndex > 0 ? (
          <Button type="button" variant="outline" className="min-h-12 flex-1 sm:flex-none px-5" onClick={goBack}>
            Back
          </Button>
        ) : onCancel ? (
          <Button type="button" variant="ghost" className="min-h-12 flex-1 sm:flex-none px-5" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      {step.id === "review" ? (
        <Button
          type="button"
          className="min-h-12 flex-1 sm:flex-none px-6"
          disabled={loading}
          onClick={() => void handleCreate()}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create Tournament
        </Button>
      ) : (
        <Button type="button" className="min-h-12 flex-1 sm:flex-none px-6" onClick={goNext}>
          Continue
        </Button>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        isDialog ? "flex min-h-0 flex-1 flex-col gap-0" : "space-y-6",
      )}
    >
      <div className={cn(isDialog ? "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1" : "space-y-6")}>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </p>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{step.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.job}</p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((stepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error}
          </p>
        ) : null}

        <div className="min-h-[220px] pb-2">
          {step.id === "identity" && (
            <div className="space-y-4 rounded-xl border border-border bg-background/80 p-3.5 sm:p-4">
              <div className="space-y-2">
                <Label>Tournament Name *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g. City Championship"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>City *</Label>
                  <CityAutocomplete
                    value={draft.city}
                    onChange={(v) => patch({ city: v })}
                    placeholder="Start typing city name"
                    minChars={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Input
                    value={draft.venue}
                    onChange={(e) => patch({ venue: e.target.value })}
                    placeholder="Stadium, arena, or ground"
                  />
                </div>
              </div>
            </div>
          )}

          {step.id === "sport" && (
            <CatalogOptionList
              entries={sports}
              value={draft.sportId}
              onSelect={(entry) => patch({ sportId: entry.id })}
            />
          )}

          {step.id === "registration" && (
            <div className="space-y-4">
              <section className="space-y-4 rounded-xl border border-border bg-background/80 p-3.5 sm:p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Auction economics</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Required for every auction tournament. Full auction settings remain in Tournament
                    Settings.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Team budget (purse) *</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={draft.basePurse}
                      onChange={(e) => patch({ basePurse: e.target.value })}
                      placeholder="e.g. 10000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum player value *</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={draft.minBid}
                      onChange={(e) => patch({ minBid: e.target.value })}
                      placeholder="e.g. 100000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bid increase *</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={draft.bidIncrement}
                      onChange={(e) => patch({ bidIncrement: e.target.value })}
                      placeholder="e.g. 50000"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Auction date</Label>
                    <DatePicker
                      value={draft.auctionDate}
                      onChange={(auctionDate) => patch({ auctionDate })}
                      placeholder="Optional"
                      disablePastDates
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auction time</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={draft.auctionTimeHour || undefined}
                        onValueChange={(v) => patch({ auctionTimeHour: v })}
                      >
                        <SelectTrigger aria-label="Hour">
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={draft.auctionTimeMinute}
                        onValueChange={(v) => patch({ auctionTimeMinute: v })}
                      >
                        <SelectTrigger aria-label="Minute">
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent>
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
                        <SelectTrigger aria-label="AM or PM">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border bg-background/80 p-3.5 sm:p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Registration</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Optional signup limits and fee collection.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Registration deadline</Label>
                    <DatePicker
                      value={draft.registrationDeadline}
                      onChange={(registrationDeadline) => patch({ registrationDeadline })}
                      placeholder="Optional"
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Registration limit</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draft.registrationLimit}
                      onChange={(e) => patch({ registrationLimit: e.target.value })}
                      placeholder="Optional max registrations"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-rail px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Registration payment</p>
                    <p className="text-xs text-muted-foreground">Collect a fee at signup</p>
                  </div>
                  <Switch
                    checked={draft.enableRegistrationPayment}
                    onCheckedChange={(enableRegistrationPayment) =>
                      patch({ enableRegistrationPayment })
                    }
                  />
                </div>
                {draft.enableRegistrationPayment ? (
                  <div className="space-y-2">
                    <Label>Registration fee</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draft.registrationFee}
                      onChange={(e) => patch({ registrationFee: e.target.value })}
                      placeholder="Amount"
                    />
                  </div>
                ) : null}
              </section>
            </div>
          )}

          {step.id === "review" && (
            <div className="space-y-3 rounded-xl border border-border bg-background/80 p-3.5 sm:p-4">
              <p className="text-sm font-semibold">Auction tournament</p>
              <BlueprintRow label="Name" value={draft.name.trim()} />
              <BlueprintRow label="Sport" value={sportEntry?.displayName ?? draft.sportId} />
              <BlueprintRow label="City" value={draft.city.trim()} />
              {draft.venue.trim() ? (
                <BlueprintRow label="Venue" value={draft.venue.trim()} />
              ) : null}
              <BlueprintRow label="Team budget" value={draft.basePurse || "—"} />
              <BlueprintRow label="Minimum bid" value={draft.minBid || "—"} />
              <BlueprintRow label="Bid increase" value={draft.bidIncrement || "—"} />
              <BlueprintRow
                label="Auction schedule"
                value={
                  draft.auctionDate
                    ? `${draft.auctionDate}${
                        draft.auctionTimeHour
                          ? ` · ${draft.auctionTimeHour}:${draft.auctionTimeMinute} ${draft.auctionTimePeriod}`
                          : ""
                      }`
                    : "Not set"
                }
              />
              <BlueprintRow
                label="Registration"
                value={[
                  draft.registrationDeadline
                    ? `Deadline ${draft.registrationDeadline}`
                    : "No deadline",
                  draft.registrationLimit ? `Limit ${draft.registrationLimit}` : "No limit",
                  draft.enableRegistrationPayment
                    ? `Fee ${draft.registrationFee || "—"}`
                    : "Payment off",
                ].join(" · ")}
              />
              <p className="text-xs text-muted-foreground pt-2 leading-relaxed">
                How teams enter, squads, and scoring setup are configured later in Sports — after you
                open the Sports module for this tournament.
              </p>
            </div>
          )}
        </div>
      </div>

      {isDialog ? <div className="shrink-0 pt-1">{actions}</div> : actions}
    </div>
  );
}

function BlueprintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 last:border-0 last:pb-0 first:pt-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right break-words">{value}</span>
    </div>
  );
}
