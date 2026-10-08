import jwt from "jsonwebtoken";
import type { SponsorMediaSurface } from "@workspace/scoring-core";
import { getSessionSecret } from "./runtime-env";

const DISPLAY_EXPIRY_SEC = 7 * 24 * 60 * 60;

export type SponsorDisplayIdentity = {
  tournamentId: number;
  surface: SponsorMediaSurface;
};

type DisplayClaims = {
  purpose: "sponsor_display";
  tournamentId: number;
  surface: SponsorMediaSurface;
};

/** Signed with the existing session secret. The surface is inside the token, not chosen at report time. */
export function signSponsorDisplaySession(identity: SponsorDisplayIdentity): string {
  const claims: DisplayClaims = {
    purpose: "sponsor_display",
    tournamentId: identity.tournamentId,
    surface: identity.surface,
  };
  return jwt.sign(claims, getSessionSecret(), { expiresIn: DISPLAY_EXPIRY_SEC });
}

export function verifySponsorDisplaySession(token: string): SponsorDisplayIdentity | null {
  try {
    const payload = jwt.verify(token, getSessionSecret()) as Partial<DisplayClaims>;
    if (payload.purpose !== "sponsor_display") return null;
    if (payload.surface !== "obs" && payload.surface !== "led") return null;
    const tournamentId = Number(payload.tournamentId);
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) return null;
    return { tournamentId, surface: payload.surface };
  } catch {
    return null;
  }
}

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}
