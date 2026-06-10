import { createServerFn } from "@tanstack/react-start";

// Serializable snapshot used by the LED V1 view. Polled every ~500ms.
export type LiveTeamDTO = {
  id: string;
  name: string;
  short: string;
  color: string;
  logoUrl: string | null;
  purse: number;
  totalPurse: number;
  squadCount: number;
};

export type LivePlayerDTO = {
  id: string;
  name: string;
  roleRaw: string | null;
  roleCode: "BAT" | "BOWL" | "AR" | "WK";
  basePrice: number;
  soldPrice: number | null;
  city: string;
  age: number;
  battingHand: "Right" | "Left";
  jerseyNo: number;
  portrait: string;
  status: "queue" | "live" | "sold" | "unsold" | "retained";
  soldToTeamId: string | null;
};

export type LiveBidDTO = {
  id: string;
  teamId: string;
  amount: number;
  ts: string;
};

export type LiveSponsorDTO = {
  name: string;
  type: string;
  logoUrl: string;
};

export type LiveBrandingDTO = {
  brandName: string;
  miniBrandText: string;
  poweredByText: string;
  mainLogoUrl: string | null;
  miniLogoUrl: string | null;
  primaryColor: string;
  accentColor: string;
};

export type LiveLastOutcome = {
  type: "sold" | "unsold";
  playerId: number;
  playerName?: string;
  teamId?: number;
  teamName?: string;
  amount?: number;
  photoUrl?: string;
  teamLogoUrl?: string;
  teamColor?: string;
};

export type LiveToast = {
  teamName?: string;
  message?: string;
  expiresAt?: string;
};

export type LivePurseBooster = {
  teamName?: string;
  amount?: number;
  reason?: string;
  expiresAt?: string;
};

export type LiveWheelItem = { label: string; color?: string };

export type LivePlayerFilter = {
  status: "all" | "queue" | "sold" | "unsold" | "retained" | "live";
  categoryId: string | null;
  teamId: string | null;
};

export type LiveBannerDTO = {
  enabled: boolean;
  url: string | null;
  fit: "contain" | "cover";
};

export type LiveSnapshotDTO = {
  tournament: {
    id: number;
    name: string;
    organizer: string;
    venue: string;
    date: string;
    logoUrl: string | null;
    baseIncrement: number;
    bidTiers: { upTo: number; step: number }[];
    timerCeiling: number;
    minBid: number;
    minSquadSize: number;
    maxSquadSize: number;
  } | null;

  branding: LiveBrandingDTO | null;
  sponsors: LiveSponsorDTO[];
  banner: LiveBannerDTO;
  session: {
    status: string;
    currentPlayerId: string | null;
    currentBid: number;
    currentBidTeamId: string | null;
    timerSeconds: number;
    timerEndsAt: string | null;
    isBidding: boolean;
    soldCount: number;
    unsoldCount: number;
    isBreak: boolean;
    breakEndsAt: string | null;
    displayCountdown: { type: "break" | "pre-auction"; endsAt: string; message?: string } | null;
    pausedTimeRemaining: number | null;
    fortuneWheelActive: boolean;
    wheelSpinning: boolean;
    wheelItems: LiveWheelItem[];
    wheelWinner: string | null;
    teamPurseViewActive: boolean;
    displayOverlay: string | null;
    displayPlayerFilter: LivePlayerFilter | null;
    lastOutcome: LiveLastOutcome | null;
    lastToast: LiveToast | null;
    lastPurseBooster: LivePurseBooster | null;
  } | null;
  teams: LiveTeamDTO[];
  players: LivePlayerDTO[];
  currentPlayer: LivePlayerDTO | null;
  recentBids: LiveBidDTO[];
  totalPlayers: number;
  remainingPlayers: number;
};


