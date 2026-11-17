import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Trophy,
  Calendar,
  MapPin,
  Share2,
  Copy,
  Check,
  ArrowLeft,
  Shield,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import {
  getBrandLogoAlt,
  getBrandLogoSrc,
  getBrandWordmarkSrc,
  isBrandLogoPlaceholderSrc,
} from "@/lib/brand-assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatFanDateTime } from "@/lib/fan-date-utils";

interface UnlicensedTeamSummary {
  id: number;
  name: string;
  shortCode?: string | null;
  logoUrl?: string | null;
  color?: string | null;
  playerCount: number;
}

interface UnlicensedFanViewProps {
  tournament: {
    id: number;
    name: string;
    sport?: string | null;
    city?: string | null;
    venue?: string | null;
    auctionDate?: string | null;
    auctionTime?: string | null;
    matchDates?: string | null;
    logoUrl?: string | null;
    status?: string;
  };
}

export function UnlicensedFanView({ tournament }: UnlicensedFanViewProps) {
  const { logos, brandName } = useBranding();
  const miniLogoSrc = getBrandLogoSrc(logos, ["mini", "appIcon"]);
  const mainWordmarkSrc = getBrandWordmarkSrc(logos, ["mainReverse", "main"]);
  const logoAlt = getBrandLogoAlt(brandName);

  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fanPageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tournament/${tournament.id}/fan`
      : "";

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fanPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch allowlisted teams summary (name, logo, playerCount only)
  const { data: teamsData, isLoading: isLoadingTeams } = useQuery<UnlicensedTeamSummary[] | { teams: UnlicensedTeamSummary[] }>({
    queryKey: ["unlicensed-tournament-teams", tournament.id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournament.id}/teams?scope=spectator`);
      if (!res.ok) {
        throw new Error("Failed to load teams");
      }
      return res.json();
    },
    enabled: tournament.id > 0,
    staleTime: 30_000,
  });

  const teams = Array.isArray(teamsData) ? teamsData : (teamsData?.teams ?? []);

  return (
    <div
      data-theme="dark"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200"
    >
      {/* ── Top Header / Navigation ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/fan"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Fan Arena</span>
            </Link>

            <div className="h-4 w-px bg-white/10 hidden sm:block" />

            <Link href="/" className="flex items-center gap-2 group">
              {miniLogoSrc && !isBrandLogoPlaceholderSrc(miniLogoSrc) ? (
                <img
                  src={miniLogoSrc}
                  alt={logoAlt}
                  className="w-7 h-7 object-contain rounded-lg transition-transform group-hover:scale-105"
                />
              ) : null}
              {mainWordmarkSrc && !isBrandLogoPlaceholderSrc(mainWordmarkSrc) ? (
                <img
                  src={mainWordmarkSrc}
                  alt={brandName}
                  className="h-5 w-auto object-contain hidden md:block"
                />
              ) : (
                <span className="font-display font-black text-sm tracking-tight text-white hidden md:inline">
                  {brandName}
                </span>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              title="Share Tournament"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Tournament Hero Card */}
        <section
          aria-label="Tournament Header"
          className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6 sm:p-8 backdrop-blur-sm"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            {tournament.logoUrl ? (
              <img
                src={tournament.logoUrl}
                alt={tournament.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-white/[0.05] border border-white/10 shrink-0 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
                <Trophy className="w-10 h-10" />
              </div>
            )}

            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {tournament.sport || "Sport"}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/[0.06] text-slate-300 border border-white/10 capitalize">
                  {tournament.status || "Upcoming"}
                </span>
              </div>

              <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-tight">
                {tournament.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 pt-1">
                {(tournament.venue || tournament.city) && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      {tournament.venue ? `${tournament.venue}, ` : ""}
                      {tournament.city}
                    </span>
                  </span>
                )}

                {tournament.auctionDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      {formatFanDateTime(tournament.auctionDate, tournament.auctionTime)}
                    </span>
                  </span>
                )}

                {tournament.matchDates && !tournament.auctionDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{tournament.matchDates}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Notice Banner: Limited Experience ────────────────────────────── */}
        <section
          aria-label="Limited Spectator Experience Notice"
          className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 sm:p-5 flex items-start gap-3.5"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <Shield className="w-4 h-4" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="text-sm font-bold text-amber-200">
              Limited Public Tournament Overview
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              This tournament is discoverable on BidWar. Full spectator features — including live ball-by-ball scorecards, match updates, complete player rosters, statistics, points tables, and live auction rooms — become available when this tournament is licensed with BidWar.
            </p>
          </div>
        </section>

        {/* ── Registered Teams Section ──────────────────────────────────────── */}
        <section aria-label="Participating Teams" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h2 className="font-display font-black text-lg text-white">
                Participating Teams
              </h2>
              {teams.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/10 font-bold">
                  {teams.length}
                </span>
              )}
            </div>
          </div>

          {isLoadingTeams ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span>Loading participating teams...</span>
            </div>
          ) : teams.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No teams registered yet</p>
              <p className="text-xs text-slate-500">
                Team details will appear here as soon as teams are registered by the tournament organisers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] p-4 flex items-center justify-between gap-3 transition-colors shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {team.logoUrl ? (
                      <img
                        src={team.logoUrl}
                        alt={team.name}
                        className="w-12 h-12 rounded-xl object-cover bg-white/[0.05] border border-white/10 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 border border-white/10"
                        style={{ backgroundColor: team.color || "#334155" }}
                      >
                        {(team.shortCode || team.name).substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {team.name}
                      </h3>
                      {team.shortCode && (
                        <p className="text-[11px] font-mono text-slate-400 uppercase">
                          {team.shortCode}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-semibold text-slate-200">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>{team.playerCount} {team.playerCount === 1 ? "Player" : "Players"}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Share Tournament Dialog ────────────────────────────────────────── */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">Share Tournament Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-400">
              Share this tournament link with spectators, fans, and players.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fanPageUrl}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
