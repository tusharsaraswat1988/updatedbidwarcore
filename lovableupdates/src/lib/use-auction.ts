import { useCallback, useEffect, useMemo, useReducer } from "react";
import { PLAYERS, TEAMS, nextIncrement, type Player, type Team } from "./auction-data";

interface ActionLog {
  id: string;
  ts: number;
  type: "BID" | "SOLD" | "UNSOLD" | "DEFER" | "START" | "RESET";
  amount?: number;
  teamId?: string;
  playerId?: string;
  message: string;
}

export interface AuctionState {
  players: Player[];
  teams: Team[];
  currentPlayerId: string | null;
  currentBid: number;
  leadingTeamId: string | null;
  isBidding: boolean;
  countdown: number;
  log: ActionLog[];
  lastSold?: { playerId: string; teamId: string; amount: number; ts: number };
}

type Action =
  | { type: "SET_CURRENT_PLAYER"; playerId: string }
  | { type: "START_BIDDING" }
  | { type: "PLACE_BID"; teamId: string }
  | { type: "PLACE_BID_AMOUNT"; teamId: string; amount: number }
  | { type: "MARK_SOLD" }
  | { type: "MARK_UNSOLD" }
  | { type: "DEFER" }
  | { type: "TICK" }
  | { type: "RESET_COUNTDOWN"; seconds?: number };

const COUNTDOWN_RESET = 30;

const initialState: AuctionState = {
  players: PLAYERS,
  teams: TEAMS,
  currentPlayerId: PLAYERS[0].id,
  currentBid: 0,
  leadingTeamId: null,
  isBidding: false,
  countdown: COUNTDOWN_RESET,
  log: [],
};

function log(
  state: AuctionState,
  entry: Omit<ActionLog, "id" | "ts">
): ActionLog[] {
  return [
    { ...entry, id: `${Date.now()}-${Math.random()}`, ts: Date.now() },
    ...state.log,
  ].slice(0, 20);
}

function reducer(state: AuctionState, action: Action): AuctionState {
  switch (action.type) {
    case "SET_CURRENT_PLAYER": {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      return {
        ...state,
        currentPlayerId: action.playerId,
        currentBid: 0,
        leadingTeamId: null,
        isBidding: false,
        countdown: COUNTDOWN_RESET,
      };
    }

    case "START_BIDDING": {
      const player = state.players.find((p) => p.id === state.currentPlayerId);
      if (!player) return state;
      return {
        ...state,
        currentBid: player.basePrice,
        isBidding: true,
        countdown: COUNTDOWN_RESET,
        log: log(state, {
          type: "START",
          playerId: player.id,
          amount: player.basePrice,
          message: `Bidding opened at base ${player.basePrice}`,
        }),
      };
    }

    case "PLACE_BID": {
      if (!state.isBidding) return state;
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team) return state;
      const inc = nextIncrement(state.currentBid);
      const next = state.currentBid + inc;
      if (team.purse < next) return state; // can't afford
      return {
        ...state,
        currentBid: next,
        leadingTeamId: team.id,
        countdown: COUNTDOWN_RESET,
        log: log(state, {
          type: "BID",
          teamId: team.id,
          amount: next,
          message: `${team.short} bid ${next}`,
        }),
      };
    }

    case "PLACE_BID_AMOUNT": {
      if (!state.isBidding) return state;
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team || team.purse < action.amount) return state;
      return {
        ...state,
        currentBid: action.amount,
        leadingTeamId: team.id,
        countdown: COUNTDOWN_RESET,
        log: log(state, {
          type: "BID",
          teamId: team.id,
          amount: action.amount,
          message: `${team.short} bid ${action.amount}`,
        }),
      };
    }

    case "MARK_SOLD": {
      const player = state.players.find((p) => p.id === state.currentPlayerId);
      const team = state.teams.find((t) => t.id === state.leadingTeamId);
      if (!player || !team || state.currentBid === 0) return state;

      const updatedTeams = state.teams.map((t) =>
        t.id === team.id
          ? { ...t, purse: t.purse - state.currentBid, squad: [...t.squad, player.id] }
          : t
      );
      const updatedPlayers = state.players.map((p) =>
        p.id === player.id
          ? { ...p, status: "sold" as const, soldTo: team.id, soldFor: state.currentBid }
          : p
      );
      return {
        ...state,
        teams: updatedTeams,
        players: updatedPlayers,
        isBidding: false,
        lastSold: { playerId: player.id, teamId: team.id, amount: state.currentBid, ts: Date.now() },
        log: log(state, {
          type: "SOLD",
          teamId: team.id,
          playerId: player.id,
          amount: state.currentBid,
          message: `${player.name} SOLD to ${team.short} for ${state.currentBid}`,
        }),
      };
    }

    case "MARK_UNSOLD": {
      const player = state.players.find((p) => p.id === state.currentPlayerId);
      if (!player) return state;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === player.id ? { ...p, status: "unsold" as const } : p
        ),
        isBidding: false,
        log: log(state, {
          type: "UNSOLD",
          playerId: player.id,
          message: `${player.name} UNSOLD`,
        }),
      };
    }

    case "DEFER": {
      const player = state.players.find((p) => p.id === state.currentPlayerId);
      if (!player) return state;
      return {
        ...state,
        isBidding: false,
        log: log(state, {
          type: "DEFER",
          playerId: player.id,
          message: `${player.name} deferred`,
        }),
      };
    }

    case "TICK":
      return state.isBidding && state.countdown > 0
        ? { ...state, countdown: state.countdown - 1 }
        : state;

    case "RESET_COUNTDOWN":
      return { ...state, countdown: action.seconds ?? COUNTDOWN_RESET };

    default:
      return state;
  }
}

