import { useState } from "react";
import { PlayerSoldPosterV2 } from "@/components/posters/player-sold-poster-v2";
import type { AuctionUnit } from "@/lib/format";

/**
 * Standalone preview page for the PlayerSoldPosterV2 SOLD Edition design.
 *
 * Route: /poster-v2-preview  (add to platform-app.tsx when wiring up)
 *
 * This page is NOT production code — it is a design approval sandbox.
 * Do not link this page from any public navigation or production flow.
 */
export default function SoldPosterV2PreviewPage() {
  const [playerName, setPlayerName] = useState("Tushar Saraswat");
  const [teamName, setTeamName] = useState("DPS Champions");
  const [amount, setAmount] = useState("10000");
  const [tournamentName, setTournamentName] = useState("BidWar Premier League");
  const [auctionUnit, setAuctionUnit] = useState<AuctionUnit>("points");
  const [playerRole, setPlayerRole] = useState("All-Rounder");
  const [teamShortCode, setTeamShortCode] = useState("DPS");

  // Real photo / logo from Cloudinary (use actual URLs from your DB here)
  const [playerPhotoUrl, setPlayerPhotoUrl] = useState<string>("");
  const [teamLogoUrl, setTeamLogoUrl] = useState<string>("");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-wide text-amber-400">
            SOLD Edition Poster V2 — Design Preview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Standalone preview sandbox. Not production. Approval required before replacing V1.
          </p>
        </div>
        <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-2 py-1">
          PREVIEW ONLY
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 p-6 max-w-6xl mx-auto">

        {/* ── Live preview panel ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mb-3">
            Live Preview (1080 × 1350 scaled)
          </p>
          <div className="w-full max-w-sm">
            <PlayerSoldPosterV2
              playerName={playerName}
              playerPhotoUrl={playerPhotoUrl || undefined}
              playerRole={playerRole || undefined}
              teamName={teamName}
              teamLogoUrl={teamLogoUrl || undefined}
              teamShortCode={teamShortCode || undefined}
              amount={amount}
              tournamentName={tournamentName}
              auctionUnit={auctionUnit}
              showDownloadButton={true}
            />
          </div>
        </div>

        {/* ── Controls panel ─────────────────────────────────────────── */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-black text-white mb-4 uppercase tracking-wide">
              Test Data
            </h2>

            <div className="flex flex-col gap-3">
              <Field
                label="Player Name"
                value={playerName}
                onChange={setPlayerName}
                placeholder="e.g. Tushar Saraswat"
              />
              <Field
                label="Player Role"
                value={playerRole}
                onChange={setPlayerRole}
                placeholder="e.g. All-Rounder"
              />
              <Field
                label="Team Name"
                value={teamName}
                onChange={setTeamName}
                placeholder="e.g. DPS Champions"
              />
              <Field
                label="Team Short Code"
                value={teamShortCode}
                onChange={setTeamShortCode}
                placeholder="e.g. DPS"
                maxLength={4}
              />
              <Field
                label="Amount"
                value={amount}
                onChange={setAmount}
                placeholder="e.g. 10000"
                type="number"
              />

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                  Auction Unit
                </label>
                <select
                  value={auctionUnit}
                  onChange={(e) => setAuctionUnit(e.target.value as AuctionUnit)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="points">Points</option>
                  <option value="rupee">Rupees (₹)</option>
                </select>
              </div>

              <Field
                label="Tournament Name"
                value={tournamentName}
                onChange={setTournamentName}
                placeholder="e.g. BidWar Premier League"
              />

              <Field
                label="Player Photo URL (Cloudinary)"
                value={playerPhotoUrl}
                onChange={setPlayerPhotoUrl}
                placeholder="https://res.cloudinary.com/..."
              />
              <Field
                label="Team Logo URL (Cloudinary)"
                value={teamLogoUrl}
                onChange={setTeamLogoUrl}
                placeholder="https://res.cloudinary.com/..."
              />
            </div>
          </div>

          {/* Long-name stress tests */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Quick Stress Tests
            </h2>
            <div className="flex flex-col gap-2">
              {STRESS_TESTS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setPlayerName(t.playerName);
                    setTeamName(t.teamName);
                    setAmount(String(t.amount));
                    setAuctionUnit(t.unit as AuctionUnit);
                    if (t.role) setPlayerRole(t.role);
                    if (t.short) setTeamShortCode(t.short);
                    if (t.tournament) setTournamentName(t.tournament);
                    if (t.photo !== undefined) setPlayerPhotoUrl(t.photo);
                    if (t.logo !== undefined) setTeamLogoUrl(t.logo);
                  }}
                  className="text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-semibold transition"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Design notes */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-[10px] text-slate-500 leading-relaxed">
            <p className="font-bold text-slate-400 mb-2 uppercase tracking-wider text-[9px]">Design Notes</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Player portrait is the hero — fill photo URL above</li>
              <li>Name splits on first word boundary (line 1 = white, line 2 = gold)</li>
              <li>SOLD FOR bar is brushed gold — amount in dark navy</li>
              <li>Giant "SOLD" watermark sits behind the portrait</li>
              <li>Output dimensions: 1080 × 1350 px (4:5)</li>
              <li>Download uses html2canvas-pro at 2× scale</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helper component ────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
      />
    </div>
  );
}

// ── Stress test presets ──────────────────────────────────────────────────────

const STRESS_TESTS = [
  {
    label: "Default — Tushar Saraswat (DPS Champions, 10K pts)",
    playerName: "Tushar Saraswat",
    teamName: "DPS Champions",
    amount: 10000,
    unit: "points",
    role: "All-Rounder",
    short: "DPS",
    tournament: "BidWar Premier League",
    photo: "",
    logo: "",
  },
  {
    label: "Real Live Sale — Animesh Thakur (Team B, ₹40,000)",
    playerName: "Animesh Thakur",
    teamName: "Team B",
    amount: 40000,
    unit: "rupee",
    role: "Doubles Player",
    short: "TB",
    tournament: "Vyapari Network Badminton League",
    photo: "https://res.cloudinary.com/bidwar/image/upload/v1731500000/sample_player.jpg",
    logo: "",
  },
  {
    label: "Long name — Krishnamurthy Venkataraman",
    playerName: "Krishnamurthy Venkataraman",
    teamName: "Royal Challengers",
    amount: 75000,
    unit: "rupee",
    role: "Batsman",
    short: "RCB",
    tournament: "BidWar South Premier League 2026",
    photo: "",
    logo: "",
  },
  {
    label: "Short name — Ali Khan",
    playerName: "Ali Khan",
    teamName: "Warriors",
    amount: 5000,
    unit: "points",
    role: "Bowler",
    short: "WAR",
    tournament: "National Super T20 Cup",
    photo: "",
    logo: "",
  },
  {
    label: "Single name — Dhoni",
    playerName: "Dhoni",
    teamName: "Chennai Super Kings",
    amount: 1500000,
    unit: "rupee",
    role: "Wicket-Keeper",
    short: "CSK",
    tournament: "IPL Mega Auction 2026",
    photo: "",
    logo: "",
  },
  {
    label: "Long team + huge amount — ₹1,25,00,000",
    playerName: "Rahul Dravid",
    teamName: "Rajasthan Royals Premier XI",
    amount: 12500000,
    unit: "rupee",
    role: "Master Batsman",
    short: "RR",
    tournament: "All India Corporate Cricket Championship",
    photo: "",
    logo: "",
  },
  {
    label: "Missing Assets (Crest & Shortcode fallbacks)",
    playerName: "Suresh Raina",
    teamName: "Kolkata Knight Riders",
    amount: 850000,
    unit: "rupee",
    role: "All-Rounder",
    short: "KKR",
    tournament: "BPL Premier Tournament",
    photo: "",
    logo: "",
  },
];
