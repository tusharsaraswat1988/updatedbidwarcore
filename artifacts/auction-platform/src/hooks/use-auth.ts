import { useState, useEffect, useCallback } from "react";
import {
  checkOrganizerAuth, loginOrganizer, logoutOrganizer,
  checkAdminAuth, loginAdmin, logoutAdmin,
} from "@/lib/auth";

export function useOrganizerAuth(tournamentId: number) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    if (!tournamentId) { setIsLoading(false); return; }
    setIsLoading(true);
    const ok = await checkOrganizerAuth(tournamentId);
    setIsLoggedIn(ok);
    setIsLoading(false);
  }, [tournamentId]);

  useEffect(() => { check(); }, [check]);

  const login = useCallback(async (password: string) => {
    const result = await loginOrganizer(tournamentId, password);
    if (result.success) setIsLoggedIn(true);
    return result;
  }, [tournamentId]);

  const logout = useCallback(async () => {
    await logoutOrganizer(tournamentId);
    setIsLoggedIn(false);
  }, [tournamentId]);

  return { isLoggedIn, isLoading, login, logout, refetch: check };
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
