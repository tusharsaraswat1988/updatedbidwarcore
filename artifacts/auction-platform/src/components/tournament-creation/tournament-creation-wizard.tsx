import { useEffect, useMemo, useState } from "react";
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
import { CatalogOptionList } from "./catalog-option-list";
import { RuleProfileCatalogPanel } from "./rule-profile-catalog-panel";
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
  basePurse?: number;
  minBid?: number;
  bidIncrement?: number;
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
  const sports = useMemo(() => CatalogRegistry.listSportsForCreation(), []);
  const variants = useMemo(
    () => (draft.sportId ? CatalogRegistry.listVariants(draft.sportId) : []),
    [draft.sportId],
  );
  const competitions = useMemo(
    () => CatalogRegistry.listCompetitionTypes(draft.sportId || undefined),
    [draft.sportId],
  );
  const ruleProfiles = useMemo(() => {
    if (!draft.sportId || !draft.variantId || !draft.competitionTypeId) return [];
    return CatalogRegistry.listRuleProfiles({
      sportId: draft.sportId,
      variantId: draft.variantId,
      competitionTypeId: draft.competitionTypeId,
    });
  }, [draft.sportId, draft.variantId, draft.competitionTypeId]);
  const presentationProfiles = useMemo(() => {
    if (!draft.sportId || !draft.variantId || !draft.competitionTypeId) return [];
    return CatalogRegistry.listPresentationProfiles({
      sportId: draft.sportId,
      variantId: draft.variantId,
      competitionTypeId: draft.competitionTypeId,
    });
  }, [draft.sportId, draft.variantId, draft.competitionTypeId]);

  const needsAuctionEconomics = CatalogRegistry.requiresAuctionEconomics(
    draft.competitionTypeId,
  );

  // Cascade defaults when sport/variant/competition change
  useEffect(() => {
    if (!draft.sportId) return;
    const list = CatalogRegistry.listVariants(draft.sportId);
    if (list.length === 1 && draft.variantId !== list[0]!.id) {
      setDraft((d) => ({ ...d, variantId: list[0]!.id }));
    }
  }, [draft.sportId, draft.variantId]);

  useEffect(() => {
    if (!draft.sportId || !draft.variantId || !draft.competitionTypeId) return;
    const suggested = CatalogRegistry.suggestDefaults({
      sportId: draft.sportId,
      variantId: draft.variantId,
      competitionTypeId: draft.competitionTypeId,
    });
    setDraft((d) => {
      const next = { ...d };
      const ruleStillValid = CatalogRegistry.listRuleProfiles({
        sportId: d.sportId,
        variantId: d.variantId,
        competitionTypeId: d.competitionTypeId,
      }).some((p) => p.id === d.ruleProfileId);
      if (!ruleStillValid && suggested.ruleProfile) {
        next.ruleProfileId = suggested.ruleProfile.id;
        next.ruleProfileVersion = suggested.ruleProfile.version;
      }
      const presStillValid = CatalogRegistry.listPresentationProfiles({
        sportId: d.sportId,
        variantId: d.variantId,
        competitionTypeId: d.competitionTypeId,
      }).some((p) => p.id === d.presentationProfileId);
      if (!presStillValid && suggested.presentationProfile) {
        next.presentationProfileId = suggested.presentationProfile.id;
        next.presentationProfileVersion = suggested.presentationProfile.version;
      }
      return next;
    });
  }, [draft.sportId, draft.variantId, draft.competitionTypeId]);

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
      case "variant":
        if (!draft.variantId) return "Select a variant.";
        if (!CatalogRegistry.getVariant(draft.variantId)) return "Unknown variant.";
        return null;
      case "competition":
        if (!draft.competitionTypeId) return "Select a competition type.";
        return null;
      case "rule_profile":
        if (!draft.ruleProfileId) return "Select a rule profile.";
        return null;
      case "presentation":
        if (!draft.presentationProfileId) return "Select a presentation profile.";
        return null;
      case "registration":
        if (needsAuctionEconomics) {
          if (!draft.basePurse || parseInt(draft.basePurse, 10) < 1) {
            return "Team budget (purse) is required for auction/hybrid.";
          }
          if (!draft.minBid || parseInt(draft.minBid, 10) < 1) {
            return "Minimum player value is required for auction/hybrid.";
          }
          if (!draft.bidIncrement || parseInt(draft.bidIncrement, 10) < 1) {
            return "Bid increase amount is required for auction/hybrid.";
          }
        }
        return null;
      case "review": {
        const v = CatalogRegistry.validateCreateBindings({
          sportId: draft.sportId,
          variantId: draft.variantId,
          competitionTypeId: draft.competitionTypeId,
          ruleProfileId: draft.ruleProfileId,
          ruleProfileVersion: draft.ruleProfileVersion || undefined,
          presentationProfileId: draft.presentationProfileId,
          presentationProfileVersion: draft.presentationProfileVersion || undefined,
        });
        return v.ok ? null : v.error;
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
    // Skip variant step visually? Keep it — auto-selects when only one.
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
      variantId: draft.variantId,
      competitionTypeId: draft.competitionTypeId,
      ruleProfileId: draft.ruleProfileId,
      ruleProfileVersion: draft.ruleProfileVersion,
      presentationProfileId: draft.presentationProfileId,
      presentationProfileVersion: draft.presentationProfileVersion,
      registrationDeadline: draft.registrationDeadline || undefined,
      registrationLimit: draft.registrationLimit
        ? parseInt(draft.registrationLimit, 10)
        : undefined,
      enableRegistrationPayment: draft.enableRegistrationPayment,
      registrationFee: draft.registrationFee
        ? parseInt(draft.registrationFee, 10)
        : undefined,
      auctionDate: draft.auctionDate || undefined,
      auctionTime,
    };

    if (needsAuctionEconomics) {
      payload.basePurse = parseInt(draft.basePurse, 10);
      payload.minBid = parseInt(draft.minBid, 10);
      payload.bidIncrement = parseInt(draft.bidIncrement, 10);
    }

    const result = await submit(payload);
    setLoading(false);
    if (!result.success) {
      setError(result.error || "Failed to create tournament.");
      return;
    }
    onCreated(result.tournament);
  }

  const sportEntry = CatalogRegistry.getSport(draft.sportId);
  const variantEntry = CatalogRegistry.getVariant(draft.variantId);
  const competitionEntry = CatalogRegistry.getCompetitionType(draft.competitionTypeId);
  const ruleEntry = CatalogRegistry.getRuleProfile(
    draft.ruleProfileId,
    draft.ruleProfileVersion,
  );
  const presentationEntry = CatalogRegistry.getPresentationProfile(
    draft.presentationProfileId,
    draft.presentationProfileVersion,
  );

  return (
    <div className={mode === "page" ? "space-y-6" : "space-y-4"}>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Step {stepIndex + 1} of {WIZARD_STEPS.length}
        </p>
        <h2 className="text-xl font-bold tracking-tight">{step.title}</h2>
        <p className="text-sm text-muted-foreground">{step.job}</p>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((stepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="min-h-[280px]">
        {step.id === "identity" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tournament Name *</Label>
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. City Championship"
                className="min-h-12"
              />
            </div>
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
                className="min-h-12"
              />
            </div>
          </div>
        )}

        {step.id === "sport" && (
          <CatalogOptionList
            entries={sports}
            value={draft.sportId}
            onSelect={(entry) =>
              patch({
                sportId: entry.id,
                variantId: "",
                competitionTypeId: "",
                ruleProfileId: "",
                ruleProfileVersion: "",
                presentationProfileId: "",
                presentationProfileVersion: "",
              })
            }
          />
        )}

        {step.id === "variant" && (
          <CatalogOptionList
            entries={variants}
            value={draft.variantId}
            onSelect={(entry) =>
              patch({
                variantId: entry.id,
                ruleProfileId: "",
                ruleProfileVersion: "",
                presentationProfileId: "",
                presentationProfileVersion: "",
              })
            }
            emptyLabel="No variants available for this sport."
          />
        )}

        {step.id === "competition" && (
          <CatalogOptionList
            entries={competitions}
            value={draft.competitionTypeId}
            onSelect={(entry) =>
              patch({
                competitionTypeId: entry.id,
                ruleProfileId: "",
                ruleProfileVersion: "",
                presentationProfileId: "",
                presentationProfileVersion: "",
              })
            }
          />
        )}

        {step.id === "rule_profile" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <CatalogOptionList
              entries={ruleProfiles}
              value={draft.ruleProfileId}
              onSelect={(entry) =>
                patch({
                  ruleProfileId: entry.id,
                  ruleProfileVersion: entry.version,
                })
              }
              emptyLabel="No rule profiles match this sport, variant, and competition."
            />
            <RuleProfileCatalogPanel profile={ruleEntry} />
          </div>
        )}

        {step.id === "presentation" && (
          <CatalogOptionList
            entries={presentationProfiles}
            value={draft.presentationProfileId}
            onSelect={(entry) =>
              patch({
                presentationProfileId: entry.id,
                presentationProfileVersion: entry.version,
              })
            }
            emptyLabel="No presentation profiles match this combination."
          />
        )}

        {step.id === "registration" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Registration deadline</Label>
              <DatePicker
                value={draft.registrationDeadline}
                onChange={(registrationDeadline) => patch({ registrationDeadline })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Registration limit</Label>
              <Input
                type="number"
                min={0}
                value={draft.registrationLimit}
                onChange={(e) => patch({ registrationLimit: e.target.value })}
                placeholder="Optional max registrations"
                className="min-h-12"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
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
                  min={0}
                  value={draft.registrationFee}
                  onChange={(e) => patch({ registrationFee: e.target.value })}
                  className="min-h-12"
                />
              </div>
            ) : null}

            {needsAuctionEconomics ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <p className="text-sm font-semibold">Auction economics</p>
                <p className="text-xs text-muted-foreground">
                  Required for Auction / Hybrid. Full auction settings remain in Tournament Settings.
                </p>
                <div className="space-y-2">
                  <Label>Team budget (purse) *</Label>
                  <Input
                    type="number"
                    value={draft.basePurse}
                    onChange={(e) => patch({ basePurse: e.target.value })}
                    className="min-h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minimum player value *</Label>
                  <Input
                    type="number"
                    value={draft.minBid}
                    onChange={(e) => patch({ minBid: e.target.value })}
                    className="min-h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bid increase *</Label>
                  <Input
                    type="number"
                    value={draft.bidIncrement}
                    onChange={(e) => patch({ bidIncrement: e.target.value })}
                    className="min-h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auction date</Label>
                  <DatePicker
                    value={draft.auctionDate}
                    onChange={(auctionDate) => patch({ auctionDate })}
                    placeholder="Optional"
                    disablePastDates
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auction time</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={draft.auctionTimeHour || undefined}
                      onValueChange={(v) => patch({ auctionTimeHour: v })}
                    >
                      <SelectTrigger className="min-h-12">
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
                      <SelectTrigger className="min-h-12">
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
                      <SelectTrigger className="min-h-12">
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
            ) : null}
          </div>
        )}

        {step.id === "review" && (
          <div className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-4">
            <p className="text-sm font-semibold">Tournament Blueprint</p>
            <BlueprintRow label="Sport" value={sportEntry?.displayName ?? draft.sportId} />
            <BlueprintRow label="Variant" value={variantEntry?.displayName ?? draft.variantId} />
            <BlueprintRow
              label="Competition"
              value={competitionEntry?.displayName ?? draft.competitionTypeId}
            />
            <BlueprintRow
              label="Rule Profile"
              value={
                ruleEntry
                  ? `${ruleEntry.displayName} (v${ruleEntry.version})`
                  : draft.ruleProfileId
              }
            />
            <BlueprintRow
              label="Presentation Profile"
              value={
                presentationEntry
                  ? `${presentationEntry.displayName} (v${presentationEntry.version})`
                  : draft.presentationProfileId
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
            <BlueprintRow label="Name" value={draft.name.trim()} />
            <BlueprintRow label="City" value={draft.city.trim()} />
            {draft.venue.trim() ? (
              <BlueprintRow label="Venue" value={draft.venue.trim()} />
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-2">
        <div className="flex gap-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" className="min-h-12 px-5" onClick={goBack}>
              Back
            </Button>
          ) : onCancel ? (
            <Button type="button" variant="ghost" className="min-h-12 px-5" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
        {step.id === "review" ? (
          <Button
            type="button"
            className="min-h-12 px-6"
            disabled={loading}
            onClick={() => void handleCreate()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Tournament
          </Button>
        ) : (
          <Button type="button" className="min-h-12 px-6" onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

function BlueprintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
