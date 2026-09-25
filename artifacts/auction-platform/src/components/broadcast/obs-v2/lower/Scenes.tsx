import type {
  AuctionSceneModel,
  BreakSceneModel,
  SoldSceneModel,
  SponsorLogo,
  SummaryModel,
  TeamModel,
  Top5Model,
  UnsoldSceneModel,
  WaitingSceneModel,
} from "../contracts";
import { formatAmount } from "../format";
import { AnimatedValue, Avatar, Crest } from "../primitives";

export function WaitingScene({ model }: { model: WaitingSceneModel }) {
  return (
    <div className="bw-lt-row">
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

export function AuctionScene({ model }: { model: AuctionSceneModel }) {
  const { player } = model;
  return (
    <div className="bw-lt-row">
      <div className="bw-seg bw-seg-player">
        <Avatar name={player.name} photoUrl={player.photoUrl} />
        <div className="bw-stack">
          <span className="bw-kicker">{player.category ?? "ON THE BLOCK"}</span>
          <strong className="bw-headline">{player.name}</strong>
          <small className="bw-sub">{player.role}</small>
        </div>
      </div>
      <div className="bw-seg bw-stat">
        <span className="bw-kicker">BASE</span>
        <strong>{formatAmount(player.basePrice)}</strong>
      </div>
      <div className="bw-seg bw-stat bw-stat-hero">
        <span className="bw-kicker bw-gold">CURRENT BID</span>
        <strong className="bw-bid">
          <AnimatedValue value={formatAmount(model.currentBid)} />
        </strong>
      </div>
      <div className="bw-seg bw-seg-lead">
        {model.leadingTeam ? (
          <div key={model.leadingTeam.teamId} className="bw-lead-inner">
            <Crest text={model.leadingTeam.short} logoUrl={model.leadingTeam.logoUrl} size={60} />
            <div className="bw-stack">
              <span className="bw-kicker bw-cyan">LEADING</span>
              <strong>{model.leadingTeam.name}</strong>
              <small className="bw-sub">Purse {formatAmount(model.leadingTeam.purseRemaining)}</small>
            </div>
          </div>
        ) : (
          <span className="bw-sub">AWAITING OPENING BID</span>
        )}
      </div>
      <div className="bw-seg bw-stat">
        <span className="bw-kicker">{model.timerSeconds !== undefined ? "TIMER" : "BIDS"}</span>
        <strong>
          <AnimatedValue value={model.timerSeconds !== undefined ? `${model.timerSeconds}s` : model.bidCount} />
        </strong>
      </div>
    </div>
  );
}

export function SoldScene({ model }: { model: SoldSceneModel }) {
  return (
    <div className="bw-lt-row">
      <div className="bw-seg bw-seg-player">
        <Avatar name={model.player.name} photoUrl={model.player.photoUrl} />
        <div className="bw-stack">
          <span className="bw-kicker">{model.player.role}</span>
          <strong className="bw-headline">{model.player.name}</strong>
        </div>
      </div>
      <div className="bw-seg bw-seg-grow bw-center">
        <span className="bw-stamp" data-tone="gold">SOLD</span>
        <strong className="bw-bid bw-gold">{formatAmount(model.soldPrice)}</strong>
      </div>
      <div className="bw-seg bw-seg-lead">
        <div className="bw-lead-inner">
          <Crest text={model.team.short} logoUrl={model.team.logoUrl} size={60} />
          <div className="bw-stack">
            <span className="bw-kicker bw-cyan">TO</span>
            <strong>{model.team.name}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UnsoldScene({ model }: { model: UnsoldSceneModel }) {
  return (
    <div className="bw-lt-row" data-muted>
      <div className="bw-seg bw-seg-player">
        <Avatar name={model.player.name} photoUrl={model.player.photoUrl} />
        <div className="bw-stack">
          <span className="bw-kicker">{model.player.role}</span>
          <strong className="bw-headline">{model.player.name}</strong>
        </div>
      </div>
      <div className="bw-seg bw-seg-grow bw-center">
        <span className="bw-stamp" data-tone="muted">UNSOLD</span>
        <small className="bw-sub">Base {formatAmount(model.player.basePrice)}</small>
      </div>
    </div>
  );
}

export function BreakScene({ model, sponsor }: { model: BreakSceneModel; sponsor?: SponsorLogo | undefined }) {
  return (
    <div className="bw-lt-row">
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
    <div className="bw-lt-row">
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

export function Top5Scene({ model }: { model: Top5Model }) {
  return (
    <div className="bw-lt-row">
      <div className="bw-seg bw-seg-title">
        <span className="bw-kicker bw-gold">TOP 5</span>
        <strong className="bw-headline">{model.title}</strong>
      </div>
      {model.entries.slice(0, 5).map((e, i) => (
        <div key={e.rank} className="bw-seg bw-top5 bw-stagger" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="bw-rank">{e.rank}</span>
          <div className="bw-stack">
            <strong>{e.playerName}</strong>
            <small className="bw-sub">
              {e.role} · {e.teamShort}
            </small>
            <span className="bw-gold bw-price">{formatAmount(e.price)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeamScene({ model }: { model: TeamModel }) {
  const { team } = model;
  return (
    <div className="bw-lt-row">
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
      <div className="bw-seg bw-seg-grow bw-squad">
        {model.squad.slice(0, 10).map((p, i) => (
          <span key={p.name} className="bw-squad-chip bw-stagger" style={{ animationDelay: `${i * 50}ms` }}>
            <b>{p.name}</b>
            <small>
              {p.role} · {formatAmount(p.price)}
            </small>
          </span>
        ))}
      </div>
      <div className="bw-seg bw-stat">
        <span className="bw-kicker bw-gold">PURSE LEFT</span>
        <strong>{formatAmount(team.purseRemaining)}</strong>
      </div>
    </div>
  );
}
