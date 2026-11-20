import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Flame,
  Volume2,
  VolumeX,
  Send,
  X,
  Sparkles,
  Users,
  Trophy,
  Shield,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cloudinary";

export interface CheerTeam {
  id: number;
  name: string;
  shortCode?: string;
  color?: string | null;
  logoUrl?: string | null;
}

export interface FanCheerEntry {
  id: string;
  supporterLabel: string;
  message: string;
  teamId: number;
  teamName: string;
  teamColor?: string | null;
  shortCode?: string;
  timestamp: number;
}

export const DEFAULT_CHEER_PRESETS: string[] = [
  "What a bid! 🔥",
  "Go go go! 💪",
  "Excellent pick! 👏",
  "Bidding war! ⚔️",
  "Legend! 🏆",
  "Value pick! 💎",
  "Superb shot! 💥",
  "Unbelievable catch! ⚡",
  "Amazing! 🙌",
  "On fire! 🔥",
];

// Web Audio sound synthesizer for cheer chimes
function playCheerChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ac = new AudioContextClass();
    const t = ac.currentTime;

    const osc1 = ac.createOscillator();
    const gain1 = ac.createGain();
    osc1.connect(gain1);
    gain1.connect(ac.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, t); // E5
    gain1.gain.setValueAtTime(0.08, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc1.start(t);
    osc1.stop(t + 0.18);

    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.connect(gain2);
    gain2.connect(ac.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, t + 0.06); // A5
    gain2.gain.setValueAtTime(0.06, t + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc2.start(t + 0.06);
    osc2.stop(t + 0.28);
  } catch {
    // Autoplay restrictions or unsupported audio
  }
}

export interface FanCheerWidgetProps {
  tournamentId: number;
  teams?: CheerTeam[];
  cheerEnabled?: boolean;
  presets?: string[] | null;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  activeModule?: "auction" | "scoring" | "overview";
}

