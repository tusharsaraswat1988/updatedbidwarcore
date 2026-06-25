import { SportType } from "../../types/sport-types";

export interface PlayerSpotlightData {
  playerName: string;

  teamName?: string;

  playerImageUrl?: string;

  teamLogoUrl?: string;

  sport: SportType;

  designation?: string;

  city?: string;
}
