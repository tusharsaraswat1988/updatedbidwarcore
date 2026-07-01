import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getLedPlayerFilterStatusLabel,
  type LedPlayer,
  type LedTeam,
  type LedPurseBoosterOverlayView,
  type LivePlayerFilter,
} from "@/lib/led-view/types";
import {
  LED_HEADLINE_CLASS,
  LED_META_LABEL_CLASS,
  LED_PLAYER_NAME_CLASS,
  LED_SECTION_KICKER_CLASS,
  LED_STAGE_FONT_CLASS,
} from "@/lib/led-display-typography";
import { formatAuctionAmount, normalizeAuctionUnit } from "@workspace/api-base/auction-unit";
import { cldUrl } from "@/lib/cloudinary";
import { EyesMascot } from "./EyesMascot";

const GRID_COLS = 3;
const PAGE_INTERVAL_MS = 10_000;
const MIN_CARD_HEIGHT_PX = 68;
const MAX_CARD_HEIGHT_PX = 96;
function computeGridLayout(gridHeight: number) {
  const height = Math.max(120, gridHeight);
  const gapPx = Math.round(Math.max(10, height * 0.018));
  const cardHeight = Math.round(
    Math.max(MIN_CARD_HEIGHT_PX, Math.min(MAX_CARD_HEIGHT_PX, height * 0.115)),
  );
  const rows = Math.max(1, Math.floor((height + gapPx) / (cardHeight + gapPx)));
  return { rows, pageSize: rows * GRID_COLS, gapPx };
}

type PlayerDirectoryOverlayProps = {
  players: LedPlayer[];
  teams: LedTeam[];
  totalPlayers: number;
  playerFilterLabel: string;
  displayPlayerFilter: LivePlayerFilter | null;
  currentPlayerId: string | null;
  auctionUnit: ReturnType<typeof normalizeAuctionUnit>;
  purseBoosterOverlay: LedPurseBoosterOverlayView | null;
};

type DirectoryHeader = {
  kicker: string;
  headline: string;
  headlineColor?: string;
  subheadline?: string;
  subheadlineColor?: string;
};

/** Fixed LED headline size — same visual weight on every filter page. */
const DIRECTORY_HEADLINE_STYLE = {
  fontSize: "clamp(2.25rem, 4.25vw, 3.25rem)",
  lineHeight: 1,
  minHeight: "clamp(2.25rem, 4.25vw, 3.25rem)",
} as const;

const DIRECTORY_SUBHEADLINE_STYLE = {
  fontSize: "clamp(1.2rem, 2.1vw, 1.65rem)",
  lineHeight: 1.1,
} as const;

function resolveDirectoryHeader(
  filter: LivePlayerFilter | null,
  playerFilterLabel: string,
  teams: LedTeam[],
): DirectoryHeader {
  if (playerFilterLabel === "All Players") {
    return { kicker: "Player Directory", headline: "All Players" };
  }

  const team = filter?.teamId
    ? teams.find((t) => String(t.id) === String(filter.teamId))
    : undefined;

  const statusLabel = getLedPlayerFilterStatusLabel(filter?.status);

  if (team && statusLabel) {
    return {
      kicker: "Player Directory",
      headline: statusLabel,
      subheadline: team.name,
      subheadlineColor: team.color,
    };
  }

  if (team) {
    return {
      kicker: "Team Roster",
      headline: team.name,
      headlineColor: team.color,
    };
  }

  return {
    kicker: "Player Directory",
    headline: playerFilterLabel,
  };
}

type StatusTheme = {
  accent: string;
  bg: string;
};

function getStatusTheme(status: LedPlayer["status"]): StatusTheme {
  switch (status) {
    case "sold":
      return { accent: "#22C55E", bg: "rgba(34,197,94,0.08)" };
    case "retained":
      return { accent: "#A855F7", bg: "rgba(168,85,247,0.08)" };
    case "unsold":
      return { accent: "#EF4444", bg: "rgba(239,68,68,0.08)" };
    case "live":
      return { accent: "var(--accent)", bg: "rgba(255,255,255,0.06)" };
    default:
      return { accent: "rgba(255,255,255,0.22)", bg: "rgba(255,255,255,0.03)" };
  }
}

