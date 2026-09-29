import { AnimatePresence, motion } from "framer-motion";
import type { BallEvent, BatterLine, BowlerLine, CricketScoreModel } from "../contracts";
import { economy, strikeRate } from "../format";
import { AnimatedValue, Crest } from "../primitives";
import { OBS_V2 } from "../obs-v2-tokens";

export function TeamScorePanel({ model }: { model: CricketScoreModel }) {
  const rawOvers = String(model.overs || "0.0");
  let cleanOvers = rawOvers.includes("/") ? rawOvers.split("/")[0].trim() : rawOvers.replace(/OV/i, "").trim();
  const parts = cleanOvers.split(".");
  if (parts.length === 2) {
    const o = parseInt(parts[0], 10) || 0;
    const b = parseInt(parts[1], 10) || 0;
    if (b >= 6) {
      const full = o + Math.floor(b / 6);
      const rem = b % 6;
      cleanOvers = rem > 0 ? `${full}.${rem}` : `${full}`;
    }
  }

  return (
    <div className="bw-teamscore">
      <Crest text={model.battingTeam.short} logoUrl={model.battingTeam.logoUrl} size={74} />
      <div className="bw-ts-id">
        <strong>{model.battingTeam.short}</strong>
        <span>V {model.bowlingTeamShort}</span>
      </div>
      <div className="bw-ts-score">
        <div className="bw-ts-big">
          <AnimatedValue value={model.runs} />
          <em>-</em>
          <AnimatedValue value={model.wickets} className="bw-gold" />
        </div>
        <div className="bw-ts-overs">
          <AnimatedValue value={cleanOvers} className="bw-gold" /> OVER{" "}
          <small style={{ fontSize: "18px", color: "var(--bw-ink-dim)", letterSpacing: "0.05em", fontWeight: 700 }}>
            ({model.maxOvers} OVER)
          </small>
        </div>
        {model.crr != null && model.crr > 0 && (
          <div
            className="bw-ts-crr"
            style={{
              fontSize: "17px",
              color: "var(--bw-cyan)",
              letterSpacing: "0.08em",
              fontWeight: 800,
              fontFamily: "var(--bw-font-mono)",
              lineHeight: 1.1,
              marginTop: "4px",
              whiteSpace: "nowrap",
            }}
          >
            CRR {model.crr.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

function BatterRow({ b }: { b: BatterLine }) {
  const isLong = b.name.length > 16;
  const fontSize = b.name.length > 22 ? 22 : isLong ? 25 : undefined;

  return (
    <div className="bw-batter" data-strike={b.onStrike}>
      <i className="bw-strike-mark" />
      <span className="bw-bname" style={fontSize ? { fontSize } : undefined}>{b.name}</span>
      <span className="bw-bruns">
        <AnimatedValue value={b.runs} /> <small>({b.balls}b)</small>
      </span>
      <span className="bw-bsr">
        <small>SR</small> {strikeRate(b.runs, b.balls)}
      </span>
    </div>
  );
}

export function BatterPanel({ striker, nonStriker }: { striker: BatterLine; nonStriker: BatterLine }) {
  // Striker always listed first; key by name so striker changes animate.
  const rows = striker.onStrike ? [striker, nonStriker] : [nonStriker, striker];
  return (
    <div className="bw-batters">
      {rows.map((b) => (
        <BatterRow key={b.name} b={b} />
      ))}
    </div>
  );
}

export function BowlerPanel({ bowler }: { bowler: BowlerLine }) {
  const isLong = bowler.name.length > 13;
  const fontSize = bowler.name.length > 20 ? 22 : isLong ? 25 : undefined;

  return (
    <div className="bw-bowler" key={bowler.name}>
      <span className="bw-cyan-label">BOWL</span>
      <span className="bw-bowl-name" style={fontSize ? { fontSize } : undefined}>{bowler.name}</span>
      <span className="bw-bowl-fig">
        <AnimatedValue value={`${bowler.wickets}-${bowler.runs}`} className="bw-gold" />
        <small>({bowler.overs} ov)</small>
      </span>
      <span className="bw-bowl-econ">
        <small>ECON</small> {economy(bowler.runs, bowler.overs)}
      </span>
    </div>
  );
}

export function CurrentOverPanel({ balls }: { balls: BallEvent[] }) {
  return (
    <div className="bw-over">
      <span className="bw-over-label">THIS OVER</span>
      <div className="bw-balls">
        {balls.map((b, i) => (
          <span key={`${i}-${b.label}`} className="bw-ball" data-kind={b.kind} data-latest={i === balls.length - 1}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ResultPanel({ result }: { result?: CricketScoreModel["result"] }) {
  if (!result) return <div className="bw-result" />;

  const headline = result.headline || "";
  const len = headline.length;
  const headlineFontSize =
    len > 28 ? "17px" : len > 22 ? "20px" : len > 17 ? "23px" : len > 12 ? "26px" : "32px";

  return (
    <div className="bw-result">
      <div key={result.headline} className="bw-result-inner">
        <span className="bw-result-kicker">{result.kicker || "MATCH RESULT"}</span>
        <strong
          style={{
            fontSize: headlineFontSize,
            lineHeight: 1.15,
            maxWidth: "100%",
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
          title={headline}
        >
          {headline}
        </strong>
        {result.detail && (
          <small
            style={{
              fontSize: len > 20 ? "16px" : "18px",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
            title={result.detail}
          >
            {result.detail}
          </small>
        )}
      </div>
    </div>
  );
}

/**
 * Extended stats panel — shows in the result/status area when no result,
 * displaying chase equation (NEED X OFF Y), RRR, partnership, and special indicators.
 */
function ExtendedStatsPanel({ model }: { model: CricketScoreModel }) {
  if (model.result) return null;

  const hasChaseInfo = model.needRuns != null && model.ballsRemaining != null;
  const hasRrr = model.rrr != null && model.rrr > 0;
  const hasPartnership = Boolean(model.partnership);

  if (!hasChaseInfo && !hasRrr && !hasPartnership && !model.freeHitActive && !model.superBallActive) {
    return null;
  }

  return (
    <div
      className="bw-result"
      style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}
    >
      {/* Chase equation — dominant when in chase */}
      {hasChaseInfo && (
        <div
          style={{
            fontSize: 18,
            fontFamily: OBS_V2.typography.family.mono,
            color: OBS_V2.color.brand,
            fontWeight: 800,
            letterSpacing: "0.04em",
            lineHeight: 1.1,
          }}
        >
          NEED {model.needRuns} OFF {model.ballsRemaining}
        </div>
      )}

      {/* RRR */}
      {hasRrr && (
        <div
          style={{
            fontSize: 16,
            fontFamily: OBS_V2.typography.family.mono,
            color: OBS_V2.color.textSecondary,
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          <span style={{ color: OBS_V2.color.textMuted }}>RRR </span>
          <span style={{ color: OBS_V2.color.warning }}>{(model.rrr ?? 0).toFixed(2)}</span>
        </div>
      )}

      {/* Partnership */}
      {hasPartnership && (
        <div
          style={{
            fontSize: 15,
            fontFamily: OBS_V2.typography.family.body,
            color: OBS_V2.color.textMuted,
            letterSpacing: "0.04em",
            fontWeight: 600,
          }}
        >
          {model.partnership}
        </div>
      )}

      {/* Special indicators */}
      {model.freeHitActive && (
        <div
          style={{
            fontSize: 16,
            fontFamily: OBS_V2.typography.family.body,
            color: OBS_V2.color.info,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          ⚡ FREE HIT
        </div>
      )}
      {model.superBallActive && (
        <div
          style={{
            fontSize: 16,
            fontFamily: OBS_V2.typography.family.body,
            color: OBS_V2.color.brand,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          ★ SUPERBALL 2×
        </div>
      )}
    </div>
  );
}

/** Composition of the cricket lower third. Each child is independently mountable. */
export function CricketScorebar({ model }: { model: CricketScoreModel }) {
  const showExtendedStats = !model.result && (
    model.needRuns != null ||
    (model.rrr != null && model.rrr > 0) ||
    model.partnership != null ||
    model.freeHitActive ||
    model.superBallActive
  );

  return (
    <div className="bw-lt-row bw-cricket">
      <div className="bw-seg bw-seg-team">
        <TeamScorePanel model={model} />
      </div>
      <div className="bw-seg bw-seg-bat">
        <BatterPanel striker={model.striker} nonStriker={model.nonStriker} />
      </div>
      <div className="bw-seg bw-seg-bowl">
        <BowlerPanel bowler={model.bowler} />
        <CurrentOverPanel balls={model.thisOver} />
      </div>
      <div className="bw-seg bw-seg-result">
        {showExtendedStats ? (
          <ExtendedStatsPanel model={model} />
        ) : (
          <ResultPanel result={model.result} />
        )}
      </div>
    </div>
  );
}
