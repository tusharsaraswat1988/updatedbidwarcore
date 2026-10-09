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
  const [slots, setSlots] = useState<SponsorMediaSlotDto[]>([]);
  const [playback, setPlayback] = useState<SponsorPlaybackState>(emptySponsorPlayback);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const localRef = useRef<Map<number, LocalSlot>>(new Map());
  const slotsRef = useRef<SponsorMediaSlotDto[]>([]);
  const playbackRef = useRef(playback);
  const endedCuesRef = useRef<Set<string>>(new Set());
  const playingKeyRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    setShow(false);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setObjectUrl(null);
    playingKeyRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.pause();
      delete video.dataset.boundUrl;
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
    if (!show || !objectUrl) return;
    const slot = slotsRef.current.find((item) => item.id === playback.slotId);
    const video = videoRef.current;
    if (!video || slot?.assetType !== "video") return;
    const wantAudio = surface === "obs" && Boolean(slot.hasAudio);
    video.muted = true;
    video.defaultMuted = true;
    const token = playTokenRef.current;
    video.dataset.playToken = String(token);
    const onReady = () => {
      if (playTokenRef.current !== token || video.dataset.boundUrl !== objectUrl) return;
      try { video.currentTime = 0; } catch { /* metadata not ready yet */ }
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = typeof video.captureStream === "function" ? video.captureStream() : null;
      } catch {
        streamRef.current = null;
      }
      const start = () => video.play().then(() => {
        if (playTokenRef.current !== token) return;
        if (!wantAudio) return;
        video.muted = false;
        if (!video.paused) return;
        video.muted = true;
        return video.play();
      });
      void start().catch(() => {
        if (playTokenRef.current !== token) return;
        video.muted = true;
        void video.play().catch((err: unknown) => {
          if (playTokenRef.current !== token) return;
          hide("error", err instanceof Error ? err.message : "Playback failed");
        });
      });
    };
    if (video.dataset.boundUrl !== objectUrl) {
      video.dataset.boundUrl = objectUrl;
      video.src = objectUrl;
    }
    if (video.readyState >= 2) onReady();
    else video.addEventListener("loadeddata", onReady, { once: true });
    return () => video.removeEventListener("loadeddata", onReady);
  }, [hide, objectUrl, playback.cueId, playback.slotId, show, surface]);

  useEffect(() => {
    if (!show) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let frame = 0;
    let painted = false;
    canvas.style.opacity = "0";
    const draw = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
          const width = video.videoWidth * scale;
          const height = video.videoHeight * scale;
          context.fillStyle = "#000";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
          if (!painted) {
            const pixel = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
            if (pixel[0] + pixel[1] + pixel[2] > 16) {
              painted = true;
              canvas.style.opacity = "1";
            }
          }
        }
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [show, objectUrl]);

  const activeSlot = slots.find((slot) => slot.id === playback.slotId);
  if (!show || !objectUrl) return null;

  return (
    <div
      style={{ position: cover, inset: 0, zIndex: 90, background: "#000", pointerEvents: "none" }}
      aria-hidden
    >
      {activeSlot?.assetType === "image" ? (
        <img
          src={objectUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          onError={(event) => {
            if (event.currentTarget.src !== objectUrlRef.current) return;
            hide("error", "Player could not load this asset");
          }}
        />
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            onEnded={(event) => {
              const video = event.currentTarget;
              if (video.dataset.playToken !== String(playTokenRef.current)) return;
              if (!objectUrlRef.current || video.src !== objectUrlRef.current) return;
              if (playbackRef.current.cueId) endedCuesRef.current.add(playbackRef.current.cueId);
              const idle = emptySponsorPlayback();
              idle.issuedAt = playbackRef.current.issuedAt;
              idle.cueId = playbackRef.current.cueId;
              playbackRef.current = idle;
              setPlayback(idle);
              hide("ended");
            }}
            onError={(event) => {
              const video = event.currentTarget;
              if (video.dataset.playToken !== String(playTokenRef.current)) return;
              if (!objectUrlRef.current || video.src !== objectUrlRef.current) return;
              hide("error", "Playback failed");
            }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 1 }}
          />
          <canvas ref={canvasRef} width={1920} height={1080} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, opacity: 0 }} />
        </>
      )}
    </div>
  );
}
