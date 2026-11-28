import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptSponsorBroadcastDownload,
  cueIsLightweight,
  emptySponsorPlayback,
  isPlayableBroadcastMp4,
  localAssetMatchesCue,
  parseSponsorMediaCue,
  reduceSponsorPlayback,
  sponsorCacheKey,
  type SponsorMediaCue,
  type SponsorMediaSurface,
  type SponsorPlaybackState,
} from "@workspace/scoring-core";
import {
  dropOtherSponsorVersions,
  readCachedSponsorBlob,
  sha256Blob,
  verifyCachedSponsorBlob,
  writeCachedSponsorBlob,
} from "@/lib/sponsor-media-cache";
import {
  fetchSponsorMediaSlots,
  rememberSponsorDisplayToken,
  reportSponsorMediaReadiness,
  type SponsorMediaSlotDto,
} from "@/lib/sponsor-media-api";
import { useBranding } from "@/hooks/use-branding";
import {
  getBrandLogoAlt,
  getObsBrandMarkSrc,
  getObsBroadcastLogoSrc,
  OBS_BROADCAST_LOGO_FALLBACK,
} from "@/lib/brand-assets";

type Props = {
  tournamentId: number;
  surface: SponsorMediaSurface;
  cover?: "absolute" | "fixed";
};

function probeSponsorBlob(blob: Blob, assetType: "image" | "video"): Promise<void> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    let settled = false;
    let detach = () => {};
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      detach();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve();
    };
    const timeout = window.setTimeout(() => {
      finish(new Error("Player could not load this asset"));
    }, 8000);
    if (assetType === "image") {
      const image = new Image();
      image.onload = () => {
        finish(image.naturalWidth < 1 ? new Error("Player could not load this asset") : undefined);
      };
      image.onerror = () => finish(new Error("Player could not load this asset"));
      image.src = url;
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.preload = "auto";
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.style.cssText = "position:fixed;width:320px;height:180px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    detach = () => {
      video.pause();
      video.removeAttribute("src");
      video.remove();
    };
    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error("Player could not load this asset"));
    video.src = url;
  });
}

