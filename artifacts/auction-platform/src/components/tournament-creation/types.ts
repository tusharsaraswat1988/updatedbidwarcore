export type WizardStepId =
  | "identity"
  | "sport"
  | "variant"
  | "competition"
  | "registration_mode"
  | "team_formation"
  | "squad_rules"
  | "rule_profile"
  | "presentation"
  | "registration"
  | "review";

export type SquadRulesDraft = {
  minPlayers: string;
  maxPlayers: string;
  substitutes: string;
  retentions: string;
};

export type TournamentCreationDraft = {
  name: string;
  city: string;
  venue: string;
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  registrationModeId: string;
  teamFormationStrategyId: string;
  squadRules: SquadRulesDraft;
  ruleProfileId: string;
  ruleProfileVersion: string;
  presentationProfileId: string;
  presentationProfileVersion: string;
  registrationDeadline: string;
  registrationLimit: string;
  enableRegistrationPayment: boolean;
  registrationFee: string;
  /** Auction economics — only when competition requires them. */
  basePurse: string;
  minBid: string;
  bidIncrement: string;
  auctionDate: string;
  auctionTimeHour: string;
  auctionTimeMinute: string;
  auctionTimePeriod: "AM" | "PM";
};

export const WIZARD_STEPS: { id: WizardStepId; title: string; job: string }[] = [
  { id: "identity", title: "Identity", job: "Name your tournament and set location" },
  { id: "sport", title: "Sport", job: "Choose the sport for this event" },
  { id: "variant", title: "Variant", job: "Pick the sport variant" },
  { id: "competition", title: "Competition", job: "How teams enter and compete" },
  { id: "registration_mode", title: "Registration Mode", job: "How participants enter" },
  { id: "team_formation", title: "Team Formation", job: "How teams will be formed" },
  { id: "squad_rules", title: "Squad Rules", job: "Min/max squad configuration" },
  { id: "rule_profile", title: "Rule Profile", job: "Choose a product Rule Profile from the catalog" },
  { id: "presentation", title: "Presentation", job: "Bind look & display pack by reference" },
  { id: "registration", title: "Registration", job: "Light registration settings" },
  { id: "review", title: "Review", job: "Confirm your Tournament Blueprint" },
];

export function emptyTournamentCreationDraft(
  defaults?: Partial<TournamentCreationDraft>,
): TournamentCreationDraft {
  return {
    name: "",
    city: "",
    venue: "",
    sportId: "cricket",
    variantId: "",
    competitionTypeId: "",
    registrationModeId: "",
    teamFormationStrategyId: "",
    squadRules: {
      minPlayers: "",
      maxPlayers: "",
      substitutes: "",
      retentions: "",
    },
    ruleProfileId: "",
    ruleProfileVersion: "",
    presentationProfileId: "",
    presentationProfileVersion: "",
    registrationDeadline: "",
    registrationLimit: "",
    enableRegistrationPayment: false,
    registrationFee: "",
    basePurse: "",
    minBid: "",
    bidIncrement: "",
    auctionDate: "",
    auctionTimeHour: "",
    auctionTimeMinute: "00",
    auctionTimePeriod: "AM",
    ...defaults,
  };
}
