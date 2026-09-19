import { useState, useId } from "react";
import { Sliders, Sparkles, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import { waMeUrl } from "@/lib/public-site-links";

type SportConfig = {
  name: string;
  defaultPlayersPerTeam: number;
  timerSec: number;
  purseLabel: string;
};

const SPORTS_CONFIG: Record<string, SportConfig> = {
  Cricket: { name: "Cricket", defaultPlayersPerTeam: 15, timerSec: 45, purseLabel: "50L Pts" },
  Football: { name: "Football", defaultPlayersPerTeam: 11, timerSec: 40, purseLabel: "30L Pts" },
  Badminton: { name: "Badminton", defaultPlayersPerTeam: 8, timerSec: 35, purseLabel: "25L Pts" },
  Kabaddi: { name: "Kabaddi", defaultPlayersPerTeam: 12, timerSec: 40, purseLabel: "40L Pts" },
  Esports: { name: "Esports", defaultPlayersPerTeam: 6, timerSec: 30, purseLabel: "20L Pts" },
  "Corporate League": { name: "Corporate League", defaultPlayersPerTeam: 12, timerSec: 40, purseLabel: "35L Pts" },
};

export function TournamentCalculator({ onStartTrial }: { onStartTrial: () => void }) {
  const [sport, setSport] = useState<string>("Cricket");
  const [teams, setTeams] = useState<number>(8);
  const [pursePerTeam, setPursePerTeam] = useState<number>(50); // In Lakhs pts
  const sportId = useId();
  const teamsId = useId();
  const purseId = useId();

  const cfg = SPORTS_CONFIG[sport] || SPORTS_CONFIG.Cricket;
  const totalPlayers = teams * cfg.defaultPlayersPerTeam;
  const totalPurse = teams * pursePerTeam;

  // Estimated auction duration
  const estSeconds = totalPlayers * (cfg.timerSec + 15);
  const estHours = Math.floor(estSeconds / 3600);
  const estMinutes = Math.round((estSeconds % 3600) / 60);
  const durationText = estHours > 0 ? `${estHours}h ${estMinutes}m` : `${estMinutes} mins`;

  // Recommended plan
  let planName = "Starter (4 Teams)";
  let planPrice = "₹4,500";
  if (teams <= 2) {
    planName = "Free Trial (2 Teams)";
    planPrice = "₹0";
  } else if (teams <= 4) {
    planName = "Starter (4 Teams)";
    planPrice = "₹4,500";
  } else if (teams <= 8) {
    planName = "Pro (8 Teams)";
    planPrice = "₹5,400";
  } else if (teams <= 12) {
    planName = "Advanced (12 Teams)";
    planPrice = "₹7,200";
  } else if (teams <= 16) {
    planName = "Elite (16 Teams)";
    planPrice = "₹8,100";
  } else if (teams <= 22) {
    planName = "Premium (22 Teams)";
    planPrice = "₹9,900";
  } else {
    planName = "Champion (30 Teams)";
    planPrice = "₹10,800";
  }

  const handleWhatsAppConsult = () => {
    const text = `Hi, I configured my tournament on BidWar:\n- Sport: ${sport}\n- Teams: ${teams}\n- Est. Players: ${totalPlayers}\n- Purse: ${pursePerTeam}L Pts/team\n- Recommended Plan: ${planName} (${planPrice})\nCan you help me set up a live demo?`;
    window.open(waMeUrl(text), "_blank", "noopener,noreferrer");
  };

  return (
    <section id="calculator" className="mx-auto max-w-7xl px-5 py-16">
      <div className="panel-rail relative overflow-hidden p-6 md:p-10 border border-primary/25 rounded-2xl bg-card/40">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[image:var(--gradient-gold)] opacity-15 blur-3xl" />

        <div className="relative mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-primary">
              <Sliders className="h-3.5 w-3.5" /> Interactive Setup Planner
            </div>
            <h2 className="text-display-lg mt-2">Calculate Your Auction Night Setup.</h2>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-muted-foreground">
            Configure your league size to estimate bidding time, points purse distribution, and recommended license.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] items-start">
          {/* Controls */}
          <div className="panel space-y-6 p-6 rounded-xl bg-black/30 border border-white/10">
            {/* Sport Select */}
            <div>
              <label htmlFor={sportId} className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Select Sport Format
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.keys(SPORTS_CONFIG).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSport(s)}
                    className={`rounded-lg border px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      sport === s
                        ? "border-primary bg-primary/20 text-primary shadow-sm"
                        : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Teams Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor={teamsId} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Number of Teams
                </label>
                <span className="font-display text-xl text-primary font-bold">{teams} Teams</span>
              </div>
              <input
                id={teamsId}
                type="range"
                min={2}
                max={30}
                step={1}
                value={teams}
                onChange={(e) => setTeams(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-white/10 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                <span>2 (Free Trial)</span>
                <span>8 (Pro)</span>
                <span>16 (Elite)</span>
                <span>30 (Champion)</span>
              </div>
            </div>

            {/* Points Purse Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor={purseId} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Purse Limit per Team
                </label>
                <span className="font-mono text-base text-foreground">{pursePerTeam} Lakh Pts</span>
              </div>
              <input
                id={purseId}
                type="range"
                min={10}
                max={200}
                step={5}
                value={pursePerTeam}
                onChange={(e) => setPursePerTeam(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-white/10 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                <span>10L Pts</span>
                <span>50L Pts</span>
                <span>100L Pts (1 Cr)</span>
                <span>200L Pts (2 Cr)</span>
              </div>
            </div>
          </div>

          {/* Dynamic Summary Card */}
          <div className="panel relative overflow-hidden p-6 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/50 to-black/60 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Setup Projection</span>
              <span className="inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] text-primary uppercase font-bold">
                <Sparkles className="h-3 w-3" /> Live Estimate
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="scoreboard-tile p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Squad Pool Size</span>
                <div className="font-display text-2xl text-foreground font-bold">{totalPlayers} Players</div>
                <span className="text-[10px] text-muted-foreground">~{cfg.defaultPlayersPerTeam} per team</span>
              </div>
              <div className="scoreboard-tile p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Room Duration</span>
                <div className="font-display text-2xl text-primary font-bold flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {durationText}
                </div>
                <span className="text-[10px] text-muted-foreground">{cfg.timerSec}s per player lot</span>
              </div>
            </div>

            <div className="scoreboard-tile p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Points Pool in Play</span>
                <div className="font-mono text-lg text-foreground font-bold">{totalPurse.toLocaleString("en-IN")} Lakh Pts</div>
              </div>
              <span className="text-[10px] font-mono text-primary uppercase">Virtual Purse</span>
            </div>

            <div className="rounded-lg border border-primary/40 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-primary">Recommended License</span>
                  <div className="font-display text-lg text-foreground font-bold">{planName}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-muted-foreground">One-time fee</span>
                  <div className="font-display text-xl text-primary font-bold">{planPrice}</div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                Includes operator console, mobile team owner bidding PWA, 1080p60 LED wall display, and squad CSV export.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={onStartTrial}
                className="gold-button gold-button-hover flex-1 rounded-md py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                Start Free Trial <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleWhatsAppConsult}
                className="ghost-button ghost-button-hover rounded-md px-4 py-3 text-xs font-semibold"
              >
                Chat on WhatsApp
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px] uppercase font-mono text-muted-foreground justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Points-based auction software · Zero money handling</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
