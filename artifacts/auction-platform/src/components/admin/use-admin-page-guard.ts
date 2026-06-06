import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-auth";

export function useAdminPageGuard() {
  const { isLoggedIn, isLoading, isMaster, adminLevel } = useAdminAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoading, isLoggedIn, navigate]);

  return { isLoggedIn, isLoading, isMaster, adminLevel };
}
