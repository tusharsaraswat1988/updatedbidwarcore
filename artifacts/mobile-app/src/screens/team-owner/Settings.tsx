import { useEffect } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/AppShell";
import { SwitchRoleButton } from "@/components/SwitchRoleButton";
import { useTeamOwnerAuth } from "@/auth/team-owner/AuthContext";

export function TeamOwnerSettingsScreen() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, context, logout } = useTeamOwnerAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/team-owner/login");
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]" aria-busy="true">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    setLocation("/team-owner/login");
  }

  return (
    <AppShell>
      <header className="px-5 py-4 border-b border-[#27272a] flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (context) {
              setLocation(`/team-owner/panel/${context.tournamentId}/${context.teamId}`);
            } else {
              setLocation("/team-owner/login");
            }
          }}
          className="text-sm font-semibold text-[#a1a1aa]"
        >
          Back
        </button>
        <h1 className="font-display font-bold text-xl text-white">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-[#52525b] font-semibold">Session</p>
          <div className="rounded-2xl border border-[#27272a] bg-[#18181b] px-4 py-4">
            {context ? (
              <>
                <p className="text-white font-semibold">{context.teamName}</p>
                <p className="text-[#71717a] text-sm mt-1">{context.tournamentName}</p>
              </>
            ) : (
              <p className="text-[#71717a] text-sm">No active Team Owner session</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-[#52525b] font-semibold">Role</p>
          <div className="rounded-2xl border border-[#27272a] bg-[#18181b] px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Switch Role</p>
              <p className="text-[#71717a] text-sm mt-1">
                Change to Organizer without clearing this Team Owner session.
              </p>
            </div>
            <SwitchRoleButton className="text-amber-400 font-semibold text-sm shrink-0 ml-3" />
          </div>
        </section>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full py-4 rounded-2xl border border-red-500/40 text-red-400 font-semibold"
        >
          Log out Team Owner
        </button>
        <p className="text-[#52525b] text-xs text-center leading-relaxed">
          Logging out here only clears the Team Owner session. Any Organizer session stays active.
        </p>
      </div>
    </AppShell>
  );
}
