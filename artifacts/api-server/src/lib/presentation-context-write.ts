/**
 * Presentation context concurrency.
 *
 * `obs_context_json.revision` is a presentation revision, separate from the
 * auction bid revision. A write is accepted only when the caller's
 * `expectedRevision` still matches the stored revision. The compare and the
 * update are one UPDATE ... WHERE, so Postgres rechecks the row after taking
 * its lock. Two requests that observed the same revision cannot both commit:
 * the first advances the revision, and the second matches zero rows.
 *
 * Clients must send the revision they rendered. A missing expectedRevision is
 * rejected. It is not treated as "use whatever is current", because that would
 * let a stale operator overwrite a newer selection.
 *
 * LED MAIN (overlay off) uses the same compare-and-set when the operator sends
 * expectedRevision. A legacy overlay-off call that omits it still applies, and
 * advances the revision, so a later OBS write based on the old revision fails.
 */
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { auctionSessionsTable } from "@workspace/db/schema";
import type * as schema from "@workspace/db/schema";
import {
  parsePersistedPresentationContext,
  presentationRecord,
  type LedOverlaySessionPatch,
  type PresentationContextState,
} from "./led-overlay-patch";

type PresentationDatabase = NodePgDatabase<typeof schema>;

export type PresentationWriteInput = {
  tournamentId: number;
  expectedRevision?: number;
  context?: PresentationContextState["context"];
  selectedTeamId?: number | null;
  /** When true, keep the stored team id and ignore selectedTeamId. Used by LED MAIN. */
  preserveSelectedTeamId?: boolean;
  /** Omit when the write must not touch the LED overlay. */
  overlayPatch?: LedOverlaySessionPatch;
  /**
   * Undefined keeps the plate already on air.
   * Null closes it. A plate replaces it.
   */
  prize?: PresentationContextState["prize"];
};

export type PresentationWriteFailure = "stale_presentation" | "presentation_revision_required";

export type PresentationWriteResult =
  | { ok: true; presentation: PresentationContextState }
  | { ok: false; code: PresentationWriteFailure };

export function presentationWriteFailure(code: PresentationWriteFailure): {
  status: 400 | 409;
  error: string;
  code: PresentationWriteFailure;
} {
  if (code === "presentation_revision_required") {
    return { status: 400, error: "expectedRevision is required.", code };
  }
  return { status: 409, error: "The broadcast was changed by a newer action.", code };
}

export function presentationRevisionCondition(expectedRevision: number) {
  return sql`COALESCE(
    CASE
      WHEN ${auctionSessionsTable.obsContextJson} IS NULL
        OR btrim(${auctionSessionsTable.obsContextJson}) = '' THEN 0
      ELSE COALESCE(
        (substring(${auctionSessionsTable.obsContextJson} from '"revision"[[:space:]]*:[[:space:]]*([0-9]+)'))::integer,
        0
      )
    END,
    0
  ) = ${expectedRevision}`;
}

export async function commitPresentationContext(
  database: PresentationDatabase,
  input: PresentationWriteInput,
): Promise<PresentationWriteResult> {
  if (input.expectedRevision === undefined) {
    return { ok: false, code: "presentation_revision_required" };
  }
  const expectedRevision = input.expectedRevision;
  const [session] = await database
    .select({ obsContextJson: auctionSessionsTable.obsContextJson })
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, input.tournamentId))
    .limit(1);
  const current = parsePersistedPresentationContext(session?.obsContextJson);
  const next: PresentationContextState = presentationRecord({
    context: input.context ?? current.context,
    selectedTeamId: input.preserveSelectedTeamId
      ? current.selectedTeamId
      : input.selectedTeamId !== undefined
        ? input.selectedTeamId
        : current.selectedTeamId,
    revision: expectedRevision + 1,
    prize: input.prize !== undefined ? input.prize : (current.prize ?? null),
  });
  const updated = await database
    .update(auctionSessionsTable)
    .set({
      obsContextJson: JSON.stringify(next),
      ...(input.overlayPatch ?? {}),
    })
    .where(
      and(
        eq(auctionSessionsTable.tournamentId, input.tournamentId),
        presentationRevisionCondition(expectedRevision),
      ),
    )
    .returning({ id: auctionSessionsTable.id });
  if (updated.length === 0) return { ok: false, code: "stale_presentation" };
  return { ok: true, presentation: next };
}
