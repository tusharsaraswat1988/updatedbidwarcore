import { useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/AppShell";
import { useOrganizerAuth } from "@/auth/organizer/AuthContext";

export function OrganizerDashboardScreen() {
  const [, setLocation] = useLocation();
  const { isLoading, isLoggedIn, organizer, tournaments } = useOrganizerAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      setLocation("/organizer/login");
    }
  }, [isLoading, isLoggedIn, setLocation]);

  if (isLoading || !isLoggedIn) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]" aria-busy="true">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppShell>
      <header className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
        <div>
          <p className="font-display font-black text-amber-400 text-lg">BidWar</p>
          <p className="text-[#a1a1aa] text-sm">Organizer Dashboard</p>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/organizer/settings")}
          className="w-10 h-10 rounded-xl border border-[#3f3f46] flex items-center justify-center text-[#a1a1aa] hover:text-white"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div>
          <h1 className="font-display font-black text-2xl text-white">
            Hello, {organizer?.name?.split(" ")[0] || "Organizer"}
          </h1>
          <p className="text-[#71717a] text-sm mt-1">
            Your tournaments — open the full console on the web for management tools.
          </p>
        </div>

        {tournaments.length === 0 ? (
          <div className="rounded-2xl border border-[#27272a] bg-[#18181b] px-5 py-8 text-center">
            <p className="text-[#a1a1aa] text-sm">No tournaments yet.</p>
            <a
              href="/organizer"
              className="inline-flex items-center gap-2 mt-4 text-amber-400 font-semibold text-sm"
            >
              Open organizer portal <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <ul className="space-y-3">
            {tournaments.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <a
                  href={`/tournament/${t.id}`}
                  className="block rounded-2xl border border-[#27272a] bg-[#18181b] px-4 py-4 hover:border-amber-400/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{t.name}</p>
                      <p className="text-[#71717a] text-xs mt-1 uppercase tracking-wider">
                        {t.sport} · {t.status}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#52525b] shrink-0 mt-1" />
                  </div>
                </a>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
