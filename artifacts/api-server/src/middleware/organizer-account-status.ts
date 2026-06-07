import type { Request, Response, NextFunction } from "express";
import { db, organizersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      organizerAccountLicenseStatus?: string | null;
    }
  }
}

/** Loads organiser license status once per request for lock checks. */
export async function organizerAccountStatusMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.jwtUser?.organizerAccountId;
  if (!accountId) {
    req.organizerAccountLicenseStatus = null;
    next();
    return;
  }

  try {
    const [organizer] = await db
      .select({ licenseStatus: organizersTable.licenseStatus })
      .from(organizersTable)
      .where(eq(organizersTable.id, accountId))
      .limit(1);
    req.organizerAccountLicenseStatus = organizer?.licenseStatus ?? null;
  } catch {
    req.organizerAccountLicenseStatus = null;
  }

  next();
}