// Cross-tab sync key
const STORAGE_KEY = "bidwar-state-v1";
const CHANNEL = "bidwar-channel-v1";

export function useAuction() {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    if (typeof window === "undefined") return initialState;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Re-hydrate player portraits (imports get stripped through JSON)
        return {
          ...parsed,
          players: parsed.players.map((p: Player, i: number) => ({
            ...p,
            portrait: PLAYERS[i % PLAYERS.length].portrait,
          })),
        };
      }
    } catch {}
    return initialState;
  });

  // Persist + broadcast
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const serializable = { ...state, players: state.players.map((p) => ({ ...p, portrait: "" })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
      const bc = new BroadcastChannel(CHANNEL);
      bc.postMessage({ type: "sync", state: serializable });
      bc.close();
    } catch {}
  }, [state]);

  // Listen for changes from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (e) => {
      if (e.data?.type === "sync" && e.data.state) {
        const incoming = e.data.state as AuctionState;
        if (JSON.stringify({ ...state, players: [] }) !== JSON.stringify({ ...incoming, players: [] })) {
          dispatch({ type: "RESET_COUNTDOWN", seconds: incoming.countdown });
          window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
        }
      }
    };
    return () => bc.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-hydrate from storage event (cross-tab)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) return;
          const parsed = JSON.parse(saved);
          dispatch({ type: "RESET_COUNTDOWN", seconds: parsed.countdown });
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Countdown tick
  useEffect(() => {
    const t = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(t);
  }, []);

  const currentPlayer = useMemo(
    () => state.players.find((p) => p.id === state.currentPlayerId) ?? null,
    [state.players, state.currentPlayerId]
  );

  const leadingTeam = useMemo(
    () => state.teams.find((t) => t.id === state.leadingTeamId) ?? null,
    [state.teams, state.leadingTeamId]
  );

  const queue = useMemo(
    () => state.players.filter((p) => p.status === "queue"),
    [state.players]
  );

  const placeBid = useCallback(
    (teamId: string) => dispatch({ type: "PLACE_BID", teamId }),
    []
  );
  const placeBidAmount = useCallback(
    (teamId: string, amount: number) =>
      dispatch({ type: "PLACE_BID_AMOUNT", teamId, amount }),
    []
  );
  const startBidding = useCallback(() => dispatch({ type: "START_BIDDING" }), []);
  const markSold = useCallback(() => dispatch({ type: "MARK_SOLD" }), []);
  const markUnsold = useCallback(() => dispatch({ type: "MARK_UNSOLD" }), []);
  const deferPlayer = useCallback(() => dispatch({ type: "DEFER" }), []);
  const setCurrentPlayer = useCallback(
    (playerId: string) => dispatch({ type: "SET_CURRENT_PLAYER", playerId }),
    []
  );

  return {
    state,
    currentPlayer,
    leadingTeam,
    queue,
    actions: {
      placeBid,
      placeBidAmount,
      startBidding,
      markSold,
      markUnsold,
      deferPlayer,
      setCurrentPlayer,
    },
  };
}