async function broadcastBlobAccepted(blob: Blob, slot: SponsorMediaSlotDto): Promise<boolean> {
  const verified = await verifyCachedSponsorBlob({
    blob,
    expectedVersion: slot.version,
    actualVersion: slot.version,
    expectedChecksum: slot.checksum,
    expectedSize: slot.fileSizeBytes ?? blob.size,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return acceptSponsorBroadcastDownload({
    assetType: slot.assetType,
    checksumOk: verified.ok,
    bytes,
  });
}

type LocalSlot = {
  slotId: number;
  version: number;
  verified: boolean;
  checkedAt: number;
  error?: string;
  status: "ready" | "preparing" | "missing" | "failed";
};

export function SponsorMediaLayer({ tournamentId, surface, cover = "absolute" }: Props) {
  const { logos, brandName, iconVersion } = useBranding();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSrc =
    getObsBroadcastLogoSrc(logos, iconVersion) ||
    getObsBrandMarkSrc(logos, iconVersion) ||
    OBS_BROADCAST_LOGO_FALLBACK;
  const logoAlt = getBrandLogoAlt(brandName);

  const [slots, setSlots] = useState<SponsorMediaSlotDto[]>([]);
  const [playback, setPlayback] = useState<SponsorPlaybackState>(emptySponsorPlayback);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const [mediaDims, setMediaDims] = useState<{ width: number; height: number } | null>(null);
  const localRef = useRef<Map<number, LocalSlot>>(new Map());
  const slotsRef = useRef<SponsorMediaSlotDto[]>([]);
  const playbackRef = useRef(playback);
  const endedCuesRef = useRef<Set<string>>(new Set());
  const playingKeyRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prepareTokenRef = useRef(0);
  const playTokenRef = useRef(0);
  const playAttemptsRef = useRef<Map<string, number>>(new Map());
  const playbackErrorRef = useRef<string | undefined>(undefined);
  const reconnectRef = useRef(false);

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const publish = useCallback((playbackStatus?: SponsorPlaybackState, playbackError?: string) => {
    if (playbackError !== undefined) playbackErrorRef.current = playbackError || undefined;
    const current = playbackStatus ?? playbackRef.current;
    const error = playbackErrorRef.current;
    const reports = [...localRef.current.values()];
    void reportSponsorMediaReadiness(tournamentId, {
      surface,
      slots: slotsRef.current
        .filter((slot) => slot.processingStatus === "ready" && slot.active && slot.id)
        .map((slot) => {
          const local = localRef.current.get(slot.slotNumber);
          return {
            slotNumber: slot.slotNumber,
            version: slot.version,
            status: local && local.version === slot.version ? local.status : "missing",
            error: local?.error,
          };
        }),
      playback: {
        status: error
          ? "error"
          : current.phase === "playing"
            ? "playing"
            : "idle",
        slotNumber: current.slotNumber,
        cueId: current.cueId,
        error,
      },
    }).then((ok) => {
      if (!ok) reconnectRef.current = true;
    });
    void reports;
  }, [surface, tournamentId]);

  const prepare = useCallback(async (nextSlots: SponsorMediaSlotDto[], force = false) => {
    const token = ++prepareTokenRef.current;
    for (const slot of nextSlots) {
      if (token !== prepareTokenRef.current) return;
      if (!slot.id || slot.processingStatus !== "ready" || !slot.active || !slot.broadcastUrl || !slot.checksum || slot.version <= 0) {
        continue;
      }
      const existing = localRef.current.get(slot.slotNumber);
      const sameAsset = Boolean(existing?.verified && existing.version === slot.version && existing.slotId === slot.id);
      if (sameAsset && existing && !force && Date.now() - existing.checkedAt < 60_000) continue;
      if (sameAsset && existing) {
        const cachedBlob = await readCachedSponsorBlob(tournamentId, slot.slotNumber, slot.version);
        if (cachedBlob && await broadcastBlobAccepted(cachedBlob, slot)) {
          localRef.current.set(slot.slotNumber, { ...existing, checkedAt: Date.now(), status: "ready", verified: true });
          continue;
        }
      }
      localRef.current.set(slot.slotNumber, {
        slotId: slot.id,
        version: slot.version,
        verified: false,
        checkedAt: 0,
        status: "preparing",
      });
      try {
        let blob = await readCachedSponsorBlob(tournamentId, slot.slotNumber, slot.version);
        if (blob && !(await broadcastBlobAccepted(blob, slot))) blob = null;
        if (!blob) {
          const response = await fetch(slot.broadcastUrl, { cache: "no-store" });
          if (!response.ok) throw new Error("Unable to download");
          blob = await response.blob();
          if (!(await broadcastBlobAccepted(blob, slot))) throw new Error("Video file is not playable. Replace it.");
          await writeCachedSponsorBlob(tournamentId, slot.slotNumber, slot.version, blob);
        }
        if (slot.assetType === "video") {
          const playable = isPlayableBroadcastMp4(new Uint8Array(await blob.arrayBuffer()));
          if (!playable) throw new Error("Video file is not playable. Replace it.");
        }
        if (slot.assetType === "image" || slot.assetType === "video") {
          await probeSponsorBlob(blob, slot.assetType);
        }
        if (token !== prepareTokenRef.current) return;
        localRef.current.set(slot.slotNumber, {
          slotId: slot.id,
          version: slot.version,
          verified: true,
          checkedAt: Date.now(),
          status: "ready",
        });
      } catch (err) {
        localRef.current.set(slot.slotNumber, {
          slotId: slot.id,
          version: slot.version,
          verified: false,
          checkedAt: Date.now(),
          status: "failed",
          error: err instanceof Error ? err.message : "Unable to download",
        });
      }
    }
    await dropOtherSponsorVersions(
      tournamentId,
      nextSlots
        .filter((slot) => slot.id && slot.version > 0)
        .map((slot) => ({ slotNumber: slot.slotNumber, version: slot.version })),
      playingKeyRef.current,
    );
    publish();
  }, [publish, tournamentId]);

  const hide = useCallback((status: "ended" | "stopped" | "error", error?: string) => {
    playTokenRef.current += 1;
    setShow(false);
    setAudioBlocked(false);
    setMediaDims(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setObjectUrl(null);
    playingKeyRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.loop = false;
      video.muted = true;
      video.defaultMuted = true;
      video.pause();
      delete video.dataset.boundUrl;
      delete video.dataset.startedToken;
      video.removeAttribute("src");
      video.load();
    }
    playbackRef.current = {
      ...playbackRef.current,
      phase: "idle",
    };
    if (status === "error") playbackErrorRef.current = error || "Playback failed";
    else playbackErrorRef.current = undefined;
    publish(playbackRef.current, playbackErrorRef.current);
  }, [publish, surface, tournamentId]);

  const finishRound = useCallback(() => {
    const current = playbackRef.current;
    if (current.phase !== "playing" || !current.cueId) return;
    if (endedCuesRef.current.has(current.cueId)) return;
    endedCuesRef.current.add(current.cueId);
    const idle = emptySponsorPlayback();
    idle.issuedAt = current.issuedAt;
    idle.cueId = current.cueId;
    playbackRef.current = idle;
    setPlayback(idle);
    hide("ended");
  }, [hide]);

  const startCue = useCallback(async (cue: SponsorMediaCue) => {
    const stillPlaying = () => playbackRef.current.cueId === cue.cueId && playbackRef.current.phase === "playing";
    const slot = slotsRef.current.find((item) => item.id === cue.slotId && item.version === cue.version);
    const local = localRef.current.get(cue.slotNumber);
    if (!slot || !localAssetMatchesCue(local ? { ...local } : null, cue)) {
      const attempts = playAttemptsRef.current.get(cue.cueId) ?? 0;
      if (attempts < 40 && stillPlaying()) {
        playAttemptsRef.current.set(cue.cueId, attempts + 1);
        window.setTimeout(() => {
          if (stillPlaying()) void startCue(cue);
        }, 500);
        return;
      }
      hide("error", local?.error || "Missing asset");
      return;
    }
    const blob = await readCachedSponsorBlob(tournamentId, cue.slotNumber, cue.version);
    if (!stillPlaying()) return;
    if (!blob) {
      hide("error", "Missing asset");
      return;
    }
    const checksum = await sha256Blob(blob);
    if (!stillPlaying()) return;
    if (slot.checksum && checksum !== slot.checksum) {
      const playable = slot.assetType === "video" && isPlayableBroadcastMp4(new Uint8Array(await blob.arrayBuffer()));
      if (!playable) {
        localRef.current.set(cue.slotNumber, { ...local, verified: false, status: "failed", error: "Checksum mismatch" });
        hide("error", "Checksum mismatch");
        return;
      }
    }
    playbackErrorRef.current = undefined;
    const token = ++playTokenRef.current;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    playingKeyRef.current = sponsorCacheKey(tournamentId, cue.slotNumber, cue.version);
    setAudioBlocked(false);
    setMediaDims(slot.width && slot.height ? { width: slot.width, height: slot.height } : null);
    setObjectUrl(url);
    setShow(true);
    if (videoRef.current) videoRef.current.dataset.playToken = String(token);
    publish(playbackRef.current);
  }, [hide, publish, tournamentId]);

  const applyCue = useCallback((raw: unknown) => {
    const parsed = parseSponsorMediaCue(raw);
    if (!parsed.ok || !cueIsLightweight(parsed.cue)) return;
    const cue = parsed.cue;
    if (cue.action === "prepare") {
      void prepare(slotsRef.current);
      return;
    }
    const next = reduceSponsorPlayback(playbackRef.current, cue, surface);
    if (next === playbackRef.current) return;
    playbackRef.current = next;
    setPlayback(next);
    if (next.phase === "idle") {
      hide(cue.action === "stop" ? "stopped" : "ended");
      return;
    }
    if (next.cueId && endedCuesRef.current.has(next.cueId)) return;
    void startCue(cue);
  }, [hide, prepare, startCue, surface]);

  useEffect(() => {
    if (tournamentId <= 0) return;
    let cancelled = false;
    const load = () => {
      void fetchSponsorMediaSlots(tournamentId).then((next) => {
        if (cancelled) return;
        const force = reconnectRef.current;
        reconnectRef.current = false;
        setSlots(next);
        slotsRef.current = next;
        void prepare(next, force);
      }).catch(() => {
        reconnectRef.current = true;
      });
    };
    load();
    const timer = window.setInterval(load, 12_000);
    const heartbeat = window.setInterval(() => publish(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(heartbeat);
    };
  }, [prepare, publish, tournamentId]);

  useEffect(() => {
    if (tournamentId <= 0 || typeof window === "undefined") return;
    const onDirector = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        sponsorMedia?: unknown;
        sponsorDisplayTokens?: { obs?: string; led?: string };
      } | undefined;
      const token = detail?.sponsorDisplayTokens?.[surface];
      if (token) {
        rememberSponsorDisplayToken(tournamentId, surface, token);
        publish();
      }
      if (detail?.sponsorMedia) applyCue(detail.sponsorMedia);
    };
    window.addEventListener("cricket_obs_director", onDirector);
    const channels: BroadcastChannel[] = [];
    if (typeof BroadcastChannel !== "undefined") {
      for (const name of [`bidwar_v2_${tournamentId}`, `bidwar_cricket_obs_${tournamentId}`]) {
        const channel = new BroadcastChannel(name);
        channel.onmessage = (event) => {
          const data = event.data as {
            sponsorMedia?: unknown;
            sponsorDisplayTokens?: { obs?: string; led?: string };
          } | undefined;
          const token = data?.sponsorDisplayTokens?.[surface];
          if (token) {
            rememberSponsorDisplayToken(tournamentId, surface, token);
            publish();
          }
          if (data?.sponsorMedia) applyCue(data.sponsorMedia);
        };
        channels.push(channel);
      }
    }
    return () => {
      window.removeEventListener("cricket_obs_director", onDirector);
      channels.forEach((channel) => channel.close());
    };
  }, [applyCue, publish, surface, tournamentId]);

  useEffect(() => {
    if (!show || !playback.cueId) return;
    const cueId = playback.cueId;
    const issuedAt = playback.issuedAt;
    const slotId = playback.slotId;
    let timer = 0;
    let wait = 0;
    let armed = false;
    const arm = () => {
      if (armed || playbackRef.current.cueId !== cueId) return;
      const slot = slotsRef.current.find((item) => item.id === slotId);
      if (!slot) return;
      armed = true;
      if (slot.assetType !== "image") return;
      timer = window.setTimeout(() => {
        if (playbackRef.current.cueId !== cueId) return;
        endedCuesRef.current.add(cueId);
        const idle = emptySponsorPlayback();
        idle.issuedAt = issuedAt;
        idle.cueId = cueId;
        playbackRef.current = idle;
        setPlayback(idle);
        hide("ended");
      }, slot.durationMs);
    };
    arm();
    if (!armed) wait = window.setInterval(arm, 250);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(wait);
    };
  }, [hide, playback.cueId, playback.issuedAt, playback.slotId, show]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !show) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [show]);

  useEffect(() => {
    if (!show || !objectUrl) return;
    const slot = slotsRef.current.find((item) => item.id === playback.slotId);
    const video = videoRef.current;
    if (!video || slot?.assetType !== "video") return;

    const wantAudio = surface === "obs";
    video.loop = false;
    video.volume = wantAudio ? 1 : 0;

    const token = playTokenRef.current;
    const tokenKey = String(token);
    video.dataset.playToken = tokenKey;

    let endTimer = 0;

    const finish = () => {
      if (playTokenRef.current !== token) return;
      finishRound();
    };

    const syncDims = () => {
      if (playTokenRef.current !== token) return;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setMediaDims({ width: video.videoWidth, height: video.videoHeight });
      }
    };

    const armTimer = () => {
      window.clearTimeout(endTimer);
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const remainingMs = Math.max(0, (video.duration - video.currentTime) * 1000);
      endTimer = window.setTimeout(finish, Math.ceil(remainingMs) + 300);
    };

    const fallbackToMutedPlay = () => {
      if (playTokenRef.current !== token) return;
      video.defaultMuted = true;
      video.muted = true;
      setAudioBlocked(wantAudio);
      void video
        .play()
        .then(() => {
          armTimer();
        })
        .catch((err: unknown) => {
          if (playTokenRef.current !== token) return;
          hide("error", err instanceof Error ? err.message : "Playback failed");
        });
    };

    const onPause = () => {
      if (playTokenRef.current !== token) return;
      // If paused unexpectedly mid-stream while unmuted (e.g. autoplay policy block),
      // immediately fall back to muted playback so the video never freezes on screen.
      if (!video.ended && video.dataset.startedToken === tokenKey && !video.muted) {
        fallbackToMutedPlay();
      }
    };

    const onEnded = () => finish();

    video.addEventListener("ended", onEnded);
    video.addEventListener("loadedmetadata", armTimer);
    video.addEventListener("loadedmetadata", syncDims);
    video.addEventListener("resize", syncDims);
    video.addEventListener("durationchange", armTimer);
    video.addEventListener("pause", onPause);

    // Audio unlocker: if user clicks/taps anywhere on the browser page, unlock audio live
    const unlockAudio = () => {
      if (!wantAudio || playTokenRef.current !== token || video.ended) return;
      if (!video.muted && !video.paused) return;
      video.defaultMuted = false;
      video.muted = false;
      video.volume = 1;
      setAudioBlocked(false);
      if (video.paused) {
        void video.play().catch(() => fallbackToMutedPlay());
      }
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });

    const onReady = () => {
      if (playTokenRef.current !== token || video.dataset.boundUrl !== objectUrl) return;
      if (video.dataset.startedToken === tokenKey) return;
      video.dataset.startedToken = tokenKey;
      syncDims();

      try {
        video.currentTime = 0;
      } catch {
        /* metadata not ready yet */
      }

      if (wantAudio) {
        // Attempt unmuted playback first so OBS Browser Source (CEF) and engaged tabs
        // play full audio from frame 0 without a muted->unmuted transition glitch.
        video.defaultMuted = false;
        video.muted = false;
        video.volume = 1;
        void video
          .play()
          .then(() => {
            if (playTokenRef.current !== token) return;
            if (video.paused) {
              fallbackToMutedPlay();
              return;
            }
            setAudioBlocked(false);
            armTimer();
          })
          .catch(() => {
            fallbackToMutedPlay();
          });
        return;
      }

      video.defaultMuted = true;
      video.muted = true;
      setAudioBlocked(false);
      void video
        .play()
        .then(() => {
          armTimer();
        })
        .catch((err: unknown) => {
          if (playTokenRef.current !== token) return;
          hide("error", err instanceof Error ? err.message : "Playback failed");
        });
    };

    const alreadyStarted = video.dataset.startedToken === tokenKey;
    if (!alreadyStarted && video.dataset.boundUrl !== objectUrl) {
      video.dataset.boundUrl = objectUrl;
      video.src = objectUrl;
    }

    if (alreadyStarted && video.ended) {
      finish();
    } else if (alreadyStarted && video.paused) {
      void video.play().catch(() => fallbackToMutedPlay());
      armTimer();
    } else if (!alreadyStarted && video.readyState >= 2) {
      onReady();
    } else if (!alreadyStarted) {
      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("canplay", onReady, { once: true });
    } else {
      armTimer();
      syncDims();
    }

    return () => {
      window.clearTimeout(endTimer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("loadedmetadata", armTimer);
      video.removeEventListener("loadedmetadata", syncDims);
      video.removeEventListener("resize", syncDims);
      video.removeEventListener("durationchange", armTimer);
      video.removeEventListener("pause", onPause);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [finishRound, hide, objectUrl, playback.cueId, playback.slotId, show, surface]);

  const activeSlot = slots.find((slot) => slot.id === playback.slotId);
  if (!show || !objectUrl) return null;

  const naturalW = mediaDims?.width ?? (activeSlot?.width && activeSlot.width > 0 ? activeSlot.width : 0);
  const naturalH = mediaDims?.height ?? (activeSlot?.height && activeSlot.height > 0 ? activeSlot.height : 0);

  let offsetRight = 0;
  let offsetBottom = 0;
  let renderedW = containerSize.width;
  if (containerSize.width > 0 && containerSize.height > 0 && naturalW > 0 && naturalH > 0) {
    const scale = Math.min(containerSize.width / naturalW, containerSize.height / naturalH);
    renderedW = naturalW * scale;
    const renderedH = naturalH * scale;
    offsetRight = Math.max(0, (containerSize.width - renderedW) / 2);
    offsetBottom = Math.max(0, (containerSize.height - renderedH) / 2);
  }

  const isPortraitMedia = naturalW > 0 && naturalH > 0 && naturalH > naturalW;
  const insetRight = isPortraitMedia ? Math.min(24, Math.max(12, Math.round(renderedW * 0.04))) : 36;
  const watermarkRight = Math.round(offsetRight + insetRight);
  const watermarkBottom = Math.max(112, Math.round(offsetBottom + 24));

  return (
    <div
      ref={containerRef}
      style={{ position: cover, inset: 0, zIndex: 90, background: "#000", pointerEvents: "none" }}
      aria-hidden
    >
      {activeSlot?.assetType === "image" ? (
        <img
          src={objectUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setMediaDims({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          onError={(event) => {
            if (event.currentTarget.src !== objectUrlRef.current) return;
            hide("error", "Player could not load this asset");
          }}
        />
      ) : (
        <video
          ref={videoRef}
          playsInline
          preload="auto"
          loop={false}
          onEnded={(event) => {
            const video = event.currentTarget;
            if (video.dataset.playToken !== String(playTokenRef.current)) return;
            finishRound();
          }}
          onError={(event) => {
            const video = event.currentTarget;
            if (video.dataset.playToken !== String(playTokenRef.current)) return;
            if (!objectUrlRef.current || video.src !== objectUrlRef.current) return;
            hide("error", "Playback failed");
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 1,
            background: "#000",
          }}
        />
      )}
      {audioBlocked && surface === "obs" && activeSlot?.assetType === "video" ? (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (!video || video.ended) return;
            video.defaultMuted = false;
            video.muted = false;
            video.volume = 1;
            setAudioBlocked(false);
            if (video.paused) {
              void video.play().catch(() => {});
            }
          }}
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            zIndex: 10,
            pointerEvents: "auto",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 9999,
            background: "rgba(0, 0, 0, 0.78)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "#ffffff",
            fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
            transform: "translateZ(0)",
          }}
        >
          <span>🔇</span>
          <span>Click anywhere to enable audio</span>
        </button>
      ) : null}
      <div
        style={{
          position: "absolute",
          bottom: watermarkBottom,
          right: watermarkRight,
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          pointerEvents: "none",
          userSelect: "none",
          transform: "translateZ(0)",
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#ffffff",
            lineHeight: 1,
            textShadow:
              "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.85), 0 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          Broadcasted by
        </span>
        {!logoFailed && logoSrc ? (
          <img
            src={logoSrc}
            alt={logoAlt || "BidWar"}
            onError={() => setLogoFailed(true)}
            style={{
              height: 32,
              maxWidth: isPortraitMedia ? Math.min(160, Math.max(96, Math.round(renderedW * 0.4))) : 160,
              width: "auto",
              objectFit: "contain",
              display: "block",
              filter:
                "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.95)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 1px rgba(0, 0, 0, 0.9))",
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "'Bebas Neue', 'Inter', sans-serif",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#ffffff",
              lineHeight: 1,
              textShadow:
                "0 1px 2px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.85), 0 0 8px rgba(0, 0, 0, 0.7)",
            }}
          >
            BIDWAR
          </span>
        )}
      </div>
    </div>
  );
}
