/**
 * Badminton Tournament Hub
 * Route: /tournament/:id/badminton
 *
 * Tournament Director's operations center.
 * Live KPI cards, active matches, quick actions.
 */

import { type ReactNode, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";
import type { BadmintonMatchState } from "@workspace/badminton-core";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function BadmintonTournamentHub() {
  const [, params] = useRoute("/tournament/:id/badminton");
  const tournamentId = parseInt(params?.id ?? "0");

  const { data, isLoading } = useBadmintonDashboard(tournamentId);

  if (isLoading) {
    return <HubSkeleton />;
  }

  const d = data ?? {};

  return (
    <div className="min-h-screen bg-[#060c1a] text-white">
      {/* Hero header */}
      <div className="bg-gradient-to-b from-[#0d1529] to-transparent border-b border-white/5 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-[#4fc3f7] font-semibold uppercase tracking-widest mb-1">
                Tournament Operations
              </p>
              <h1 className="text-3xl font-black text-white">Badminton Hub</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/tournament/${tournamentId}/badminton/players`}>
                <NavButton icon="👤" label="Players" />
              </Link>
              <Link href={`/tournament/${tournamentId}/badminton/courts`}>
                <NavButton icon="🏟" label="Courts" />
              </Link>
              <Link href={`/tournament/${tournamentId}/badminton/categories`}>
                <NavButton icon="🏆" label="Categories" />
              </Link>
              <Link href={`/tournament/${tournamentId}/badminton/matches`}>
                <NavButton icon="📋" label="Matches" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <KpiCard
            label="Total Players"
            value={d.totalPlayers ?? 0}
            icon="👤"
            color="blue"
          />
          <KpiCard
            label="Courts"
            value={d.totalCourts ?? 0}
            icon="🏟"
            color="cyan"
          />
          <KpiCard
            label="Categories"
            value={d.totalCategories ?? 0}
            icon="🏆"
            color="purple"
          />
          <KpiCard
            label="Scheduled"
            value={d.matchesScheduled ?? 0}
            icon="📅"
            color="gray"
          />
          <KpiCard
            label="Live Now"
            value={d.matchesLive ?? 0}
            icon="🔴"
            color="red"
            pulse={d.matchesLive > 0}
          />
          <KpiCard
            label="Completed"
            value={d.matchesCompleted ?? 0}
            icon="✅"
            color="green"
          />
        </div>

        {/* Live Matches */}
        {d.liveMatches?.length > 0 && (
          <section>
            <SectionHeader
              title="Live Matches"
              subtitle={`${d.liveMatches.length} match${d.liveMatches.length !== 1 ? "es" : ""} in progress`}
              badge="LIVE"
              badgeColor="red"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              {d.liveMatches.map((m: { id: number; detail: Record<string, unknown> | null; state: BadmintonMatchState | null }) => (
                <LiveMatchCard
                  key={m.id}
                  match={m}
                  tournamentId={tournamentId}
                />
              ))}
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section>
          <SectionHeader title="Quick Actions" subtitle="Common tournament operations" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Link href={`/tournament/${tournamentId}/badminton/players/add`}>
              <QuickAction
                icon="➕"
                title="Add Player"
                desc="Register a new player"
                color="blue"
              />
            </Link>
            <Link href={`/tournament/${tournamentId}/badminton/matches/create`}>
              <QuickAction
                icon="🎯"
                title="Create Match"
                desc="Start a new match"
                color="green"
              />
            </Link>
            <Link href={`/tournament/${tournamentId}/badminton/categories`}>
              <QuickAction
                icon="📋"
                title="Manage Draw"
                desc="Generate fixtures"
                color="purple"
              />
            </Link>
            <Link href={`/tournament/${tournamentId}/badminton/analytics`}>
              <QuickAction
                icon="📊"
                title="Analytics"
                desc="Tournament statistics"
                color="amber"
              />
            </Link>
          </div>
        </section>

        {/* Overlay Links */}
        <section>
          <SectionHeader
            title="Broadcast Links"
            subtitle="OBS-ready URLs — add as Browser Source"
          />
          <div className="bg-[#0d1529] rounded-2xl border border-white/5 p-5 mt-4 space-y-3">
            <p className="text-white/40 text-xs mb-3">
              Replace <code className="bg-white/10 px-1 rounded">MATCH_ID</code> with the actual match ID
            </p>
            <BroadcastLink
              label="Score Display (Full Screen)"
              url={`${window.location.origin}/badminton/MATCH_ID/display?tid=${tournamentId}`}
              desc="For LED walls and projectors"
            />
            <BroadcastLink
              label="Compact Score Overlay"
              url={`${window.location.origin}/badminton/MATCH_ID/overlay?tid=${tournamentId}&type=compact`}
              desc="Lower-third bar for streams"
            />
            <BroadcastLink
              label="Full Match Overlay"
              url={`${window.location.origin}/badminton/MATCH_ID/overlay?tid=${tournamentId}&type=full`}
              desc="Complete scorecard for streams"
            />
            <BroadcastLink
              label="Scorer Panel"
              url={`${window.location.origin}/badminton/MATCH_ID/score?tid=${tournamentId}&pin=YOUR_PIN`}
              desc="Mobile/tablet scoring interface"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavButton({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-3 py-2 cursor-pointer transition-colors">
      <span className="text-base">{icon}</span>
      <span className="text-white/70 text-sm font-medium">{label}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  pulse = false,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  pulse?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: "from-[#0070f3]/15 to-transparent border-[#0070f3]/20",
    cyan: "from-[#00e5ff]/15 to-transparent border-[#00e5ff]/20",
    purple: "from-[#7c3aed]/15 to-transparent border-[#7c3aed]/20",
    red: "from-[#ef4444]/15 to-transparent border-[#ef4444]/20",
    green: "from-[#22c55e]/15 to-transparent border-[#22c55e]/20",
    amber: "from-[#f59e0b]/15 to-transparent border-[#f59e0b]/20",
    gray: "from-white/8 to-transparent border-white/10",
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-b p-4 border",
        colorMap[color] ?? colorMap.gray,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {pulse && (
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      <p className="text-3xl font-black text-white tabular-nums">{value}</p>
      <p className="text-white/40 text-xs font-medium mt-1">{label}</p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  badge,
  badgeColor,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
}) {
  const badgeColorMap: Record<string, string> = {
    red: "bg-red-600/20 text-red-400 border-red-500/20",
    green: "bg-green-600/20 text-green-400 border-green-500/20",
    blue: "bg-blue-600/20 text-blue-400 border-blue-500/20",
  };

  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-lg font-black text-white">{title}</h2>
      {badge && (
        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", badgeColorMap[badgeColor ?? "blue"])}>
          {badge}
        </span>
      )}
      {subtitle && (
        <span className="text-white/30 text-sm">{subtitle}</span>
      )}
    </div>
  );
}

function LiveMatchCard({
  match,
  tournamentId,
}: {
  match: { id: number; detail: Record<string, unknown> | null; state: BadmintonMatchState | null };
  tournamentId: number;
}) {
  const state = match.state as BadmintonMatchState | null;
  const detail = match.detail ?? {};

  return (
    <div className="bg-[#0d1529] rounded-2xl border border-white/8 overflow-hidden hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">LIVE</span>
        </div>
        <div className="flex items-center gap-1.5">
          {detail.courtNumber ? (
            <span className="text-white/30 text-xs">Court {String(detail.courtNumber)}</span>
          ) : null}
          {detail.roundName ? (
            <span className="text-white/20 text-xs">• {String(detail.roundName)}</span>
          ) : null}
        </div>
      </div>

      {/* Score */}
      {state ? (
        <div className="p-4">
          <div className="flex items-center justify-between">
            {/* Left */}
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                {state.servingSide === "left" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
                )}
                <p className="text-white font-bold text-sm truncate">{state.leftSide.shortLabel}</p>
              </div>
              <p className="text-[#00e5ff] text-4xl font-black leading-none">{state.leftScore}</p>
            </div>

            {/* Centre */}
            <div className="flex flex-col items-center gap-1 px-3">
              <div className="text-white/20 text-xs">G{state.currentGame}</div>
              <div className="text-white/40 text-lg font-light">:</div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/50 text-sm font-black">{state.gamesLeft}</span>
                <span className="text-white/20 text-xs">–</span>
                <span className="text-white/50 text-sm font-black">{state.gamesRight}</span>
              </div>
            </div>

            {/* Right */}
            <div className="flex-1 text-right">
              <div className="flex items-center gap-1.5 mb-1 justify-end">
                <p className="text-white font-bold text-sm truncate">{state.rightSide.shortLabel}</p>
                {state.servingSide === "right" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
                )}
              </div>
              <p className="text-[#ff6b6b] text-4xl font-black leading-none text-right">{state.rightScore}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4">
            <Link
              href={`/badminton/${match.id}/score?tid=${tournamentId}`}
              className="flex-1 h-9 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/60 text-xs font-semibold flex items-center justify-center transition-colors"
            >
              Score
            </Link>
            <Link
              href={`/badminton/${match.id}/display?tid=${tournamentId}`}
              className="flex-1 h-9 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/60 text-xs font-semibold flex items-center justify-center transition-colors"
            >
              Display
            </Link>
            <Link
              href={`/badminton/${match.id}/overlay?tid=${tournamentId}`}
              className="flex-1 h-9 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/60 text-xs font-semibold flex items-center justify-center transition-colors"
            >
              OBS
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-white/30 text-sm text-center">Match #{match.id}</p>
        </div>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  color,
}: {
  icon: string;
  title: string;
  desc: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "hover:border-[#0070f3]/30 hover:bg-[#0070f3]/5",
    green: "hover:border-green-500/30 hover:bg-green-500/5",
    purple: "hover:border-purple-500/30 hover:bg-purple-500/5",
    amber: "hover:border-amber-500/30 hover:bg-amber-500/5",
  };

  return (
    <div className={cn(
      "rounded-2xl bg-white/3 border border-white/8 p-4 cursor-pointer transition-all",
      colorMap[color] ?? "",
    )}>
      <div className="text-3xl mb-3">{icon}</div>
      <p className="text-white font-bold text-sm">{title}</p>
      <p className="text-white/40 text-xs mt-0.5">{desc}</p>
    </div>
  );
}

function BroadcastLink({
  label,
  url,
  desc,
}: {
  label: string;
  url: string;
  desc: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-3 bg-white/4 rounded-xl p-3 group">
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-sm font-semibold">{label}</p>
        <p className="text-white/30 text-[11px] mt-0.5">{desc}</p>
        <code className="text-[#4fc3f7]/70 text-[10px] mt-1 block truncate">{url}</code>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="flex-none h-8 px-3 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 text-white/50 text-xs font-medium transition-colors"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

function HubSkeleton() {
  return (
    <div className="min-h-screen bg-[#060c1a] p-6 space-y-6 animate-pulse">
      <div className="h-24 rounded-2xl bg-white/4" />
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/4" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white/4" />
    </div>
  );
}
