import { useEffect, useState } from "react";
import type {
  AuctionSceneModel,
  BreakSceneModel,
  SoldSceneModel,
  SponsorLogo,
  SummaryModel,
  TeamModel,
  TeamPurse,
  Top5Model,
  UnsoldSceneModel,
  WaitingSceneModel,
} from "../contracts";
import { formatAmount } from "../format";
import { Avatar, Crest } from "../primitives";

export function WaitingScene({ model }: { model: WaitingSceneModel }) {
  return (
    <div className="bw-lt-row bw-lt-solid">
      <div className="bw-seg bw-seg-grow bw-center">
        <span className="bw-pulse-dot" />
        <div className="bw-stack">
          <span className="bw-kicker">STANDBY</span>
          <strong className="bw-headline">{model.headline}</strong>
          {model.subline && <small className="bw-sub">{model.subline}</small>}
        </div>
      </div>
    </div>
  );
}

function getHeadlinePlayerFontSize(name: string): string {
  const len = (name || "").trim().length;
  if (len <= 14) return "44px";
  if (len <= 18) return "36px";
  if (len <= 22) return "30px";
  if (len <= 26) return "25px";
  return "21px";
}

/** Natural letterforms. Shrinks only when the words would run past the given share of the bar. */
function prizeLineSize(text: string, maxPx: number, widthRatio: number): number {
  const len = Math.max(text.trim().length, 1);
  const fit = (1920 * widthRatio) / (len * 0.55);
  return Math.round(Math.min(maxPx, fit));
}

export function PrizePlate({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <div className="bw-lt-row bw-lt-solid bw-prize-plate" data-prize-plate="">
      <div className="bw-prize-copy">
        <div className="bw-prize-title-row">
          <span className="bw-prize-rule" aria-hidden />
          <strong className="bw-prize-line1" style={{ fontSize: `${prizeLineSize(line1, 104, 0.56)}px` }}>
            {line1}
          </strong>
          <span className="bw-prize-rule" aria-hidden />
        </div>
        <span className="bw-prize-line2" style={{ fontSize: `${prizeLineSize(line2, 34, 0.7)}px` }} title={line2}>
          {line2}
        </span>
      </div>
    </div>
  );
}