const PLAYER_STATUS_LABELS: Record<LedPlayer["status"], string> = {
  queue: "Available",
  live: "Live",
  sold: "Sold",
  unsold: "Unsold",
  retained: "Retained",
};

function PlayerDirectoryCard({
  player,
  team,
  auctionUnit,
}: {
  player: LedPlayer;
  team: LedTeam | undefined;
  auctionUnit: ReturnType<typeof normalizeAuctionUnit>;
}) {
  const theme = getStatusTheme(player.status);
  const isSold = player.status === "sold";
  const isRetained = player.status === "retained";
  const showAmount = (isSold || isRetained) && player.soldPrice != null;
  const priceLabel = showAmount
    ? formatAuctionAmount(player.soldPrice!, auctionUnit)
    : null;
  const statusLabel = PLAYER_STATUS_LABELS[player.status];

  return (
    <article
      className="relative flex items-center gap-[0.75em] min-h-0 min-w-0 rounded-sm overflow-hidden px-[0.65em] py-[0.45em]"
      style={{
        backgroundColor: theme.bg,
        boxShadow: `inset 4px 0 0 ${theme.accent}`,
      }}
    >
      {player.portrait ? (
        <img
          src={cldUrl(player.portrait, "thumbnail")}
          alt=""
          className="shrink-0 object-cover rounded-sm border border-white/15"
          style={{ width: "clamp(3rem, 5vw, 4.25rem)", height: "clamp(3rem, 5vw, 4.25rem)" }}
        />
      ) : (
        <div
          className="shrink-0 rounded-sm bg-white/[0.06] border border-white/10"
          style={{ width: "clamp(3rem, 5vw, 4.25rem)", height: "clamp(3rem, 5vw, 4.25rem)" }}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-[0.2em]">
        <p
          className={`${LED_PLAYER_NAME_CLASS} truncate text-white`}
          style={{ fontSize: "clamp(1.05rem, 1.85vw, 1.55rem)" }}
        >
          {player.name}
        </p>

        {(isSold || isRetained) && priceLabel ? (
          <p
            className="flex items-baseline gap-[0.45em] min-w-0 truncate leading-none"
            style={{ color: theme.accent }}
          >
            <span
              className="font-['Barlow_Condensed'] font-semibold uppercase shrink-0 tracking-[0.12em]"
              style={{ fontSize: "clamp(0.78rem, 1.15vw, 1.05rem)" }}
            >
              {isRetained ? "Retained at" : "Sold at"} –
            </span>
            <span
              className="font-['Bebas_Neue'] tabular-nums tracking-tight truncate"
              style={{ fontSize: "clamp(1.15rem, 2vw, 1.65rem)" }}
            >
              {priceLabel}
            </span>
          </p>
        ) : (
          <p
            className="font-['Barlow_Condensed'] font-semibold uppercase truncate leading-none tracking-[0.14em]"
            style={{ color: theme.accent, fontSize: "clamp(0.82rem, 1.2vw, 1.08rem)" }}
          >
            {statusLabel}
          </p>
        )}

        {(isSold || isRetained) && team ? (
          <p
            className="font-['Barlow_Condensed'] font-semibold uppercase truncate leading-tight text-white/55"
            style={{ fontSize: "clamp(0.72rem, 1.05vw, 0.95rem)", letterSpacing: "0.06em" }}
          >
            {team.name}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export const PlayerDirectoryOverlay = memo(function PlayerDirectoryOverlay({
  players,
  teams,
  totalPlayers,
  playerFilterLabel,
  displayPlayerFilter,
  currentPlayerId,
  auctionUnit,
  purseBoosterOverlay,
}: PlayerDirectoryOverlayProps) {
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(() => computeGridLayout(480));
  const [pageIndex, setPageIndex] = useState(0);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const totalPages = Math.max(1, Math.ceil(players.length / layout.pageSize));

  const activePlayerIndex = useMemo(() => {
    if (!currentPlayerId) return -1;
    return players.findIndex((p) => p.id === currentPlayerId);
  }, [players, currentPlayerId]);

  const activePlayerPage =
    activePlayerIndex >= 0 ? Math.floor(activePlayerIndex / layout.pageSize) : null;

  const clampPage = useCallback(
    (index: number) => Math.max(0, Math.min(index, totalPages - 1)),
    [totalPages],
  );

  useEffect(() => {
    const el = gridAreaRef.current;
    if (!el) return;

    const measure = () => {
      setLayout(computeGridLayout(el.clientHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPageIndex((prev) => clampPage(prev));
  }, [totalPages, layout.pageSize, clampPage]);

  useEffect(() => {
    if (activePlayerPage == null) return;
    setPageIndex(activePlayerPage);
  }, [activePlayerPage, currentPlayerId]);

  const isPaused = purseBoosterOverlay != null;

  useEffect(() => {
    if (isPaused || totalPages <= 1 || activePlayerPage != null) return;

    const id = window.setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, PAGE_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [isPaused, totalPages, pageIndex, activePlayerPage]);

  const pagePlayers = useMemo(() => {
    const start = pageIndex * layout.pageSize;
    return players.slice(start, start + layout.pageSize);
  }, [players, pageIndex, layout.pageSize]);

  const rangeStart = players.length === 0 ? 0 : pageIndex * layout.pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * layout.pageSize, players.length);
  const header = useMemo(
    () => resolveDirectoryHeader(displayPlayerFilter, playerFilterLabel, teams),
    [displayPlayerFilter, playerFilterLabel, teams],
  );

  useEffect(() => {
    setPageIndex(0);
  }, [playerFilterLabel, displayPlayerFilter?.status, displayPlayerFilter?.teamId, displayPlayerFilter?.categoryId]);

  return (
    <div className={`absolute inset-0 z-30 bg-black/95 overflow-hidden ${LED_STAGE_FONT_CLASS}`}>
      <div className="absolute inset-0 p-[2%] flex flex-col min-h-0">
        <header className="flex items-end justify-between shrink-0 mb-[1.2%]">
          <div className="min-w-0">
            <p className={`${LED_SECTION_KICKER_CLASS} text-white/55`}>{header.kicker}</p>
            <p
              className={`${LED_HEADLINE_CLASS} tracking-widest leading-none mt-0.5 line-clamp-2`}
              style={{
                ...DIRECTORY_HEADLINE_STYLE,
                color: header.headlineColor ?? "var(--accent)",
              }}
            >
              {header.headline}
            </p>
            {header.subheadline ? (
              <p
                className={`${LED_HEADLINE_CLASS} tracking-widest leading-none mt-0.5 line-clamp-2`}
                style={{
                  ...DIRECTORY_SUBHEADLINE_STYLE,
                  color: header.subheadlineColor ?? "var(--accent)",
                }}
              >
                {header.subheadline}
              </p>
            ) : null}
            {players.length > 0 ? (
              <p className={`${LED_META_LABEL_CLASS} text-white/40 mt-1`}>
                {players.length} player{players.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          <div className="text-right shrink-0 pl-[2%]">
            {players.length > 0 ? (
              <>
                <p className={`${LED_META_LABEL_CLASS} text-white/55 leading-relaxed`}>
                  {rangeStart}–{rangeEnd} of {players.length}
                </p>
                <p className={`${LED_META_LABEL_CLASS} text-white/75 mt-0.5`}>
                  {pageIndex + 1} / {totalPages}
                </p>
              </>
            ) : (
              <p className={`${LED_META_LABEL_CLASS} text-white/50`}>
                0 / {totalPlayers}
              </p>
            )}
          </div>
        </header>

        <div ref={gridAreaRef} className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pageIndex}
              className="absolute inset-0"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                gap: `${layout.gapPx}px`,
              }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              {pagePlayers.map((player) => (
                <PlayerDirectoryCard
                  key={player.id}
                  player={player}
                  team={player.soldToTeamId ? teamById.get(player.soldToTeamId) : undefined}
                  auctionUnit={auctionUnit}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {players.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1.4em]">
              <div
                className="pointer-events-none"
                style={{ transform: "scale(3.5)", transformOrigin: "center" }}
              >
                <EyesMascot idle />
              </div>
              <p className={`${LED_META_LABEL_CLASS} text-white/40`}>No players match this filter</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
