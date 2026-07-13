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
  type LoginGuardStatus,
  type OrganizerInfo,
  type OrganizerTournament,
} from "./api";
import { readOrganizerProfileCache } from "./session";

type OrganizerAuthState = {
  isLoading: boolean;
  isLoggedIn: boolean;
  /** True when /me failed for non-auth reasons — do not treat as logged out. */
  serverError: boolean;
  organizer: OrganizerInfo | null;
  tournaments: OrganizerTournament[];
  login: (
    identifier: string,
    password: string,
    captcha?: {
      turnstileToken?: string;
      captchaId?: string;
      captchaAnswer?: string;
    },
  ) => Promise<{ success: boolean; error?: string; loginGuard?: LoginGuardStatus }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const OrganizerAuthContext = createContext<OrganizerAuthState | null>(null);

export function OrganizerAuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [organizer, setOrganizer] = useState<OrganizerInfo | null>(
    () => readOrganizerProfileCache() as OrganizerInfo | null,
  );
  const [tournaments, setTournaments] = useState<OrganizerTournament[]>([]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const result = await checkOrganizerAccountAuth();
    if (result.serverError) {
      // Keep prior session UI; do not flip to logged out on transient failures.
      setServerError(true);
      setIsLoading(false);
      return;
    }
    setServerError(false);
    setIsLoggedIn(result.loggedIn);
    setOrganizer(result.organizer ?? null);
    setTournaments(result.tournaments ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (
      identifier: string,
      password: string,
      captcha?: {
        turnstileToken?: string;
        captchaId?: string;
        captchaAnswer?: string;
      },
    ) => {
      const result = await loginOrganizerAccount(identifier, password, captcha);
      if (result.success) {
        setServerError(false);
        setIsLoggedIn(true);
        setOrganizer(result.organizer ?? null);
        setTournaments(result.tournaments ?? []);
      }
      return {
        success: result.success,
        error: result.error,
        loginGuard: result.loginGuard,
      };
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutOrganizerAccount();
    setServerError(false);
    setIsLoggedIn(false);
    setOrganizer(null);
    setTournaments([]);
  }, []);

  return (
    <OrganizerAuthContext
      value={{
        isLoading,
        isLoggedIn,
        serverError,
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
