export type WizardStepId = "identity" | "sport" | "registration" | "review";

export type TournamentCreationDraft = {
  name: string;
  city: string;
  venue: string;
  sportId: string;
  registrationDeadline: string;
  registrationLimit: string;
  enableRegistrationPayment: boolean;
  registrationFee: string;
  /** Always collected on auction-platform create. */
  basePurse: string;
  minBid: string;
  bidIncrement: string;
  auctionDate: string;
  auctionTimeHour: string;
  auctionTimeMinute: string;
  auctionTimePeriod: "AM" | "PM";
};

/** Auction create only — Sports catalog questions live in Mission Control. */
export const WIZARD_STEPS: { id: WizardStepId; title: string; job: string }[] = [
  { id: "identity", title: "Identity", job: "Name your tournament and set location" },
  { id: "sport", title: "Sport", job: "Choose the sport for this event" },
  {
    id: "registration",
    title: "Auction & Registration",
    job: "Set auction economics and light registration options",
  },
  { id: "review", title: "Review", job: "Confirm and create your auction tournament" },
];

export function emptyTournamentCreationDraft(
  defaults?: Partial<TournamentCreationDraft>,
): TournamentCreationDraft {
  return {
    name: "",
    city: "",
    venue: "",
    sportId: "",
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
