import type { Request, Response, NextFunction } from "express";
import { db, organizersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { organizerNeedsPhoneVerification } from "@workspace/api-base/mobile";
import {
  hasTournamentOrganizerJwt,
  tournamentIdFromApiPath,
} from "./require-organizer";

declare global {
  namespace Express {
    interface Request {
      organizerAccountLicenseStatus?: string | null;
      /** True when logged-in organizer must finish phone OTP before product APIs. */
      organizerPhoneIncomplete?: boolean;
    }
  }
}

/** Mutating auth paths allowed while phone verification is incomplete. */
const PHONE_INCOMPLETE_MUTATION_ALLOWLIST = [
  /^\/api\/auth\/organizer-account\/logout$/,
  /^\/api\/auth\/organizer-account\/phone\//,
  /^\/api\/auth\/google\/complete-profile/,
  // Per-tournament organizer password login (separate from account phone OTP).
  /^\/api\/auth\/organizer\/\d+\/login$/,
  /^\/api\/auth\/organizer\/\d+\/logout$/,
  /^\/api\/auth\/organizer\/\d+\/password$/,
  /^\/api\/auth\/organizer\/\d+\/bootstrap$/,
];

function isPhoneIncompleteMutationAllowed(path: string): boolean {
  return PHONE_INCOMPLETE_MUTATION_ALLOWLIST.some((re) => re.test(path));
}

/** Loads organiser license + phone completeness once per request. */
export async function organizerAccountStatusMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.jwtUser?.organizerAccountId;
  if (!accountId) {
    req.organizerAccountLicenseStatus = null;
    req.organizerPhoneIncomplete = false;
    next();
    return;
  }

  try {
    const [organizer] = await db
      .select({
        licenseStatus: organizersTable.licenseStatus,
        mobile: organizersTable.mobile,
        phoneVerified: organizersTable.phoneVerified,
      })
      .from(organizersTable)
      .where(eq(organizersTable.id, accountId))
      .limit(1);
    req.organizerAccountLicenseStatus = organizer?.licenseStatus ?? null;
    req.organizerPhoneIncomplete = organizer
      ? organizerNeedsPhoneVerification({
          mobile: organizer.mobile,
          phoneVerified: organizer.phoneVerified,
        })
      : false;
  } catch {
    req.organizerAccountLicenseStatus = null;
    req.organizerPhoneIncomplete = false;
  }

  const method = req.method.toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const scopedTournamentId = tournamentIdFromApiPath(req.path);
  const hasTournamentSession =
    scopedTournamentId != null && hasTournamentOrganizerJwt(req, scopedTournamentId);
  if (
    req.organizerPhoneIncomplete &&
    isMutation &&
    req.path.startsWith("/api/") &&
    !isPhoneIncompleteMutationAllowed(req.path) &&
    !hasTournamentSession
  ) {
    res.status(403).json({
      error: "Complete your mobile verification to continue.",
      code: "PHONE_VERIFICATION_REQUIRED",
      needsMobile: true,
    });
    return;
  }

  next();
}
