import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  Flame,
  Volume2,
  VolumeX,
  Send,
  X,
  ChevronDown,
  Sparkles,
  Zap,
  Users,
  Trophy,
  Activity,
  Award,
} from "lucide-react";
import type { PublicTeam } from "@/lib/public-tournament-types";
import { cn } from "@/lib/utils";

export type FanCheerEntry = {
  id: string;
  supporterLabel: string;
  message: string;
  teamId: number;
  teamName: string;
  teamColor: string | null;
  shortCode: string;
  timestamp: number;
};

export const DEFAULT_CHEER_PRESETS = [
  "🔥 BOOM! That's a huge 6️⃣!",
  "💥 WHAT A CRACKING SHOT! 4️⃣",
  "🎯 TIMBER! Clean Bowled!",
  "⚡ Unbelievable catch! 🏏",
  "💪 Let's go team, finish it off!",
  "🏆 Champions in the making!",
  "🛡️ Dot ball pressure building!",
  "🙌 Well played boys, keep it going!",
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
    // Autoplay restrictions
  }
}

export function useFanCheerState(
  tournamentId: number,
  teams: PublicTeam[],
  activeMatchTeams?: { homeTeamId: number; awayTeamId: number } | null,
) {
  const teamStorageKey = `bidwar_fan_team_${tournamentId}`;
  const soundStorageKey = "bidwar_fan_sound_enabled";
  const messagesStorageKey = `bidwar_fan_cheers_${tournamentId}`;

  // 1. Team selection
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(teamStorageKey);
      return saved ? parseInt(saved, 10) : teams[0]?.id ?? null;
    } catch {
      return teams[0]?.id ?? null;
    }
  });

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null,
    [teams, selectedTeamId],
  );

  // 2. Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(soundStorageKey) !== "false";
    } catch {
      return true;
    }
  });

  // 3. Floating reaction emojis
  const [floatingReactions, setFloatingReactions] = useState<
    Array<{ id: string; emoji: string; left: number }>
  >([]);

  // 4. Cheers stream
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
        supporterLabel: "Match Fan",
        message: "🔥 Let's go!! Big match day!",
        teamId: t1?.id ?? 1,
        teamName: t1?.name ?? "Team 1",
        teamColor: t1?.color ?? "#10b981",
        shortCode: t1?.shortCode ?? "T1",
        timestamp: Date.now() - 1000 * 60 * 3,
      },
      {
        id: "cheer-init-2",
        supporterLabel: "Cricket Enthusiast",
        message: "💥 Looking for some huge sixes today!",
        teamId: t2?.id ?? 2,
        teamName: t2?.name ?? "Team 2",
        teamColor: t2?.color ?? "#38bdf8",
        shortCode: t2?.shortCode ?? "T2",
        timestamp: Date.now() - 1000 * 60 * 1,
      },
    ];
  });

  const [cooldown, setCooldown] = useState(false);

  const handleSelectTeam = (id: number) => {
    setSelectedTeamId(id);
    try {
      localStorage.setItem(teamStorageKey, id.toString());
    } catch {}
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(soundStorageKey, String(next));
      } catch {}
      return next;
    });
  };

  const sendCheer = useCallback(
    (text: string) => {
      if (!text.trim() || cooldown || !selectedTeam) return;

      const newEntry: FanCheerEntry = {
        id: `cheer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        supporterLabel: `Fan · ${selectedTeam.shortCode || selectedTeam.name.slice(0, 3)}`,
        message: text.trim().slice(0, 100),
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        teamColor: selectedTeam.color,
        shortCode: selectedTeam.shortCode,
        timestamp: Date.now(),
      };

      setMessages((prev) => {
        const next = [...prev.slice(-40), newEntry];
        try {
          localStorage.setItem(messagesStorageKey, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Spawn floating reaction emoji
      const emojis = ["🔥", "6️⃣", "💥", "🏏", "🎯", "⚡", "👏"];
      const picked = emojis[Math.floor(Math.random() * emojis.length)];
      const reactionId = `react-${Date.now()}-${Math.random()}`;
      const leftPos = 20 + Math.random() * 60; // 20% to 80% width

      setFloatingReactions((prev) => [...prev.slice(-8), { id: reactionId, emoji: picked, left: leftPos }]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
      }, 2500);

      if (soundEnabled) {
        playCheerChime();
      }

      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);
    },
    [cooldown, selectedTeam, soundEnabled, messagesStorageKey],
  );

  // Heat meter calculation
  const heatMeter = useMemo(() => {
    if (!activeMatchTeams) return null;
    const team1 = teams.find((t) => t.id === activeMatchTeams.homeTeamId);
    const team2 = teams.find((t) => t.id === activeMatchTeams.awayTeamId);
    if (!team1 || !team2) return null;

    let count1 = 0;
    let count2 = 0;
    messages.forEach((m) => {
      if (m.teamId === team1.id) count1++;
      if (m.teamId === team2.id) count2++;
    });

    const total = count1 + count2 || 2;
    const pct1 = Math.round((Math.max(1, count1) / total) * 100);
    const pct2 = 100 - pct1;

    return { team1, team2, count1, count2, pct1, pct2 };
  }, [activeMatchTeams, teams, messages]);

  return {
    selectedTeam,
    selectedTeamId,
    handleSelectTeam,
    messages,
    sendCheer,
    cooldown,
    soundEnabled,
    toggleSound,
    heatMeter,
    floatingReactions,
  };
}

// ── 1. Floating Cheer Overlay Layer (Common across ALL 4 sections) ─────────
export function FanCheerFloatingWidget({
  cheerState,
  teams,
}: {
  cheerState: ReturnType<typeof useFanCheerState>;
  teams: PublicTeam[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    selectedTeam,
    selectedTeamId,
    handleSelectTeam,
    messages,
    sendCheer,
    cooldown,
    soundEnabled,
    toggleSound,
    heatMeter,
    floatingReactions,
  } = cheerState;

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const recentMessage = messages[messages.length - 1];

  return (
    <>
      {/* Floating Reaction Emojis rising up on screen */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingReactions.map((r) => (
          <span
            key={r.id}
            className="absolute bottom-16 text-3xl sm:text-4xl animate-float-up opacity-90 transition-all filter drop-shadow-md"
            style={{ left: `${r.left}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Floating Action Button (Fixed on all tabs) */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {/* Recent floating cheer pill preview when closed */}
        {!isOpen && recentMessage ? (
          <div className="mb-1 max-w-[280px] animate-fade-in rounded-xl border border-white/20 bg-black/85 p-2 shadow-2xl backdrop-blur-md text-[11px] text-white">
            <div className="flex items-center gap-1.5 font-bold mb-0.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: recentMessage.teamColor || "#10b981" }}
              />
              <span className="truncate text-white/90">{recentMessage.supporterLabel}</span>
            </div>
            <p className="truncate text-emerald-300 font-medium">{recentMessage.message}</p>
          </div>
        ) : null}

        {/* The Cheer Arena FAB */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 p-3 sm:px-5 sm:py-3 text-xs font-black text-black shadow-2xl shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all"
        >
          <Flame className="h-5 w-5 fill-black text-black animate-pulse" />
          <span className="hidden sm:inline tracking-wider uppercase">Cheer Arena</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
            💬
          </span>
        </button>
      </div>

      {/* Slide-out Drawer / Overlay Layer */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:w-[420px] h-[85vh] sm:h-[90vh] sm:mr-6 rounded-t-3xl sm:rounded-3xl border border-white/20 bg-[#0c1822] shadow-2xl flex flex-col overflow-hidden text-white">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0a141d]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center">
                  <Flame className="h-4 w-4 text-black fill-black" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-white">Live Cheer Arena</h4>
                  <p className="text-[10px] text-white/50">Cheer from anywhere on the portal</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleSound}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white"
                  title="Toggle sound"
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Team Picker Banner */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 text-xs">
              <span className="text-white/60">My Team:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-[280px]">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTeam(t.id)}
                    className={cn(
                      "shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase transition-all border",
                      t.id === selectedTeamId
                        ? "bg-emerald-500 text-black border-emerald-400"
                        : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10",
                    )}
                  >
                    {t.shortCode || t.name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Battle Meter in Drawer (if match active) */}
            {heatMeter ? (
              <div className="px-4 py-2.5 bg-black/40 border-b border-white/10 text-xs">
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span style={{ color: heatMeter.team1.color || "#10b981" }}>
                    {heatMeter.team1.shortCode || heatMeter.team1.name} ({heatMeter.pct1}%)
                  </span>
                  <span className="text-white/40 uppercase">Battle Meter</span>
                  <span style={{ color: heatMeter.team2.color || "#38bdf8" }}>
                    ({heatMeter.pct2}%) {heatMeter.team2.shortCode || heatMeter.team2.name}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${heatMeter.pct1}%`,
                      backgroundColor: heatMeter.team1.color || "#10b981",
                    }}
                  />
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${heatMeter.pct2}%`,
                      backgroundColor: heatMeter.team2.color || "#38bdf8",
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* Chat Feed */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-white/15"
            >
              {messages.map((m) => {
                const isMyTeam = m.teamId === selectedTeamId;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl p-2.5 text-xs border transition-all",
                      isMyTeam
                        ? "bg-white/10 border-white/15 ml-4"
                        : "bg-white/5 border-white/5 mr-4",
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: m.teamColor || "#10b981" }}
                        />
                        <span className="text-white/90">{m.supporterLabel}</span>
                      </span>
                      <span className="text-white/40 text-[9px]">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-white font-medium break-words leading-relaxed">{m.message}</p>
                  </div>
                );
              })}
            </div>

            {/* Quick Presets */}
            <div className="px-4 py-2 border-t border-white/10 bg-black/30">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {DEFAULT_CHEER_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={cooldown}
                    onClick={() => sendCheer(preset)}
                    className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/90 hover:bg-white/15 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customText.trim()) {
                  sendCheer(customText);
                  setCustomText("");
                }
              }}
              className="flex items-center gap-2 p-3 border-t border-white/10 bg-[#09141c]"
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
                className="flex-1 rounded-xl border border-white/15 bg-black/50 px-3.5 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={!customText.trim() || cooldown}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-md disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ── 2. Full In-Page Fan Arena View (Rendered in the Fan Arena tab) ────────
export function FanArenaSection({
  cheerState,
  teams,
}: {
  cheerState: ReturnType<typeof useFanCheerState>;
  teams: PublicTeam[];
}) {
  const [customText, setCustomText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    selectedTeam,
    selectedTeamId,
    handleSelectTeam,
    messages,
    sendCheer,
    cooldown,
    soundEnabled,
    toggleSound,
    heatMeter,
  } = cheerState;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1b24] via-[#0b161e] to-[#081118] p-4 sm:p-6 shadow-2xl text-white">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Arena Top Title & Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Flame className="h-6 w-6 text-black fill-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg sm:text-xl tracking-tight text-white">
                Fan Arena & Live Battle
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Arena
              </span>
            </div>
            <p className="text-xs text-white/60">
              Support your favorite franchise, cheer big shots, and compete on the Fan Heat Meter!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className={cn(
              "p-2 rounded-xl border transition-colors",
              soundEnabled
                ? "bg-white/10 border-white/20 text-emerald-400 hover:bg-white/15"
                : "bg-white/5 border-white/10 text-white/40 hover:text-white/60",
            )}
            title={soundEnabled ? "Mute cheer chimes" : "Enable cheer chimes"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Team Selection Grid */}
      <div className="relative z-10 mb-5 rounded-xl border border-white/10 bg-white/5 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-amber-400" />
          Choose Your Supported Team:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {teams.map((t) => {
            const isSelected = t.id === selectedTeamId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTeam(t.id)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition-all text-left truncate",
                  isSelected
                    ? "bg-emerald-500/25 border-emerald-400 text-white ring-1 ring-emerald-400 shadow-md"
                    : "bg-black/20 border-white/10 text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.color || "#10b981" }}
                />
                <span className="truncate">{t.shortCode || t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fan Battle Heat Meter */}
      {heatMeter ? (
        <div className="relative z-10 mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="flex items-center gap-1.5" style={{ color: heatMeter.team1.color || "#10b981" }}>
              <Flame className="h-4 w-4" />
              {heatMeter.team1.name} ({heatMeter.pct1}%)
            </span>
            <span className="text-[10px] uppercase tracking-widest font-black text-white/60">
              Fan Battle Meter
            </span>
            <span className="flex items-center gap-1.5" style={{ color: heatMeter.team2.color || "#38bdf8" }}>
              ({heatMeter.pct2}%) {heatMeter.team2.name}
              <Flame className="h-4 w-4" />
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden flex shadow-inner">
            <div
              className="h-full transition-all duration-500 rounded-l-full"
              style={{
                width: `${heatMeter.pct1}%`,
                backgroundColor: heatMeter.team1.color || "#10b981",
              }}
            />
            <div
              className="h-full transition-all duration-500 rounded-r-full"
              style={{
                width: `${heatMeter.pct2}%`,
                backgroundColor: heatMeter.team2.color || "#38bdf8",
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Live Chat Message Stream Box */}
      <div
        ref={scrollRef}
        className="relative z-10 h-72 sm:h-80 overflow-y-auto space-y-2.5 pr-1 rounded-xl bg-black/30 border border-white/5 p-3.5 mb-4 scrollbar-thin scrollbar-thumb-white/15"
      >
        {messages.map((m) => {
          const isMyTeam = m.teamId === selectedTeamId;
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-col rounded-xl p-3 text-xs transition-all border",
                isMyTeam
                  ? "bg-white/10 border-white/20 ml-4 sm:ml-12"
                  : "bg-white/5 border-white/5 mr-4 sm:mr-12",
              )}
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="flex items-center gap-1.5 font-bold">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: m.teamColor || "#10b981" }}
                  />
                  <span className="text-white/90">{m.supporterLabel}</span>
                  <span
                    className="rounded px-1.5 py-0.2 text-[9px] uppercase font-bold"
                    style={{
                      backgroundColor: m.teamColor ? `${m.teamColor}26` : "#10b98126",
                      color: m.teamColor || "#10b981",
                    }}
                  >
                    {m.shortCode || m.teamName.slice(0, 3)}
                  </span>
                </span>
                <span className="text-[10px] text-white/40">
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-white font-medium break-words leading-relaxed">{m.message}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Cheer Presets */}
      <div className="relative z-10 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          Instant Cheers:
        </p>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {DEFAULT_CHEER_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={cooldown}
              onClick={() => sendCheer(preset)}
              className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/90 hover:bg-white/15 hover:border-emerald-400/50 hover:text-emerald-300 transition-all disabled:opacity-50 whitespace-nowrap active:scale-95"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (customText.trim()) {
            sendCheer(customText);
            setCustomText("");
          }
        }}
        className="relative z-10 flex items-center gap-2"
      >
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          maxLength={100}
          placeholder={
            selectedTeam
              ? `Cheer for ${selectedTeam.name}...`
              : "Type your cheer message..."
          }
          className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all"
        />

        <button
          type="submit"
          disabled={!customText.trim() || cooldown}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold px-5 py-2.5 text-xs transition-colors shadow-lg shadow-emerald-900/40"
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          {cooldown ? "Wait..." : "Cheer"}
        </button>
      </form>
    </section>
  );
}