export function AuctionScene({ model }: { model: AuctionSceneModel }) {
  const { player } = model;
  return (
    <div className="bw-lt-row bw-lt-solid">
      <div className="bw-seg bw-seg-player">
        <Avatar name={player.name} photoUrl={player.photoUrl} />
        <div className="bw-stack" style={{ minWidth: 0, flex: 1 }}>
          <span className="bw-kicker">{player.category ?? "ON THE BLOCK"}</span>
          <strong
            className="bw-headline"
            style={{
              fontSize: getHeadlinePlayerFontSize(player.name),
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
            title={player.name}
          >
            {player.name}
          </strong>
          <small className="bw-sub">
            {player.role}
            {player.basePrice ? ` · Base ${formatAmount(player.basePrice)}` : ""}
          </small>
        </div>
      </div>
      <div className="bw-seg bw-stat bw-stat-hero bw-seg-bid">
        <span className="bw-kicker bw-gold">CURRENT BID</span>
        <strong className="bw-bid">{formatAmount(model.currentBid)}</strong>
        <small className="bw-sub">{model.bidCount} bids</small>
      </div>
      <div className="bw-seg bw-seg-lead">
        {model.leadingTeam ? (
          <div key={model.leadingTeam.teamId} className="bw-lead-inner">
            <Crest text={model.leadingTeam.short} logoUrl={model.leadingTeam.logoUrl} size={60} />
            <div className="bw-stack">
              <span className="bw-kicker bw-cyan">LEADING</span>
              <strong>{model.leadingTeam.name}</strong>
              <small className="bw-sub">
                Purse {formatAmount(model.leadingTeam.purseRemaining)}
                {model.timerSeconds !== undefined ? ` · ${model.timerSeconds}s` : ""}
              </small>
            </div>
          </div>
        ) : (
          <div className="bw-stack">
            <span className="bw-kicker">LEADING</span>
            <strong className="bw-sub">Awaiting opening bid</strong>
            {model.timerSeconds !== undefined && <small className="bw-sub">{model.timerSeconds}s</small>}
          </div>
        )}
      </div>
    </div>
  );
}

export function SoldScene({ model, teams = [] }: { model: SoldSceneModel; teams?: TeamPurse[] }) {
  const roster = teams.length ? teams : [model.team];
  return (
    <div className="bw-lt-row bw-lt-solid">
      <div className="bw-seg bw-seg-player">
        <Avatar name={model.player.name} photoUrl={model.player.photoUrl} />
        <div className="bw-stack" style={{ minWidth: 0, flex: 1 }}>
          <span className="bw-kicker">{model.player.role}</span>
          <strong
            className="bw-headline"
            style={{
              fontSize: getHeadlinePlayerFontSize(model.player.name),
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
            title={model.player.name}
          >
            {model.player.name}
          </strong>
          {model.player.detail ? <small className="bw-sub">{model.player.detail}</small> : null}
        </div>
      </div>
      <div className="bw-seg bw-seg-grow bw-sold-block">
        <div className="bw-sold-line">
          <span className="bw-sold-kicker">SOLD AT</span>
          <strong className="bw-sold-amount">{formatAmount(model.soldPrice)}</strong>
        </div>
        <span className="bw-sold-team">{model.team.name}</span>
      </div>
      <div className="bw-seg bw-seg-lead">
        <TeamPurseLoop teams={roster} />
      </div>
    </div>
  );
}

function TeamPurseLoop({ teams }: { teams: TeamPurse[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [teams.length]);

  useEffect(() => {
    if (teams.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % teams.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, [teams.length]);

  const team = teams[index % teams.length];
  if (!team) return null;
  const squadSize = team.slotsRemaining;
  const squad = squadSize > 0 ? `${team.playersBought}/${squadSize}` : String(team.playersBought);

  return (
    <div key={team.teamId} className="bw-team-loop">
      <Crest text={team.short} logoUrl={team.logoUrl} size={58} />
      <div className="bw-stack">
        <strong>{team.name}</strong>
        <small className="bw-sub">Squad {squad}</small>
        <small className="bw-sub bw-gold">{formatAmount(team.purseRemaining)} available</small>
      </div>
    </div>
  );
}

export function UnsoldScene({ model }: { model: UnsoldSceneModel }) {
  return (
    <div className="bw-lt-row bw-lt-solid" data-muted>
      <div className="bw-seg bw-seg-player">
        <Avatar name={model.player.name} photoUrl={model.player.photoUrl} />
        <div className="bw-stack" style={{ minWidth: 0, flex: 1 }}>
          <span className="bw-kicker">{model.player.role}</span>
          <strong
            className="bw-headline"
            style={{
              fontSize: getHeadlinePlayerFontSize(model.player.name),
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
            title={model.player.name}
          >
            {model.player.name}
          </strong>
        </div>
      </div>
      <div className="bw-seg bw-seg-grow bw-center">
        <span className="bw-stamp" data-tone="muted">UNSOLD</span>
      </div>
      <div className="bw-seg bw-stat bw-seg-purse">
        <span className="bw-kicker">BASE</span>
        <strong>{formatAmount(model.player.basePrice)}</strong>
      </div>
    </div>
  );
}

export function BreakScene({ model, sponsor }: { model: BreakSceneModel; sponsor?: SponsorLogo | undefined }) {
  return (
    <div className="bw-lt-row bw-lt-solid">
      <div className="bw-seg bw-seg-grow bw-center">
        <div className="bw-stack bw-center-text">
          <span className="bw-kicker bw-gold">{model.subline ?? "BREAK"}</span>
          <strong className="bw-headline bw-xl">{model.headline}</strong>
        </div>
      </div>
      {sponsor && (
        <div className="bw-seg bw-seg-result">
          <div className="bw-result-inner">
            <span className="bw-result-kicker">BROUGHT TO YOU BY</span>
            <strong>{sponsor.name}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export function SummaryScene({ model }: { model: SummaryModel }) {
  const stats = [
    { k: "PLAYERS SOLD", v: String(model.totalSold) },
    { k: "UNSOLD", v: String(model.totalUnsold) },
    { k: "TOTAL SPENT", v: formatAmount(model.totalSpent) },
  ];
  return (
    <div className="bw-lt-row bw-lt-solid">
      <div className="bw-seg bw-seg-title">
        <span className="bw-kicker bw-gold">AUCTION</span>
        <strong className="bw-headline">SUMMARY</strong>
      </div>
      {stats.map((s, i) => (
        <div key={s.k} className="bw-seg bw-stat bw-stagger" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="bw-kicker">{s.k}</span>
          <strong>{s.v}</strong>
        </div>
      ))}
      {model.highest && (
        <div className="bw-seg bw-seg-result bw-stagger" style={{ animationDelay: "300ms" }}>
          <div className="bw-result-inner">
            <span className="bw-result-kicker">HIGHEST BID</span>
            <strong>{model.highest.playerName}</strong>
            <small>
              {formatAmount(model.highest.price)} · {model.highest.teamShort}
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

function top5Subtitle(entry: Top5Model["entries"][number], count: number): string {
  const team = (entry.teamName || entry.teamShort || "").trim();
  const role = entry.role.trim();
  const namedRole = role && role.toLowerCase() !== "player" ? role : "";
  if (count <= 3 && namedRole && team) return `${namedRole} · ${team}`;
  return team || namedRole;
}

export function Top5Scene({ model }: { model: Top5Model }) {
  const entries = model.entries.slice(0, 5);
  return (
    <div className="bw-lt-row bw-lt-solid bw-top5-row">
      <div className="bw-top5-brand">
        <span className="bw-kicker bw-gold">TOP 5</span>
        <strong>
          HIGHEST
          <br />
          SOLD
        </strong>
      </div>
      {entries.length === 0 ? (
        <div className="bw-top5-empty">
          <span className="bw-kicker">NO SALES YET</span>
        </div>
      ) : (
        <div className="bw-top5-rail" data-count={entries.length}>
          {entries.map((e, i) => (
            <article
              key={e.rank}
              className="bw-top5-card bw-stagger"
              data-rank={e.rank}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="bw-top5-medal">{e.rank}</span>
              <div className="bw-top5-copy">
                <strong title={e.playerName}>{e.playerName}</strong>
                <small>{top5Subtitle(e, entries.length)}</small>
              </div>
              <span className="bw-top5-price">{formatAmount(e.price)}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamScene({ model }: { model: TeamModel }) {
  const { team } = model;
  return (
    <div className="bw-lt-row bw-lt-solid">
      <div className="bw-seg bw-seg-player">
        <Crest text={team.short} logoUrl={team.logoUrl} size={78} />
        <div className="bw-stack">
          <span className="bw-kicker bw-cyan">SQUAD</span>
          <strong className="bw-headline">{team.name}</strong>
          <small className="bw-sub">
            {team.playersBought} bought · {team.slotsRemaining} slots left
          </small>
        </div>
      </div>
      <div className="bw-seg bw-seg-grow bw-squad-row">
        {model.squad.slice(0, 6).map((p, i) => (
          <span key={`${p.name}-${i}`} className="bw-squad-chip bw-stagger" style={{ animationDelay: `${i * 40}ms` }}>
            <b>{p.name}</b>
            <small>
              {p.role} · {formatAmount(p.price)}
            </small>
          </span>
        ))}
      </div>
      <div className="bw-seg bw-stat bw-seg-purse">
        <span className="bw-kicker bw-gold">PURSE LEFT</span>
        <strong>{formatAmount(team.purseRemaining)}</strong>
      </div>
    </div>
  );
}
