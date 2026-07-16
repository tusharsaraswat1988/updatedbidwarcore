import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkOrganizerAuth, bootstrapLocalOrganizer, loginOrganizer, logoutOrganizer,
  checkAdminAuth, loginAdmin, logoutAdmin,
} from "@/lib/auth";
import { isBidWarLocalHost } from "@/lib/local-mode-host";

export function organizerAuthQueryKey(tournamentId: number) {
  return ["organizer-auth", tournamentId] as const;
}

async function resolveOrganizerAuth(tournamentId: number): Promise<boolean> {
  let ok = await checkOrganizerAuth(tournamentId);
  if (!ok && isBidWarLocalHost()) {
    await bootstrapLocalOrganizer(tournamentId);
    ok = await checkOrganizerAuth(tournamentId);
  }
  return ok;
}

export function useOrganizerAuth(tournamentId: number) {
  const queryClient = useQueryClient();
  const enabled = tournamentId > 0;

  const { data, isPending, refetch } = useQuery({
    queryKey: organizerAuthQueryKey(tournamentId),
    queryFn: () => resolveOrganizerAuth(tournamentId),
    enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const isLoggedIn = data === true;
  // Remounts with warm cache must not blank the page waiting on auth.
  const isLoading = enabled && isPending && data === undefined;

  const login = useCallback(async (password: string) => {
    const result = await loginOrganizer(tournamentId, password);
    if (result.success) {
      queryClient.setQueryData(organizerAuthQueryKey(tournamentId), true);
    }
    return result;
  }, [tournamentId, queryClient]);

  const logout = useCallback(async () => {
    await logoutOrganizer(tournamentId);
    queryClient.setQueryData(organizerAuthQueryKey(tournamentId), false);
  }, [tournamentId, queryClient]);

  return {
    isLoggedIn,
    isLoading,
    login,
    logout,
    refetch: async () => {
      await refetch();
    },
  };
}

export function useAdminAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminLevel, setAdminLevel] = useState<"master" | "data_entry" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    setIsLoading(true);
    const result = await checkAdminAuth();
    setIsLoggedIn(result.isAdmin);
    setAdminLevel(result.adminLevel);
    setIsLoading(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  const login = useCallback(async (password: string) => {
    const result = await loginAdmin(password);
    if (result.success) {
      setIsLoggedIn(true);
      setAdminLevel(result.adminLevel ?? null);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutAdmin();
    setIsLoggedIn(false);
    setAdminLevel(null);
  }, []);

  return { isLoggedIn, adminLevel, isMaster: adminLevel === "master", isLoading, login, logout };
}
