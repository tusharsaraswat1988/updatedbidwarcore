import type { Request, Response, NextFunction } from "express";
import { LOCAL_AUTH_COOKIE, verifyLocalAuthJwt, type LocalAuthClaims } from "../lib/local-auth.js";

const JWT_USER_KEY = "localJwtUser" as const;

type RequestWithLocalJwt = Request & {
  [JWT_USER_KEY]?: LocalAuthClaims | null;
};

export function getLocalJwtUser(req: Request): LocalAuthClaims | null {
  return (req as RequestWithLocalJwt)[JWT_USER_KEY] ?? null;
}

export function localJwtAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[LOCAL_AUTH_COOKIE];
  (req as RequestWithLocalJwt)[JWT_USER_KEY] = token ? verifyLocalAuthJwt(token) : null;
  next();
}
