const API = "/api";

async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
}

export async function checkOrganizerAuth(tournamentId: number): Promise<boolean> {
  try {
    const r = await apiFetch(`/auth/organizer/${tournamentId}/me`);
    if (!r.ok) return false;
    const data = await r.json();
    return !!data.isOrganizer;
  } catch { return false; }
}

export async function loginOrganizer(tournamentId: number, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/organizer/${tournamentId}/login`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    const data = await r.json();
    if (!r.ok) return { success: false, error: data.error || "Login failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function logoutOrganizer(tournamentId: number): Promise<void> {
  try { await apiFetch(`/auth/organizer/${tournamentId}/logout`, { method: "POST" }); } catch { }
}

export async function setOrganizerPassword(tournamentId: number, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/organizer/${tournamentId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password }),
    });
    const data = await r.json();
    if (!r.ok) return { success: false, error: data.error || "Failed to set password" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function checkAdminAuth(): Promise<boolean> {
  try {
    const r = await apiFetch("/auth/admin/me");
    if (!r.ok) return false;
    const data = await r.json();
    return !!data.isAdmin;
  } catch { return false; }
}

export async function loginAdmin(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    const data = await r.json();
    if (!r.ok) return { success: false, error: data.error || "Login failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function logoutAdmin(): Promise<void> {
  try { await apiFetch("/auth/admin/logout", { method: "POST" }); } catch { }
}

export async function listAdminTournaments(): Promise<Array<{
  id: number; name: string; sport: string; status: string; organizerName: string | null; hasPassword: boolean;
}>> {
  try {
    const r = await apiFetch("/auth/admin/tournaments");
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}
