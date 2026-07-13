/**
 * Bracket progress — overlay results onto fixture collections.
 * No new bracket engine; no fake progression edges.
 */

import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import {
  buildBracketOverlay,
  type ResultsCollection,
  type ResultsFixture,
  type ResultsMatch,
} from "@/lib/badminton-results";

export function BracketProgressPanel({
  collections,
  fixtures,
  matches,
  hasProgressionLinks,
  sideLabel,
}: {
  collections: ResultsCollection[];
  fixtures: ResultsFixture[];
  matches: ResultsMatch[];
  hasProgressionLinks: boolean;
  sideLabel?: (registrationId: number | null | undefined) => string;
}) {
  if (collections.length === 0) {
    return (
      <p className="text-white/35 text-sm">No fixture collections for this category yet.</p>
    );
  }

  const rounds = buildBracketOverlay(collections, fixtures, matches, sideLabel);

  return (
    <div className="space-y-4">
      {!hasProgressionLinks ? (
        <p className="text-white/40 text-xs leading-relaxed rounded-lg border border-white/10 bg-white/4 px-3 py-2">
          Progression will be shown automatically when bracket links are available.
        </p>
      ) : null}

      <div className="space-y-3">
        {rounds.map((round, idx) => (
          <div key={round.collection.id}>
            {idx > 0 ? (
              <div className="flex justify-center py-1.5" aria-hidden>
                <span className="text-white/25 text-xs">↓</span>
              </div>
            ) : null}
            <div className={cn(hubCardClass, "p-4 space-y-2")}>
              <p className="text-white/45 text-[10px] font-bold uppercase tracking-widest">
                {round.collection.roundName}
              </p>
              {round.fixtures.length === 0 ? (
                <p className="text-white/30 text-sm">No fixtures in this round.</p>
              ) : (
                <ul className="space-y-2">
                  {round.fixtures.map((row) => (
                    <li
                      key={row.fixture.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-white/6 pt-2 first:border-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="text-white/85 truncate">{row.label}</p>
                        {row.winner ? (
                          <p className="text-emerald-400/90 text-xs mt-0.5">
                            Winner: {row.winner}
                          </p>
                        ) : (
                          <p className="text-white/30 text-xs mt-0.5 capitalize">
                            {row.fixture.status.replace(/_/g, " ")}
                          </p>
                        )}
                      </div>
                      {row.resultLine ? (
                        <span className="text-white/50 font-mono text-xs flex-none">
                          {row.resultLine}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
