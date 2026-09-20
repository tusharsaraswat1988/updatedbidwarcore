export type WizardStepId = "details" | "experience";

export type LicenseOptionId = "auction_only" | "scoring_only" | "auction_and_scoring";

export type TournamentCreationDraft = {
  name: string;
  city: string;
  venue: string;
  sportId: string;
  licenseType: LicenseOptionId;
  basePurse: string;
  minBid: string;
  bidIncrement: string;
  auctionDate: string;
  auctionTimeHour: string;
  auctionTimeMinute: string;
  auctionTimePeriod: "AM" | "PM";
};

export const WIZARD_STEPS: { id: WizardStepId; title: string; job: string }[] = [
  {
    id: "details",
    title: "Tournament Setup",
    job: "Enter basic details to get started",
  },
  {
    id: "experience",
    title: "License Type",
    job: "Select the features you want for this tournament",
  },
];

export function emptyTournamentCreationDraft(
  defaults?: Partial<TournamentCreationDraft>,
): TournamentCreationDraft {
  return {
    name: "",
    city: "",
    venue: "",
    sportId: "cricket",
    licenseType: "auction_only",
    basePurse: "10000000",
    minBid: "100000",
    bidIncrement: "50000",
    auctionDate: "",
    auctionTimeHour: "",
    auctionTimeMinute: "00",
    auctionTimePeriod: "AM",
    ...defaults,
  };
}
