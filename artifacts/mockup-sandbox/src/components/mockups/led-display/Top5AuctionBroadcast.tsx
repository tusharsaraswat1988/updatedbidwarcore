/**
 * Mock — Top 5 Buys uniform LED rows (design review).
 * Preview: /__mockup/preview/led-display/Top5AuctionBroadcast
 */

const RANK_BADGE: Record<number, { bg: string; color: string }> = {
  1: { bg: "linear-gradient(135deg,#fde047,#d4af37,#b8860b)", color: "#0a0a0a" },
  2: { bg: "linear-gradient(135deg,#f0f2f5,#b8bcc4,#8a919a)", color: "#0a0a0a" },
  3: { bg: "linear-gradient(135deg,#e8a45c,#cd7f32,#9a5c24)", color: "#0a0a0a" },
  4: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" },
  5: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" },
};

const ROW_H = 88;
const PHOTO = 64;
const TOP5 = [
  { rank: 1, name: "Rohit Sharma", team: "Mumbai Mavericks", code: "MUM", color: "#1D4ED8", price: "SOLD FOR ₹1.25 CRORE", photo: "https://ui-avatars.com/api/?name=Rohit+Sharma&background=1D4ED8&color=fff&size=128&bold=true" },
  { rank: 2, name: "Virat Kohli", team: "Chennai Chargers", code: "CHE", color: "#D97706", price: "SOLD FOR ₹98 LAKH", photo: "https://ui-avatars.com/api/?name=Virat+Kohli&background=D97706&color=fff&size=128&bold=true" },
  { rank: 3, name: "Jasprit Bumrah", team: "Bangalore Blasters", code: "BLR", color: "#DC2626", price: "SOLD FOR ₹72 LAKH", photo: "https://ui-avatars.com/api/?name=Jasprit+Bumrah&background=DC2626&color=fff&size=128&bold=true" },
  { rank: 4, name: "Hardik Pandya", team: "Delhi Dragons", code: "DEL", color: "#334155", price: "SOLD FOR ₹54 LAKH", photo: "https://ui-avatars.com/api/?name=Hardik+Pandya&background=0F172A&color=fff&size=128&bold=true" },
  { rank: 5, name: "KL Rahul", team: "Kolkata Kings", code: "KOL", color: "#7C3AED", price: "SOLD FOR ₹41 LAKH", photo: "https://ui-avatars.com/api/?name=KL+Rahul&background=7C3AED&color=fff&size=128&bold=true" },
];

function Row({ p }: { p: typeof TOP5[0] }) {
  const badge = RANK_BADGE[p.rank];
  return (
    <div style={{
      height: ROW_H, display: "flex", alignItems: "center", gap: 16, padding: "0 20px",
      borderRadius: 12, background: "rgba(12,12,14,0.92)", border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: 18, background: badge.bg, color: badge.color, flexShrink: 0,
      }}>{p.rank}</div>
      <img src={p.photo} alt="" style={{ width: PHOTO, height: PHOTO, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 20, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: p.color, fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.code.slice(0, 2)}</div>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.team}</span>
        </div>
      </div>
      <div style={{ fontWeight: 900, fontSize: 20, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", minWidth: 180, textAlign: "right", flexShrink: 0 }}>{p.price}</div>
    </div>
  );
}

export function Top5AuctionBroadcast() {
  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse at 50% -10%, #1a1520 0%, #08060c 42%, #000 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif", color: "#fff", overflow: "hidden",
    }}>
      <div style={{ textAlign: "center", padding: "24px 0 16px", flexShrink: 0 }}>
        <div style={{
          fontWeight: 900, fontSize: 48, letterSpacing: "0.08em", textTransform: "uppercase",
          background: "linear-gradient(135deg,#fde68a,#f59e0b,#fde68a)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Top 5 Buys</div>
        <div style={{ fontSize: 12, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
          Ishita School Premier Cricket League
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, padding: "16px 40px" }}>
        {TOP5.map(p => <Row key={p.rank} p={p} />)}
      </div>
    </div>
  );
}

export default Top5AuctionBroadcast;
