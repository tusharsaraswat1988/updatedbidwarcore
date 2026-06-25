import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import {
  BROADCAST_OVERLAY_WIDTH,
  BROADCAST_OVERLAY_HEIGHT,
  broadcastOverlayPath,
} from "@/lib/broadcast-overlay";

type FacingMode = "user" | "environment";

/**
 * Camera + Broadcast Overlay preview — same stack as OBS:
 * 1920×1080 stage → camera layer → transparent overlay on top.
 * Camera stays inside the broadcast frame (visible through overlay gaps), not in letterbox margins.
 */
export default function ObsOverlayPreview() {
  const [, params] = useRoute("/tournament/:id/obs/preview");
  const tournamentId = parseInt(params?.id || "0", 10);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(true);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);

  const overlaySrc = broadcastOverlayPath(tournamentId);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async (mode: FacingMode) => {
    stopStream();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported in this browser.");
      setCameraOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setError(msg);
    }
  }, [stopStream]);

  useEffect(() => {
    document.title = "Overlay Preview — BidWar";
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (cameraOn) void startCamera(facing);
    else stopStream();
    return stopStream;
  }, [cameraOn, facing, startCamera, stopStream]);

  useEffect(() => {
    const updateScale = () => {
      setScale(Math.min(
        window.innerWidth / BROADCAST_OVERLAY_WIDTH,
        window.innerHeight / BROADCAST_OVERLAY_HEIGHT,
      ));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const flipCamera = () => {
    setFacing(prev => (prev === "user" ? "environment" : "user"));
  };

  const enterFullscreen = () => {
    void document.documentElement.requestFullscreen?.();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    }}>
      {/* OBS canvas — camera + overlay share one 1920×1080 frame */}
      <div
        style={{
          width: BROADCAST_OVERLAY_WIDTH,
          height: BROADCAST_OVERLAY_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
          background: "#0a0a0a",
        }}
      >
        {/* Layer 1: camera (shows through transparent overlay centre) */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: facing === "user" ? "scaleX(-1)" : undefined,
            zIndex: 0,
            opacity: cameraOn && !error ? 1 : 0,
          }}
        />

        {!cameraOn && !error && (
          <div style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "#111",
          }}>
            Camera off
          </div>
        )}

        {/* Layer 2: live overlay — same URL as OBS browser source */}
        <iframe
          title="Broadcast Overlay"
          src={overlaySrc}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
            zIndex: 1,
            pointerEvents: "none",
          }}
          allow="autoplay"
        />
      </div>

      {/* Preview chrome — outside broadcast frame */}
      {controlsVisible && (
        <div style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          maxWidth: 520,
          zIndex: 50,
          pointerEvents: "auto",
        }}>
          <PreviewButton active={cameraOn} onClick={() => setCameraOn(v => !v)}>
            {cameraOn ? "Camera off" : "Camera on"}
          </PreviewButton>
          <PreviewButton onClick={flipCamera} disabled={!cameraOn}>
            Flip camera
          </PreviewButton>
          <PreviewButton onClick={enterFullscreen}>
            Fullscreen
          </PreviewButton>
          <PreviewButton onClick={() => window.open(overlaySrc, "_blank")}>
            Overlay only
          </PreviewButton>
          <PreviewButton onClick={() => setControlsVisible(false)}>
            Hide controls
          </PreviewButton>
        </div>
      )}

      {!controlsVisible && (
        <button
          type="button"
          onClick={() => setControlsVisible(true)}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 50,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.65)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Show controls
        </button>
      )}

      <div style={{
        position: "absolute",
        top: 16,
        left: 16,
        right: 140,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-start",
        pointerEvents: "none",
      }}>
        <div style={{
          padding: "8px 14px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.75)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}>
          OBS preview — camera inside 1920×1080 frame, overlay on top
        </div>
        {error && (
          <div style={{
            maxWidth: 420,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(127,29,29,0.85)",
            border: "1px solid rgba(248,113,113,0.4)",
            color: "#fecaca",
            fontSize: 12,
            pointerEvents: "auto",
          }}>
            {error}
            <button
              type="button"
              onClick={() => { setCameraOn(true); void startCamera(facing); }}
              style={{
                display: "block",
                margin: "8px 0 0",
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: "#fff",
                color: "#111",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry camera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 16px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.18)",
        background: active === false ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.72)",
        color: disabled ? "rgba(255,255,255,0.35)" : "#fff",
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        backdropFilter: "blur(8px)",
      }}
    >
      {children}
    </button>
  );
}
