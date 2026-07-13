import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Settings, Zap } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { ownerDashboardAppPath, OWNER_APP_BASE } from "@workspace/api-base/owner-urls";
import { AppShell } from "@/components/AppShell";
import { useTeamOwnerAuth } from "@/auth/team-owner/AuthContext";
import { isOwnerSessionVerified } from "@workspace/api-base/owner-auth";

/**
 * Step 4 — Team Owner Panel.
 * Session is already established via verify-access; live bidding stays in owner-app.
 */
export function TeamOwnerPanelScreen() {
  const params = useParams<{ tournamentId: string; teamId: string }>();
  const tournamentId = parseInt(params.tournamentId || "0", 10);
  const teamId = parseInt(params.teamId || "0", 10);
  const [, setLocation] = useLocation();
  const { context, isAuthenticated } = useTeamOwnerAuth();

  const livePath = useMemo(() => {
    return `${OWNER_APP_BASE}${ownerDashboardAppPath(tournamentId, teamId)}`;
  }, [tournamentId, teamId]);

  useEffect(() => {
    const sessionOk =
      isAuthenticated &&
      context?.tournamentId === tournamentId &&
      context?.teamId === teamId &&
      isOwnerSessionVerified(teamId);

    if (!sessionOk) {
      setLocation("/team-owner/login");
    }
  }, [isAuthenticated, context, tournamentId, teamId, setLocation]);

  if (!context || context.tournamentId !== tournamentId || context.teamId !== teamId) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]" aria-busy="true">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const accent = context.teamColor || "#f59e0b";

  return (
    <AppShell>
      <header className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
        <div>
          <p className="font-display font-black text-amber-400 text-lg">BidWar</p>
          <p className="text-[#a1a1aa] text-sm">Team Owner Panel</p>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/team-owner/settings")}
          className="w-10 h-10 rounded-xl border border-[#3f3f46] flex items-center justify-center text-[#a1a1aa]"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#27272a] bg-[#18181b] px-5 py-6"
          style={{ borderTopColor: accent, borderTopWidth: 3 }}
        >
          <p className="text-[#71717a] text-xs uppercase tracking-wider font-semibold">Team</p>
          <h1 className="font-display font-black text-3xl text-white mt-2">{context.teamName}</h1>
          <p className="text-[#a1a1aa] mt-2">{context.tournamentName}</p>
          <p className="text-[#52525b] text-sm mt-3 font-semibold tracking-wider">
            {context.teamShortCode}
          </p>
        </motion.div>

        <a
          href={livePath}
          className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl font-display font-black text-xl text-black bg-amber-400"
          style={{ boxShadow: "0 0 32px rgba(245,158,11,0.25)" }}
        >
          <Zap className="w-6 h-6" />
          Enter Live Auction
          <ExternalLink className="w-5 h-5" />
        </a>

        <p className="text-[#52525b] text-xs text-center leading-relaxed">
          Live bidding uses the existing Team Owner auction panel. Your access session stays active
          independently from any Organizer login.
        </p>
      </div>
    </AppShell>
  );
}
