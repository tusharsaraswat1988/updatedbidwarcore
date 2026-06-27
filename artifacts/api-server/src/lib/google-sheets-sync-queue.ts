import type { Logger } from "pino";
import { performGoogleSheetSync, getTournamentGoogleSheetSync } from "./google-sheets-sync-service.js";

const DEBOUNCE_MS = 5000;

type QueueState = {
  debounceTimer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  queued: boolean;
};

const queueByTournament = new Map<number, QueueState>();

function getQueueState(tournamentId: number): QueueState {
  let state = queueByTournament.get(tournamentId);
  if (!state) {
    state = { debounceTimer: null, running: false, queued: false };
    queueByTournament.set(tournamentId, state);
  }
  return state;
}

async function runSyncJob(tournamentId: number, log?: Logger): Promise<void> {
  const state = getQueueState(tournamentId);
  if (state.running) {
    state.queued = true;
    return;
  }

  state.running = true;
  try {
    const sync = await getTournamentGoogleSheetSync(tournamentId);
    if (!sync || sync.syncStatus === "DISCONNECTED") {
      return;
    }
    await performGoogleSheetSync(tournamentId, log);
  } catch (err) {
    log?.error({ err, tournamentId }, "Background Google Sheet sync failed");
  } finally {
    state.running = false;
    if (state.queued) {
      state.queued = false;
      void runSyncJob(tournamentId, log);
    }
  }
}

/** Debounced background sync after player mutations. No-op if sheet not configured. */
export function scheduleGoogleSheetSync(tournamentId: number, log?: Logger): void {
  void getTournamentGoogleSheetSync(tournamentId).then((sync) => {
    if (!sync || sync.syncStatus === "DISCONNECTED") return;

    const state = getQueueState(tournamentId);
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null;
      void runSyncJob(tournamentId, log);
    }, DEBOUNCE_MS);
  }).catch((err) => {
    log?.error({ err, tournamentId }, "Failed to schedule Google Sheet sync");
  });
}

/** Immediate sync (manual Sync Now). */
export async function runGoogleSheetSyncNow(tournamentId: number, log?: Logger) {
  return performGoogleSheetSync(tournamentId, log, { force: true });
}
