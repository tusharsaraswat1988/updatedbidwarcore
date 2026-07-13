import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearOnboardingEntries,
  loadOnboardingEntries,
  logoutTeamOwnerSession,
  saveOnboardingEntries,
  type OwnerOnboardingEntry,
} from "./api";
import {
  clearTeamOwnerSessionMarkers,
  isTeamOwnerSessionMarked,
  readTeamOwnerSessionContext,
  type TeamOwnerSessionContext,
} from "./session";

type TeamOwnerAuthState = {
  isAuthenticated: boolean;
  context: TeamOwnerSessionContext | null;
  onboardingEntries: OwnerOnboardingEntry[];
  mobile: string;
  setMobile: (mobile: string) => void;
  setOnboardingEntries: (entries: OwnerOnboardingEntry[]) => void;
  setContext: (ctx: TeamOwnerSessionContext | null) => void;
  logout: () => Promise<void>;
  clearOnboarding: () => void;
};

const TeamOwnerAuthContext = createContext<TeamOwnerAuthState | null>(null);

export function TeamOwnerAuthProvider({ children }: { children: ReactNode }) {
  const [context, setContextState] = useState<TeamOwnerSessionContext | null>(
    () => readTeamOwnerSessionContext(),
  );
  const [onboardingEntries, setOnboardingEntriesState] = useState<OwnerOnboardingEntry[]>(
    () => loadOnboardingEntries(),
  );
  const [mobile, setMobile] = useState(() => readTeamOwnerSessionContext()?.mobile ?? "");

  const setOnboardingEntries = useCallback((entries: OwnerOnboardingEntry[]) => {
    saveOnboardingEntries(entries);
    setOnboardingEntriesState(entries);
  }, []);

  const setContext = useCallback((ctx: TeamOwnerSessionContext | null) => {
    setContextState(ctx);
  }, []);

  const clearOnboarding = useCallback(() => {
    clearOnboardingEntries();
    setOnboardingEntriesState([]);
  }, []);

  const logout = useCallback(async () => {
    const ctx = readTeamOwnerSessionContext();
    if (ctx) {
      await logoutTeamOwnerSession(ctx.tournamentId, ctx.teamId);
    } else {
      clearTeamOwnerSessionMarkers();
      clearOnboardingEntries();
    }
    setContextState(null);
    setOnboardingEntriesState([]);
    setMobile("");
  }, []);

  const value = useMemo<TeamOwnerAuthState>(
    () => ({
      isAuthenticated: isTeamOwnerSessionMarked() && context != null,
      context,
      onboardingEntries,
      mobile,
      setMobile,
      setOnboardingEntries,
      setContext,
      logout,
      clearOnboarding,
    }),
    [context, onboardingEntries, mobile, setOnboardingEntries, setContext, logout, clearOnboarding],
  );

  return (
    <TeamOwnerAuthContext value={value}>
      {children}
    </TeamOwnerAuthContext>
  );
}

export function useTeamOwnerAuth(): TeamOwnerAuthState {
  const value = use(TeamOwnerAuthContext);
  if (!value) {
    throw new Error("useTeamOwnerAuth must be used within TeamOwnerAuthProvider");
  }
  return value;
}
