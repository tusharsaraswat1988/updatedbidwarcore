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
  id: number; name: string; sport: string; status: string;
  organizerName: string | null; organizerMobile: string | null;
  organizerEmail: string | null; hasPassword: boolean; createdAt: string;
}>> {
  try {
    const r = await apiFetch("/auth/admin/tournaments");
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}

export async function fetchAdminTournamentDetail(tournamentId: number): Promise<null | {
  tournament: {
    id: number; name: string; sport: string; venue: string | null;
    auctionDate: string | null; organizerName: string | null;
    organizerMobile: string | null; organizerEmail: string | null;
    status: string; basePurse: number; timerSeconds: number; bidTimerSeconds: number;
  };
  teams: Array<{ id: number; name: string; shortCode: string; ownerName: string; color: string | null; purse: number; purseUsed: number }>;
  playerCounts: { total: number; available: number; sold: number; unsold: number; retained: number };
  recentBids: Array<{ id: number; amount: number; timestamp: string; playerName: string | null; teamName: string | null; teamColor: string | null }>;
}> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/detail`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export async function updateAdminTournament(
  tournamentId: number,
  data: Partial<{ name: string; organizerName: string; organizerMobile: string; organizerEmail: string; organizerPassword: string; venue: string; status: string; timerSeconds: number; bidTimerSeconds: number }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Update failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

// ─── Organizer Account ────────────────────────────────────────────────────────

export async function signupOrganizerAccount(data: {
  name: string; email: string; mobile: string; password: string;
}): Promise<{ success: boolean; error?: string; organizer?: { id: number; name: string; email: string; mobile: string } }> {
  try {
    const r = await apiFetch("/auth/organizer-account/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Signup failed" };
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

export async function loginOrganizerAccount(
  identifier: string,
  password: string
): Promise<{ success: boolean; error?: string; organizer?: { id: number; name: string; email: string; mobile: string } }> {
  try {
    const r = await apiFetch("/auth/organizer-account/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Login failed" };
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

export async function checkOrganizerAccountAuth(): Promise<{
  loggedIn: boolean;
  organizer?: { id: number; name: string; email: string; mobile: string };
  tournaments?: Array<{ id: number; name: string; sport: string; status: string; venue: string | null; auctionDate: string | null }>;
}> {
  try {
    const r = await apiFetch("/auth/organizer-account/me");
    if (!r.ok) return { loggedIn: false };
    return r.json();
  } catch { return { loggedIn: false }; }
}

export async function logoutOrganizerAccount(): Promise<void> {
  try { await apiFetch("/auth/organizer-account/logout", { method: "POST" }); } catch { }
}
