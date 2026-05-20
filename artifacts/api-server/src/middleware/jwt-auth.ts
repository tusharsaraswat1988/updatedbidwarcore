import type { Request, Response, NextFunction } from "express";
import { verifyAuthJwt, verifyOAuthJwt, COOKIE_NAME, OAUTH_COOKIE_NAME } from "../lib/jwt";
import type { AuthClaims, OAuthState } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      jwtUser: AuthClaims;
      oauthState: OAuthState;
    }
  }
}

export function jwtAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authToken = req.cookies?.[COOKIE_NAME];
  req.jwtUser = authToken ? (verifyAuthJwt(authToken) ?? {}) : {};

  const oauthToken = req.cookies?.[OAUTH_COOKIE_NAME];
  req.oauthState = oauthToken ? (verifyOAuthJwt(oauthToken) ?? {}) : {};

  next();
}