function mapRole(raw: string | null): LivePlayerDTO["roleCode"] {
  if (!raw) return "AR";
  const s = raw.toLowerCase();
  if (s.includes("wicket") || s === "wk") return "WK";
  if (s.includes("all") || s === "ar") return "AR";
  if (s.includes("bowl") || s === "bowler") return "BOWL";
  if (s.includes("bat") || s === "batter" || s === "batsman") return "BAT";
  return "AR";
}
function mapHand(raw: string | null): "Right" | "Left" {
  return raw && raw.toLowerCase().includes("left") ? "Left" : "Right";
}
function parseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const getLiveSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<LiveSnapshotDTO> => {
    const { getNeonPool } = await import("./neon/client.server");
    const pool = getNeonPool();

    // Tournament + branding in parallel (independent queries) — saves 1 RTT.
    const [tRes, brandingRes] = await Promise.all([
      pool.query(
        `SELECT id, name, organizer_name, venue, auction_date, logo_url, sponsor_logos,
                min_bid, bid_increment,
                bid_tier1_up_to, bid_tier1_increment,
                bid_tier2_up_to, bid_tier2_increment, bid_tier3_increment,
                timer_seconds, minimum_squad_size, maximum_squad_size,
                main_banner_enabled, main_banner_url, main_banner_fit
           FROM tournaments
          WHERE status IN ('active', 'live', 'paused')
          ORDER BY CASE WHEN status IN ('active', 'live') THEN 0 ELSE 1 END, id DESC
          LIMIT 1`,
      ),
      pool.query(
        `SELECT brand_name, mini_brand_text, powered_by_text, main_logo_url, mini_logo_url,
                primary_color, accent_color
           FROM branding_settings
          ORDER BY id ASC
          LIMIT 1`,
      ),
    ]);
    const br = brandingRes.rows[0];
    const branding: LiveBrandingDTO | null = br
      ? {
          brandName: br.brand_name ?? "BidWar",
          miniBrandText: br.mini_brand_text ?? "BW",
          poweredByText: br.powered_by_text ?? "Powered by BidWar",
          mainLogoUrl: br.main_logo_url ?? null,
          miniLogoUrl: br.mini_logo_url ?? null,
          primaryColor: br.primary_color ?? "#F59E0B",
          accentColor: br.accent_color ?? "#3B82F6",
        }
      : null;


    if (tRes.rows.length === 0) {
      return {
        tournament: null,
        branding,
        sponsors: [],
        banner: { enabled: false, url: null, fit: "contain" },
        session: null,
        teams: [],
        players: [],
        currentPlayer: null,
        recentBids: [],
        totalPlayers: 0,
        remainingPlayers: 0,
      };
    }

    const t = tRes.rows[0];

    const banner: LiveBannerDTO = {
      enabled: !!t.main_banner_enabled,
      url: t.main_banner_url ?? null,
      fit: t.main_banner_fit === "cover" ? "cover" : "contain",
    };


    const sponsorsRaw = parseJSON<Array<{ url?: string; name?: string; type?: string }>>(
      t.sponsor_logos,
      [],
    );
    const sponsors: LiveSponsorDTO[] = sponsorsRaw
      .filter((s) => s && (s.url || s.name))
      .map((s) => ({
        name: s.name ?? "",
        type: s.type ?? "Partner",
        logoUrl: s.url ?? "",
      }));

    const [sessRes, teamsRes, playersRes, bidsRes] = await Promise.all([
      pool.query(
        `SELECT status, current_player_id, current_bid, current_bid_team_id,
                timer_seconds, timer_ends_at, sold_players_count, unsold_players_count,
                last_outcome, is_break, break_ends_at, display_countdown, paused_time_remaining,
                fortune_wheel_active, wheel_spinning, wheel_items_json, wheel_winner,
                team_purse_view_active, display_overlay, display_player_filter,
                last_led_toast_json, last_purse_booster_json
           FROM auction_sessions
          WHERE tournament_id = $1
          LIMIT 1`,
        [t.id],
      ),

      pool.query(
        `SELECT id, name, short_code, color, logo_url, purse, purse_used,
                (SELECT count(*) FROM players p WHERE p.team_id = teams.id) AS squad_count
           FROM teams
          WHERE tournament_id = $1
          ORDER BY id ASC`,
        [t.id],
      ),
      pool.query(
        `SELECT id, name, role, batting_style, age, city, base_price, sold_price,
                status, photo_url, jersey_number, team_id
           FROM players
          WHERE tournament_id = $1
          ORDER BY id ASC`,
        [t.id],
      ),
      // Fetch latest bids for the currently-live player using a subquery so we
      // can run it in parallel with the session query instead of waiting on it.
      pool.query(
        `SELECT id, team_id, bid_amount, timestamp
           FROM auction_bid_events
          WHERE tournament_id = $1
            AND player_id = (
              SELECT current_player_id FROM auction_sessions
               WHERE tournament_id = $1 LIMIT 1
            )
          ORDER BY id DESC
          LIMIT 3`,
        [t.id],
      ),
    ]);


    const sess = sessRes.rows[0];

    const teams: LiveTeamDTO[] = teamsRes.rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      short: r.short_code ?? r.name.slice(0, 3).toUpperCase(),
      color: r.color ?? "#3B82F6",
      logoUrl: r.logo_url ?? null,
      purse: Math.max(0, Number(r.purse) - Number(r.purse_used ?? 0)),
      totalPurse: Number(r.purse),
      squadCount: Number(r.squad_count ?? 0),
    }));

    const players: LivePlayerDTO[] = playersRes.rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      roleRaw: r.role ?? null,
      roleCode: mapRole(r.role ?? null),
      basePrice: Number(r.base_price ?? 0),
      soldPrice: r.sold_price != null ? Number(r.sold_price) : null,
      city: r.city ?? "",
      age: r.age != null ? Number(r.age) : 0,
      battingHand: mapHand(r.batting_style ?? null),
      jerseyNo: r.jersey_number ? Number(r.jersey_number) || 0 : 0,
      portrait: r.photo_url ?? "",
      status:
        r.status === "sold"
          ? "sold"
          : r.status === "unsold"
            ? "unsold"
            : r.status === "retained"
              ? "retained"
              : "queue",
      soldToTeamId: r.team_id != null ? String(r.team_id) : null,
    }));

    const totalPlayers = players.length;
    const remainingPlayers = players.filter(
      (p) => p.status === "queue" || p.status === "live",
    ).length;

    let currentPlayer: LivePlayerDTO | null = null;
    let recentBids: LiveBidDTO[] = [];
    let session: LiveSnapshotDTO["session"] = null;

    if (sess) {
      const lastOutcome = parseJSON<LiveLastOutcome | null>(sess.last_outcome, null);
      const lastToast = parseJSON<LiveToast | null>(sess.last_led_toast_json, null);
      const lastPurseBooster = parseJSON<LivePurseBooster | null>(
        sess.last_purse_booster_json,
        null,
      );
      const wheelItems = parseJSON<LiveWheelItem[]>(sess.wheel_items_json, []);
      const displayPlayerFilter = parseJSON<LivePlayerFilter | null>(
        sess.display_player_filter,
        null,
      );


      const cpId = sess.current_player_id;
      if (cpId != null) {
        currentPlayer = players.find((p) => p.id === String(cpId)) ?? null;
        recentBids = bidsRes.rows.map((r) => ({
          id: String(r.id),
          teamId: String(r.team_id),
          amount: Number(r.bid_amount),
          ts: new Date(r.timestamp).toISOString(),
        }));
      } else if (lastOutcome?.playerId != null) {
        currentPlayer =
          players.find((p) => p.id === String(lastOutcome.playerId)) ?? null;
      }


      session = {
        status: sess.status,
        currentPlayerId: cpId != null ? String(cpId) : null,
        currentBid: Number(sess.current_bid ?? 0),
        currentBidTeamId:
          sess.current_bid_team_id != null ? String(sess.current_bid_team_id) : null,
        timerSeconds: Number(sess.timer_seconds ?? t.timer_seconds ?? 30),
        timerEndsAt: sess.timer_ends_at ?? null,
        isBidding:
          (sess.status === "bidding" || sess.status === "active") &&
          cpId != null &&
          !sess.is_break &&
          !sess.fortune_wheel_active &&
          !sess.team_purse_view_active &&
          sess.paused_time_remaining == null &&
          sess.timer_ends_at != null,
        soldCount: Number(sess.sold_players_count ?? 0),
        unsoldCount: Number(sess.unsold_players_count ?? 0),
        isBreak: !!sess.is_break,
        breakEndsAt: sess.break_ends_at ?? null,
        displayCountdown: (() => {
          const dc = parseJSON<{ type?: string; endsAt?: string; message?: string } | null>(
            sess.display_countdown,
            null,
          );
          if (!dc || !dc.endsAt) return null;
          const type = dc.type === "pre-auction" ? "pre-auction" : dc.type === "break" ? "break" : null;
          if (!type) return null;
          return { type, endsAt: dc.endsAt, message: dc.message };
        })(),
        pausedTimeRemaining:
          sess.paused_time_remaining != null
            ? Number(sess.paused_time_remaining)
            : null,
        fortuneWheelActive: !!sess.fortune_wheel_active,
        wheelSpinning: !!sess.wheel_spinning,
        wheelItems,
        wheelWinner: sess.wheel_winner ?? null,
        teamPurseViewActive: !!sess.team_purse_view_active,
        displayOverlay: sess.display_overlay ?? null,
        displayPlayerFilter,
        lastOutcome,
        lastToast,
        lastPurseBooster,
      };

    }

    const bidTiers = [
      { upTo: Number(t.bid_tier1_up_to), step: Number(t.bid_tier1_increment) },
      { upTo: Number(t.bid_tier2_up_to), step: Number(t.bid_tier2_increment) },
      { upTo: Number.MAX_SAFE_INTEGER, step: Number(t.bid_tier3_increment) },
    ];

    return {
      tournament: {
        id: t.id,
        name: t.name,
        organizer: t.organizer_name ?? "",
        venue: t.venue ?? "",
        date: t.auction_date ?? "",
        logoUrl: t.logo_url ?? null,
        baseIncrement: Number(t.bid_increment),
        bidTiers,
        timerCeiling: Number(t.timer_seconds ?? 30),
        minBid: Number(t.min_bid ?? 0),
        minSquadSize: Number(t.minimum_squad_size ?? 0),
        maxSquadSize: Number(t.maximum_squad_size ?? 0),
      },

      branding,
      sponsors,
      banner,
      session,

      teams,
      players,
      currentPlayer,
      recentBids,
      totalPlayers,
      remainingPlayers,
    };
  },
);
