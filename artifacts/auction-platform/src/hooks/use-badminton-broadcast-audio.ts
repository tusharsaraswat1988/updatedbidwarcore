/**
 * Drives venue LED audio from branding music flag + match_state SFX edges.
 * Mount only on badminton venue display — never on OBS overlay or operator panels.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  detectVenueAudioCue,
  snapshotVenueAudioUrgency,
  type VenueAudioUrgencySnapshot,
} from "@workspace/badminton-core";
import { BadmintonAudioManager } from "@/lib/badminton-audio-manager";
import { useDisplayAudioLeader } from "@/components/display/use-display-audio-leader";

export function useBadmintonBroadcastAudio({
  tournamentId,
  matchKey,
  matchState,
  venueMusicPlaying,
  resolvedVenueMusicUrl,
  venueMusicVolume,
  matchStateReady,
}: {
  tournamentId: number;
  /** Changes when the followed match changes — re-arms SFX hydrate. */
  matchKey: string | number | null;
  matchState: BadmintonMatchState | null;
  venueMusicPlaying: boolean;
  resolvedVenueMusicUrl: string | null;
  venueMusicVolume: number;
  /** True once match query has settled at least once (avoids SFX on refresh). */
  matchStateReady: boolean;
}) {
  const managerRef = useRef<BadmintonAudioManager | null>(null);
  const urgencyRef = useRef<VenueAudioUrgencySnapshot | null>(null);
  const hydratedForMatchRef = useRef<string | number | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const isAudioLeader = useDisplayAudioLeader(
    tournamentId,
    "main",
    "badminton_venue_audio",
  );

  useEffect(() => {
    const mgr = new BadmintonAudioManager();
    managerRef.current = mgr;
    mgr.unlock().then(() => setIsUnlocked(mgr.isUnlocked)).catch(() => {});

    const tryUnlock = () => {
      mgr.unlock().then(() => setIsUnlocked(mgr.isUnlocked)).catch(() => {});
    };
    document.addEventListener("click", tryUnlock);
    document.addEventListener("keydown", tryUnlock);
    document.addEventListener("pointerdown", tryUnlock);

    return () => {
      document.removeEventListener("click", tryUnlock);
      document.removeEventListener("keydown", tryUnlock);
      document.removeEventListener("pointerdown", tryUnlock);
      mgr.dispose();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.setSettings({
      musicUrl: resolvedVenueMusicUrl,
      musicVolume: venueMusicVolume,
      masterVolume: 80,
      sfxVolume: 85,
    });
    // Do not call unlock() here — it races AudioContext on every volume/URL
    // tick and was a major source of venue LED memory/lag under load.
    if (mgr.isUnlocked) setIsUnlocked(true);
  }, [resolvedVenueMusicUrl, venueMusicVolume]);

  useEffect(() => {
    const mgr = managerRef.current;
    if (!mgr || !isAudioLeader) {
      managerRef.current?.pauseLoopMusic();
      return;
    }
    if (venueMusicPlaying) {
      mgr.startLoopMusic();
    } else {
      mgr.pauseLoopMusic();
    }
  }, [venueMusicPlaying, isAudioLeader, resolvedVenueMusicUrl]);

  useEffect(() => {
    if (!matchStateReady || !matchState || matchKey == null) return;

    if (hydratedForMatchRef.current !== matchKey) {
      hydratedForMatchRef.current = matchKey;
      urgencyRef.current = snapshotVenueAudioUrgency(matchState);
      return;
    }

    const cue = detectVenueAudioCue(urgencyRef.current, matchState);
    urgencyRef.current = snapshotVenueAudioUrgency(matchState);

    if (cue && isAudioLeader) {
      managerRef.current?.playSfx(cue);
    }
  }, [matchState, matchStateReady, isAudioLeader, matchKey]);

  useEffect(() => {
    if (matchKey == null) {
      hydratedForMatchRef.current = null;
      urgencyRef.current = null;
    }
  }, [matchKey]);

  const venueMusicPlayingRef = useRef(venueMusicPlaying);
  const isAudioLeaderRef = useRef(isAudioLeader);
  venueMusicPlayingRef.current = venueMusicPlaying;
  isAudioLeaderRef.current = isAudioLeader;

  const unlock = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    void mgr.unlock().then(() => {
      setIsUnlocked(mgr.isUnlocked);
      // Restart loop after browser gesture — On may have been pressed before unlock.
      if (venueMusicPlayingRef.current && isAudioLeaderRef.current) {
        mgr.startLoopMusic();
      }
    });
  }, []);

  return { isUnlocked, unlock, isAudioLeader };
}
