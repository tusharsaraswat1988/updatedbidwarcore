import type { TournamentProductMode } from "@workspace/platform-core";

export type WizardStepId = "details" | "products" | "configuration";

export type LicenseOptionId = "auction_only" | "scoring_only" | "auction_and_scoring";

export type TournamentCreationDraft = {
  name: string;
  city: string;
  venue: string;
  sportId: string;
  productMode: TournamentProductMode;
  /** Legacy compatibility alias */
  licenseType?: LicenseOptionId;
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
    title: "1. Tournament Setup",
    job: "Enter basic details and choose a sport",
  },
  {
    id: "products",
    title: "2. Product Modules",
    job: "Select Auction, Sports Scoring, or Both",
  },
  {
    id: "configuration",
    title: "3. Configuration",
    job: "Configure rules and economics for selected products",
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
    productMode: "auction_only",
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
