import type { Request, Response, NextFunction } from "express";
import {
  verifyAuthJwt,
  verifyOAuthJwt,
  COOKIE_NAME,
  OAUTH_COOKIE_NAME,
  clearAuthCookie,
  type AuthClaims,
  type OAuthState,
} from "../lib/jwt";
import {
  validateOrganizerSession,
  touchOrganizerSessionThrottled,
  isOrganizerSessionRevocationEnforced,
  upgradeLegacyTokenToSession,
} from "../lib/organizer-session";
import type { OrganizerSession } from "@workspace/db";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      jwtUser: AuthClaims;
      oauthState: OAuthState;
      organizerSession?: OrganizerSession;
      sessionId?: string;
    }
  }
}

export async function jwtAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const oauthToken = req.cookies?.[OAUTH_COOKIE_NAME];
  req.oauthState = oauthToken ? (verifyOAuthJwt(oauthToken) ?? {}) : {};

  const authToken = req.cookies?.[COOKIE_NAME];
  if (!authToken) {
    req.jwtUser = {};
    next();
    return;
  }

  const claims = verifyAuthJwt(authToken);
  if (!claims) {
    req.jwtUser = {};
    next();
    return;
  }

  // 1. Admin bypass: Admin login is verified by server environment secrets.
  if (claims.isAdmin) {
    req.jwtUser = claims;
    next();
    return;
  }

  // 2. Organizer session revocation check via database session
  if (claims.sessionId) {
    try {
      const validation = await validateOrganizerSession(claims.sessionId, authToken);
      if (validation.valid && validation.session) {
        req.jwtUser = claims;
        req.organizerSession = validation.session;
        req.sessionId = claims.sessionId;
        touchOrganizerSessionThrottled(validation.session);
        next();
        return;
      }

      // Session revoked, expired, or token hash mismatch (stale token replay)
      logger.info(
        {
          sessionId: claims.sessionId,
          reason: validation.reason,
          organizerAccountId: claims.organizerAccountId,
        },
        "Organizer session rejected: invalid, revoked, or hash mismatch",
      );
      clearAuthCookie(res);
      req.jwtUser = {};
      next();
      return;
    } catch (err) {
      // Database failure: fail-closed for session identity
      logger.error(
        { err, sessionId: claims.sessionId },
        "Database error during organizer session validation — failing closed",
      );
      req.jwtUser = {};
      next();
      return;
    }
  }

  // 3. Legacy JWT without sessionId
  const enforced = isOrganizerSessionRevocationEnforced();
  if (!enforced) {
    // Stage 1: Grace period transparent upgrade
    const upgraded = await upgradeLegacyTokenToSession(req, res, claims, authToken);
    if (upgraded) {
      req.jwtUser = claims;
      req.sessionId = claims.sessionId;
      next();
      return;
    }
  }

  // Stage 2 or failed upgrade: Reject legacy token without DB session
  logger.warn(
    { organizerAccountId: claims.organizerAccountId, enforced },
    "Rejected legacy stateless JWT without session ID",
  );
  clearAuthCookie(res);
  req.jwtUser = {};
  next();
}
