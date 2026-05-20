/**
 * BroadcastGold — Warm, dense, formal.
 * Aesthetic: premium Star Sports / Sony LIV broadcast.
 * Deep mahogany-black, amber-gold accents, dense information, serif-adjacent weight.
 */

const TC = "#d97706"; // amber-600
const TEAMS = [
  { s: "MUW", purse: "₹24Cr", pct: 72, c: "#d97706" },
  { s: "DEL", purse: "₹31Cr", pct: 54, c: "#3b82f6" },
  { s: "CSK", purse: "₹18Cr", pct: 85, c: "#fbbf24" },
  { s: "RCB", purse: "₹12Cr", pct: 91, c: "#ef4444" },
  { s: "KKR", purse: "₹9Cr",  pct: 94, c: "#8b5cf6" },
  { s: "PBK", purse: "₹28Cr", pct: 61, c: "#ec4899" },
];

export function BroadcastGold() {
  return (
    <div style={{
      width: "100vw", height: "100vh", display: "grid",
      gridTemplateRows: "56px 1fr 36px",
      background: "linear-gradient(160deg, #0c0800 0%, #080500 60%, #0a0600 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @keyframes mq { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Subtle diagonal texture */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background:`repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(217,119,6,0.015) 40px, rgba(217,119,6,0.015) 80px)` }} />

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 32px", borderBottom:"1px solid rgba(217,119,6,0.25)",
        background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)", gap:16,
      }}>
        {/* Left */}
        <div style={{ display:"flex", alignItems:"center", gap:12, flex:1 }}>
          <div style={{ width:38, height:38, borderRadius:8, background:"rgba(217,119,6,0.2)",
            border:"1px solid rgba(217,119,6,0.4)", display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:900, color:"#d97706", flexShrink:0 }}>IPL</div>
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:"#fff", lineHeight:1 }}>IPL Mega Auction 2025</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", letterSpacing:"0.15em", textTransform:"uppercase", marginTop:2 }}>BCCI · Mumbai</div>
          </div>
        </div>
        {/* Center brand */}
        <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)",
          display:"flex", alignItems:"center", gap:8, padding:"4px 20px", borderRadius:999,
          background:"rgba(217,119,6,0.12)", border:"1px solid rgba(217,119,6,0.35)" }}>
          <div style={{ width:24, height:24, borderRadius:6, background:"#d97706",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:10, fontWeight:900, color:"#000" }}>BW</div>
          <span style={{ fontWeight:900, fontSize:14, letterSpacing:"0.2em", color:"#fff", textTransform:"uppercase" }}>BidWar</span>
        </div>
        {/* Right */}
        <div style={{ display:"flex", alignItems:"center", gap:16, flex:1, justifyContent:"flex-end" }}>
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontFamily:"monospace" }}>
            <span style={{ color:"#4ade80", fontWeight:700 }}>42</span> Sold · <span>18</span> Left
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 12px", borderRadius:999,
            background:"rgba(74,222,128,0.15)", border:"1px solid rgba(74,222,128,0.35)", color:"#4ade80" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", animation:"pulse2 1.5s infinite" }} />
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.15em" }}>LIVE</span>
          </div>
          <div style={{ borderLeft:"1px solid rgba(255,255,255,0.1)", paddingLeft:16 }}>
            <div style={{ height:32, padding:"0 14px", borderRadius:8,
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:900, color:"#ef4444", letterSpacing:"0.05em" }}>Dream11</div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr 180px", overflow:"hidden" }}>

        {/* Player photo panel */}
        <div style={{ display:"flex", flexDirection:"column", overflow:"hidden",
          background:"linear-gradient(170deg, #1c0e00 0%, #0a0500 100%)",
          borderRight:"1px solid rgba(217,119,6,0.15)", position:"relative" }}>
          {/* Glow */}
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 80% 60% at 40% 40%, rgba(217,119,6,0.12) 0%, transparent 70%)` }} />
          {/* Fade from photo area to right */}
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, transparent 60%, rgba(10,5,0,0.95) 100%)" }} />
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(10,5,0,0.98) 0%, transparent 35%)" }} />
          {/* Initials watermark */}
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:100, fontWeight:900, color:"rgba(217,119,6,0.08)", userSelect:"none" }}>VK</div>
          {/* Jersey badge */}
          <div style={{ position:"absolute", top:16, left:16, width:44, height:44, borderRadius:10,
            background:TC, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:13, fontWeight:900, color:"#000" }}>#18</div>
          {/* Category */}
          <div style={{ position:"absolute", top:16, right:16, padding:"4px 10px",
            background:TC, borderRadius:6, fontSize:10, fontWeight:900, color:"#000", letterSpacing:"0.12em" }}>PLATINUM</div>
          {/* Bottom info */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"12px 16px",
            background:"rgba(0,0,0,0.7)", borderTop:"1px solid rgba(217,119,6,0.12)" }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"monospace", letterSpacing:"0.1em", textTransform:"uppercase" }}>India · Age 35</div>
            <div style={{ display:"flex", gap:4, marginTop:6, flexWrap:"wrap" }}>
              {["BATSMAN","RHB","ODI: 284"].map(s => (
                <span key={s} style={{ fontSize:9, padding:"2px 6px", borderRadius:4,
                  background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
                  color:"rgba(255,255,255,0.5)", fontFamily:"monospace" }}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Bid info */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"28px 32px", overflow:"hidden" }}>
          {/* Player name */}
          <div>
            <div style={{ fontSize:11, fontFamily:"monospace", letterSpacing:"0.25em", textTransform:"uppercase",
              color:"rgba(217,119,6,0.6)", marginBottom:6 }}>BATSMAN · RIGHT HAND</div>
            <div style={{ lineHeight:1 }}>
              <div style={{ fontSize:36, fontWeight:900, color:"rgba(255,255,255,0.45)" }}>VIRAT</div>
              <div style={{ fontSize:80, fontWeight:900, color:TC, lineHeight:0.9,
                textShadow:`0 4px 40px rgba(217,119,6,0.5)` }}>KOHLI</div>
            </div>
            <div style={{ marginTop:8, fontSize:11, color:"rgba(255,255,255,0.25)", fontFamily:"monospace" }}>
              Available: Mar 15–Apr 30 · 3x MVP
            </div>
          </div>

          {/* Bid row */}
          <div>
            <div style={{ fontSize:10, fontFamily:"monospace", letterSpacing:"0.2em", textTransform:"uppercase",
              color:"rgba(255,255,255,0.3)", marginBottom:6 }}>CURRENT BID</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:24, marginBottom:16 }}>
              <div style={{ fontSize:64, fontWeight:900, color:"#fff", lineHeight:1 }}>₹14 Cr</div>
              <div style={{ marginBottom:4 }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", letterSpacing:"0.15em" }}>BASE</div>
                <div style={{ fontSize:20, fontWeight:700, color:"rgba(255,255,255,0.5)" }}>₹2 Cr</div>
              </div>
              <div style={{ marginBottom:4 }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", letterSpacing:"0.15em" }}>STEP</div>
                <div style={{ fontSize:20, fontWeight:700, color:"rgba(255,255,255,0.5)" }}>₹10L</div>
              </div>
            </div>

            {/* Leading team */}
            <div style={{ display:"inline-flex", alignItems:"center", gap:12, padding:"10px 20px",
              background:`linear-gradient(90deg, rgba(217,119,6,0.15) 0%, transparent 100%)`,
              borderLeft:`4px solid ${TC}`, borderRadius:"0 10px 10px 0", marginBottom:16 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:TC,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:900, color:"#000" }}>MW</div>
              <div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.15em" }}>LEADING BID</div>
                <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>MUMBAI WARRIORS</div>
              </div>
            </div>

            {/* Timer */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px",
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:TC, animation:"pulse2 1.5s infinite" }} />
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.15em" }}>TIMER</span>
                <span style={{ fontSize:28, fontWeight:900, color:TC, fontFamily:"monospace" }}>0:28</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"flex", gap:8 }}>
            {[["IPL CAPS","237"],["AVG","52.4"],["SR","131.2"],["100s","7"]].map(([l,v]) => (
              <div key={l} style={{ flex:1, padding:"8px 10px", borderRadius:8,
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", textAlign:"center" }}>
                <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:16, fontWeight:900, color:"#fff" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Purse panel */}
        <div style={{ display:"flex", flexDirection:"column", borderLeft:"1px solid rgba(217,119,6,0.12)", overflow:"hidden" }}>
          <div style={{ padding:"16px 14px", borderBottom:"1px solid rgba(217,119,6,0.08)", flex:1, overflowY:"hidden" }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.18em",
              color:"rgba(255,255,255,0.3)", marginBottom:12 }}>TEAM PURSE</div>
            {TEAMS.map(t => (
              <div key={t.s} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:t.c, flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.8)" }}>{t.s}</span>
                  </div>
                  <span style={{ fontSize:10, fontFamily:"monospace", color:t.c }}>{t.purse}</span>
                </div>
                <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:2, background:t.c, width:`${t.pct}%`, opacity:0.7 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(217,119,6,0.08)" }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.15em",
              color:"rgba(255,255,255,0.3)", marginBottom:8 }}>NEXT UP</div>
            {["Rohit Sharma","J. Bumrah"].map(n => (
              <div key={n} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:24, height:24, borderRadius:6, background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.4)" }}>{n[0]}{n.split(" ")[1]?.[0]}</div>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:"12px 14px", textAlign:"center" }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.15em", color:"rgba(255,255,255,0.25)", marginBottom:4 }}>SOLD TODAY</div>
            <div style={{ fontSize:36, fontWeight:900, color:TC }}>42</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", fontFamily:"monospace" }}>of 60</div>
          </div>
        </div>
      </div>

      {/* ── FOOTER TICKER ─────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", borderTop:"1px solid rgba(217,119,6,0.15)",
        background:"rgba(0,0,0,0.7)", overflow:"hidden" }}>
        <div style={{ padding:"0 16px", fontSize:9, fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.2em", color:"rgba(255,255,255,0.25)", whiteSpace:"nowrap", flexShrink:0 }}>POWERED BY</div>
        <div style={{ flex:1, overflow:"hidden" }}>
          <div style={{ display:"flex", gap:48, animation:"mq 18s linear infinite", whiteSpace:"nowrap" }}>
            {["Dream11","Jio Cinema","TATA","PayTM","MRF","Pepsi","Dream11","Jio Cinema","TATA","PayTM","MRF","Pepsi"].map((n,i) => (
              <span key={i} style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.35)" }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
