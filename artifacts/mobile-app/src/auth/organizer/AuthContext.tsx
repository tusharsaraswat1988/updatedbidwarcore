import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  checkOrganizerAccountAuth,
  loginOrganizerAccount,
  logoutOrganizerAccount,
  type OrganizerInfo,
  type OrganizerTournament,
} from "./api";
import { readOrganizerProfileCache } from "./session";

type OrganizerAuthState = {
  isLoading: boolean;
  isLoggedIn: boolean;
  organizer: OrganizerInfo | null;
  tournaments: OrganizerTournament[];
  login: (
    identifier: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const OrganizerAuthContext = createContext<OrganizerAuthState | null>(null);

export function OrganizerAuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [organizer, setOrganizer] = useState<OrganizerInfo | null>(
    () => readOrganizerProfileCache() as OrganizerInfo | null,
  );
  const [tournaments, setTournaments] = useState<OrganizerTournament[]>([]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const result = await checkOrganizerAccountAuth();
    setIsLoggedIn(result.loggedIn);
    setOrganizer(result.organizer ?? null);
    setTournaments(result.tournaments ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await loginOrganizerAccount(identifier, password);
    if (result.success) {
      setIsLoggedIn(true);
      setOrganizer(result.organizer ?? null);
      setTournaments(result.tournaments ?? []);
    }
    return { success: result.success, error: result.error };
  }, []);

  const logout = useCallback(async () => {
    await logoutOrganizerAccount();
    setIsLoggedIn(false);
    setOrganizer(null);
    setTournaments([]);
  }, []);

  return (
    <OrganizerAuthContext
      value={{
        isLoading,
        isLoggedIn,
        organizer,
        tournaments,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </OrganizerAuthContext>
  );
}

export function useOrganizerAuth(): OrganizerAuthState {
  const value = use(OrganizerAuthContext);
  if (!value) {
    throw new Error("useOrganizerAuth must be used within OrganizerAuthProvider");
  }
  return value;
}