export function FanCheerWidget({
  tournamentId,
  teams = [],
  cheerEnabled = true,
  presets: customPresets,
  soundEnabled = true,
  onToggleSound,
  activeModule = "auction",
}: FanCheerWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<
    Array<{ id: string; emoji: string; left: number }>
  >([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const teamStorageKey = `bidwar_fan_team_${tournamentId}`;
  const messagesStorageKey = `bidwar_fan_cheers_${tournamentId}`;

  // 1. Supported team selection (persisted per tournament)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(teamStorageKey);
      if (saved) return parseInt(saved, 10);
    } catch {}
    return teams[0]?.id ?? null;
  });

  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null,
    [teams, selectedTeamId]
  );

  const handleSelectTeam = (id: number) => {
    setSelectedTeamId(id);
    try {
      localStorage.setItem(teamStorageKey, id.toString());
    } catch {}
  };

  // 2. Active presets
  const presets = useMemo(() => {
    if (customPresets && Array.isArray(customPresets) && customPresets.length > 0) {
      return customPresets;
    }
    return DEFAULT_CHEER_PRESETS;
  }, [customPresets]);

  // 3. Cheers message feed
  const [messages, setMessages] = useState<FanCheerEntry[]>(() => {
    try {
      const stored = localStorage.getItem(messagesStorageKey);
      if (stored) return JSON.parse(stored);
    } catch {}
    const t1 = teams[0];
    const t2 = teams[1] || teams[0];
    return [
      {
        id: "cheer-init-1",
        supporterLabel: `${t1?.shortCode || "FAN"} SUPPORTERS`,
        message: "🔥 Let's go team!! Big action today!",
        teamId: t1?.id ?? 1,
        teamName: t1?.name ?? "Team",
        teamColor: t1?.color ?? "#f59e0b",
        shortCode: t1?.shortCode ?? "T1",
        timestamp: Date.now() - 1000 * 60 * 2,
      },
      {
        id: "cheer-init-2",
        supporterLabel: `${t2?.shortCode || "FAN"} SUPPORTERS`,
        message: "⚔️ Looking for top picks and big performances!",
        teamId: t2?.id ?? 2,
        teamName: t2?.name ?? "Team",
        teamColor: t2?.color ?? "#3b82f6",
        shortCode: t2?.shortCode ?? "T2",
        timestamp: Date.now() - 1000 * 45,
      },
    ];
  });

  // Listen for broadcast SSE cheers from auction stream
  useEffect(() => {
    const handleSseCheer = (e: Event) => {
      const detail = (e as CustomEvent<FanCheerEntry>).detail;
      if (detail) {
        setMessages((prev) => {
          const next = [...prev.slice(-30), detail];
          try {
            localStorage.setItem(messagesStorageKey, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Trigger floating emoji reaction
        const emojis = ["🔥", "6️⃣", "💥", "🏏", "🎯", "⚡", "👏", "🏆"];
        const picked = emojis[Math.floor(Math.random() * emojis.length)];
        const reactionId = `react-${Date.now()}-${Math.random()}`;
        const leftPos = 20 + Math.random() * 60;
        setFloatingReactions((prev) => [...prev.slice(-8), { id: reactionId, emoji: picked, left: leftPos }]);
        setTimeout(() => {
          setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
        }, 2500);

        if (soundEnabled) {
          playCheerChime();
        }
      }
    };

    window.addEventListener("bidwar_fan_cheer", handleSseCheer);
    return () => window.removeEventListener("bidwar_fan_cheer", handleSseCheer);
  }, [soundEnabled, messagesStorageKey]);

  // Listen for programmatic open requests (e.g. from mobile bottom nav)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("bidwar_open_cheer", handleOpen);
    return () => window.removeEventListener("bidwar_open_cheer", handleOpen);
  }, []);

  // Auto-scroll chat feed
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Dispatch cheer message to server & local feed
  const sendCheer = useCallback(
    async (text: string, presetIndex?: number) => {
      if (!text.trim() || cooldown || !selectedTeam || tournamentId <= 0) return;

      const newEntry: FanCheerEntry = {
        id: `cheer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        supporterLabel: `${(selectedTeam.shortCode || selectedTeam.name.slice(0, 4)).toUpperCase()} FANS`,
        message: text.trim().slice(0, 100),
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        teamColor: selectedTeam.color,
        shortCode: selectedTeam.shortCode,
        timestamp: Date.now(),
      };

      // Optimistic local update
      setMessages((prev) => {
        const next = [...prev.slice(-30), newEntry];
        try {
          localStorage.setItem(messagesStorageKey, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Spawn floating reaction emoji
      const emojis = ["🔥", "6️⃣", "💥", "🏏", "🎯", "⚡", "👏", "🏆"];
      const picked = emojis[Math.floor(Math.random() * emojis.length)];
      const reactionId = `react-${Date.now()}-${Math.random()}`;
      const leftPos = 20 + Math.random() * 60;
      setFloatingReactions((prev) => [...prev.slice(-8), { id: reactionId, emoji: picked, left: leftPos }]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
      }, 2500);

      if (soundEnabled) {
        playCheerChime();
      }

      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);

      // Call backend POST /api/tournaments/:id/cheer
      try {
        const reactionId = presetIndex != null && presetIndex >= 0 ? presetIndex : 0;
        await fetch(`/api/tournaments/${tournamentId}/cheer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: selectedTeam.id,
            reactionId: Math.min(reactionId, 9),
          }),
        });
      } catch {
        // Broadcast fallback / offline resilience
      }
    },
    [cooldown, selectedTeam, tournamentId, soundEnabled, messagesStorageKey]
  );

  if (!cheerEnabled) return null;

  const recentMessage = messages[messages.length - 1];

  return (
    <>
      {/* Floating Reaction Emojis Rising on Screen */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingReactions.map((r) => (
          <span
            key={r.id}
            className="absolute bottom-20 text-3xl sm:text-4xl animate-bounce opacity-90 transition-all drop-shadow-lg"
            style={{ left: `${r.left}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Floating Action Button (FAB) Dock */}
      <aside aria-label="Live Cheer Arena" className="fixed bottom-20 sm:bottom-5 right-4 sm:right-5 z-30 flex flex-col items-end gap-2">
        {/* Recent cheer snippet preview when closed */}
        {!isOpen && recentMessage && (
          <div
            onClick={() => setIsOpen(true)}
            className="mb-1 max-w-[280px] cursor-pointer rounded-2xl border border-white/20 bg-slate-950/90 p-2.5 shadow-2xl backdrop-blur-md text-[11px] text-white transition hover:scale-102"
          >
            <div className="flex items-center gap-1.5 font-bold mb-0.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: recentMessage.teamColor || "#f59e0b" }}
              />
              <span className="truncate text-white/90">{recentMessage.supporterLabel}</span>
            </div>
            <p className="truncate text-amber-300 font-medium">{recentMessage.message}</p>
          </div>
        )}

        {/* Cheer FAB button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 p-3 sm:px-5 sm:py-3 text-xs font-black text-slate-950 shadow-2xl shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
          aria-label="Open Live Cheer Arena"
        >
          <Flame className="h-5 w-5 fill-slate-950 text-slate-950 animate-pulse" />
          <span className="hidden sm:inline tracking-wider uppercase font-black">Cheer Arena</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-bold text-white">
            💬
          </span>
        </button>
      </aside>

      {/* Slide-Out Bottom Sheet (Mobile) / Floating Dock (Desktop) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-xs transition-all"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="w-full sm:w-[400px] max-h-[80vh] sm:max-h-[520px] sm:mr-5 sm:mb-20 rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white/95 dark:border-white/20 dark:bg-[#0e1726]/98 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 dark:border-white/10 dark:bg-slate-950/80 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow">
                  <Flame className="h-4 w-4 text-slate-950 fill-slate-950" />
                </div>
                <div>
                  <h4 className="font-display font-black text-sm text-slate-900 dark:text-white">Live Fan Arena</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Cheer live for your team</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {onToggleSound && (
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="p-1.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                    title={soundEnabled ? "Mute cheer chimes" : "Enable cheer chimes"}
                  >
                    {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                  aria-label="Close cheer drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Team Picker Selector */}
            {teams.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/[0.02] text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider shrink-0 mr-2">
                  My Team:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTeam(t.id)}
                      className={cn(
                        "shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold uppercase transition-all border flex items-center gap-1.5 cursor-pointer",
                        t.id === selectedTeamId
                          ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10"
                      )}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color || "#f59e0b" }} />
                      <span>{t.shortCode || t.name.slice(0, 4)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cheer Chat Feed */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[260px] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/15"
            >
              {messages.map((m) => {
                const isMyTeam = m.teamId === selectedTeamId;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-2xl p-2.5 text-xs border transition-all",
                      isMyTeam
                        ? "bg-amber-500/10 border-amber-500/30 ml-4"
                        : "bg-slate-50 border-slate-200 text-slate-800 dark:bg-white/[0.04] dark:border-white/10 dark:text-slate-200 mr-4"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <span
                           className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: m.teamColor || "#f59e0b" }}
                        />
                        <span className="text-slate-900 dark:text-white font-bold">{m.supporterLabel}</span>
                      </span>
                      <span className="text-slate-400 text-[9px]">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 font-medium break-words leading-relaxed">{m.message}</p>
                  </div>
                );
              })}
            </div>

            {/* Quick Presets Carousel */}
            <div className="px-4 py-2 border-t border-slate-200 bg-slate-100/60 dark:border-white/10 dark:bg-black/40">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={cooldown}
                    onClick={() => sendCheer(preset, idx)}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/15 active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer transition shadow-2xs"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customText.trim()) {
                  sendCheer(customText);
                  setCustomText("");
                }
              }}
              className="flex items-center gap-2 p-3 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950"
            >
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                maxLength={100}
                placeholder={
                  selectedTeam
                    ? `Cheer for ${selectedTeam.shortCode || selectedTeam.name}...`
                    : "Type a cheer..."
                }
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!customText.trim() || cooldown}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default FanCheerWidget;
