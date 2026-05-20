/**
 * IceBlue — Cool, quiet, technically precise.
 * Aesthetic: Swiss editorial meets F1 timing screen.
 * Very dark blue-black, ice cyan accents, generous whitespace,
 * monospaced data feel. Calm and authoritative.
 */

const TC = "#06b6d4"; // cyan-500
const TEAMS = [
  { s: "MUW", purse: "₹24Cr", pct: 72, c: "#06b6d4" },
  { s: "DEL", purse: "₹31Cr", pct: 54, c: "#818cf8" },
  { s: "CSK", purse: "₹18Cr", pct: 85, c: "#fbbf24" },
  { s: "RCB", purse: "₹12Cr", pct: 91, c: "#f87171" },
  { s: "KKR", purse: "₹9Cr",  pct: 94, c: "#a78bfa" },
  { s: "PBK", purse: "₹28Cr", pct: 61, c: "#34d399" },
];

export function IceBlue() {
  return (
    <div style={{
      width:"100vw", height:"100vh", display:"grid",
      gridTemplateRows:"52px 1fr 36px",
      background:"#020b12",
      fontFamily:"system-ui, -apple-system, sans-serif",
      overflow:"hidden", position:"relative",
    }}>
      <style>{`
        @keyframes mq3 { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes pulse4 { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes scan { 0%{top:-2px} 100%{top:100%} }
      `}</style>

      {/* Subtle scanline effect */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.01) 2px, rgba(6,182,212,0.01) 4px)" }} />

      {/* Blue glow bottom-left */}
      <div style={{ position:"absolute", bottom:0, left:"20%", width:400, height:300,
        background:"radial-gradient(ellipse at 50% 100%, rgba(6,182,212,0.07) 0%, transparent 70%)",
        pointerEvents:"none" }} />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 28px", gap:16,
        background:"rgba(2,11,18,0.9)", backdropFilter:"blur(8px)",
        borderBottom:`1px solid rgba(6,182,212,0.15)`,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
          <div style={{ width:36, height:36, borderRadius:8,
            border:`1px solid rgba(6,182,212,0.3)`,
            background:"rgba(6,182,212,0.06)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:10, fontWeight:900, color:TC, flexShrink:0, fontFamily:"monospace" }}>IPL</div>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"rgba(255,255,255,0.9)", letterSpacing:"0.02em" }}>IPL Mega Auction 2025</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:"0.2em", textTransform:"uppercase", marginTop:2, fontFamily:"monospace" }}>BCCI · MUMBAI</div>
          </div>
        </div>

        <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)",
          display:"flex", alignItems:"center", gap:8, padding:"4px 18px", borderRadius:4,
          background:"rgba(6,182,212,0.06)", border:`1px solid rgba(6,182,212,0.2)` }}>
          <div style={{ width:22, height:22, borderRadius:4, background:TC,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:9, fontWeight:900, color:"#000" }}>BW</div>
          <span style={{ fontWeight:900, fontSize:13, letterSpacing:"0.25em", color:"rgba(255,255,255,0.85)", textTransform:"uppercase" }}>BIDWAR</span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:14, flex:1, justifyContent:"flex-end" }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", fontFamily:"monospace", letterSpacing:"0.05em" }}>
            <span style={{ color:"#4ade80", fontWeight:600 }}>042</span> SOLD · <span style={{ color:"rgba(255,255,255,0.35)" }}>018</span> LEFT
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 12px", borderRadius:3,
            background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", color:"#4ade80" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#4ade80", animation:"pulse4 1.5s infinite" }} />
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.2em", fontFamily:"monospace" }}>LIVE</span>
          </div>
          <div style={{ borderLeft:"1px solid rgba(255,255,255,0.06)", paddingLeft:12 }}>
            <div style={{ padding:"4px 14px", borderRadius:4,
              background:"rgba(6,182,212,0.06)", border:`1px solid rgba(6,182,212,0.2)`,
              fontSize:12, fontWeight:700, color:TC, fontFamily:"monospace", letterSpacing:"0.05em" }}>DREAM11</div>
          </div>
        </div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"200px 1fr 190px", overflow:"hidden" }}>

        {/* Player panel */}
        <div style={{ position:"relative", overflow:"hidden",
          background:"linear-gradient(170deg, #030e1a 0%, #020b12 100%)",
          borderRight:`1px solid rgba(6,182,212,0.1)` }}>
          <div style={{ position:"absolute", inset:0,
            background:"radial-gradient(ellipse 70% 60% at 40% 35%, rgba(6,182,212,0.06) 0%, transparent 70%)" }} />
          <div style={{ position:"absolute", inset:0,
            background:"linear-gradient(90deg, transparent 55%, rgba(2,11,18,0.97) 100%)" }} />
          <div style={{ position:"absolute", inset:0,
            background:"linear-gradient(0deg, rgba(2,11,18,0.99) 0%, transparent 35%)" }} />

          {/* Grid overlay */}
          <div style={{ position:"absolute", inset:0, pointerEvents:"none",
            backgroundImage:`linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)`,
            backgroundSize:"30px 30px" }} />

          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:88, fontWeight:900, color:"rgba(6,182,212,0.05)", userSelect:"none", fontFamily:"monospace" }}>VK</div>

          {/* Jersey */}
          <div style={{ position:"absolute", top:14, left:14, width:40, height:40, borderRadius:6,
            background:"rgba(6,182,212,0.1)", border:`1px solid ${TC}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:12, fontWeight:900, color:TC, fontFamily:"monospace" }}>#18</div>

          {/* Category */}
          <div style={{ position:"absolute", top:14, right:10, padding:"3px 8px", borderRadius:3,
            background:"rgba(6,182,212,0.08)", border:`1px solid rgba(6,182,212,0.2)`,
            fontSize:9, fontWeight:700, color:TC, letterSpacing:"0.15em", fontFamily:"monospace" }}>PLATINUM</div>

          {/* Scanning line effect */}
          <div style={{ position:"absolute", left:0, right:0, height:1,
            background:`linear-gradient(90deg, transparent, ${TC}44, transparent)`,
            animation:"scan 4s linear infinite", opacity:0.5 }} />

          {/* Bottom data */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"10px 12px",
            background:"rgba(2,11,18,0.85)", borderTop:`1px solid rgba(6,182,212,0.08)` }}>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.15em" }}>IND · AGE 35</div>
            <div style={{ display:"flex", gap:3, marginTop:5, flexWrap:"wrap" }}>
              {["BAT","RHB","ODI:284"].map(s => (
                <span key={s} style={{ fontSize:9, padding:"2px 5px", borderRadius:3,
                  background:"rgba(6,182,212,0.06)", border:`1px solid rgba(6,182,212,0.15)`,
                  color:"rgba(6,182,212,0.6)", fontFamily:"monospace" }}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Bid info */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"22px 30px", overflow:"hidden" }}>
          <div>
            <div style={{ fontSize:10, fontFamily:"monospace", letterSpacing:"0.25em", textTransform:"uppercase",
              color:"rgba(6,182,212,0.45)", marginBottom:8 }}>BATSMAN · RIGHT HAND</div>
            <div style={{ lineHeight:1 }}>
              <div style={{ fontSize:34, fontWeight:600, color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em" }}>VIRAT</div>
              <div style={{ fontSize:72, fontWeight:900, color:"rgba(255,255,255,0.92)", lineHeight:0.9,
                letterSpacing:"-0.02em" }}>KOHLI</div>
              <div style={{ width:60, height:2, background:TC, marginTop:12, opacity:0.6 }} />
            </div>
            <div style={{ marginTop:10, fontSize:10, color:"rgba(255,255,255,0.2)", fontFamily:"monospace", letterSpacing:"0.05em" }}>
              AVAIL: MAR 15–APR 30 · 3× MVP
            </div>
          </div>

          <div>
            <div style={{ fontSize:9, fontFamily:"monospace", letterSpacing:"0.25em", textTransform:"uppercase",
              color:"rgba(255,255,255,0.25)", marginBottom:4 }}>CURRENT BID</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:20, marginBottom:16 }}>
              <div style={{ fontSize:58, fontWeight:900, color:TC, lineHeight:1,
                textShadow:`0 0 40px rgba(6,182,212,0.4)` }}>₹14 Cr</div>
              <div style={{ marginBottom:4 }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", fontFamily:"monospace", letterSpacing:"0.15em" }}>BASE</div>
                <div style={{ fontSize:18, fontWeight:600, color:"rgba(255,255,255,0.4)", fontFamily:"monospace" }}>₹2 Cr</div>
              </div>
              <div style={{ marginBottom:4 }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", fontFamily:"monospace", letterSpacing:"0.15em" }}>INCR</div>
                <div style={{ fontSize:18, fontWeight:600, color:"rgba(255,255,255,0.4)", fontFamily:"monospace" }}>₹10L</div>
              </div>
            </div>

            {/* Leading team — clean bordered row */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
              borderRadius:4, marginBottom:14,
              background:"rgba(6,182,212,0.05)", border:`1px solid rgba(6,182,212,0.15)` }}>
              <div style={{ width:4, height:32, borderRadius:2, background:TC, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", letterSpacing:"0.2em" }}>LEADING</div>
                <div style={{ fontSize:18, fontWeight:700, color:"rgba(255,255,255,0.9)", letterSpacing:"0.03em" }}>MUMBAI WARRIORS</div>
              </div>
            </div>

            {/* Timer */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 14px",
              background:"rgba(6,182,212,0.04)", border:`1px solid rgba(6,182,212,0.12)`, borderRadius:4,
              width:"fit-content" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:TC, animation:"pulse4 1.5s infinite" }} />
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", letterSpacing:"0.2em" }}>COUNTDOWN</span>
              <span style={{ fontSize:24, fontWeight:900, color:TC, fontFamily:"monospace", letterSpacing:"0.05em" }}>0:28</span>
            </div>
          </div>

          <div style={{ display:"flex", gap:6 }}>
            {[["CAPS","237"],["AVG","52.4"],["SR","131.2"],["100s","7"]].map(([l,v]) => (
              <div key={l} style={{ flex:1, padding:"8px 8px", borderRadius:4,
                background:"rgba(6,182,212,0.03)", border:`1px solid rgba(6,182,212,0.1)`, textAlign:"center" }}>
                <div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", fontFamily:"monospace", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.85)", fontFamily:"monospace" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Purse panel */}
        <div style={{ display:"flex", flexDirection:"column", borderLeft:`1px solid rgba(6,182,212,0.08)`, overflow:"hidden" }}>
          <div style={{ padding:"14px 12px", borderBottom:`1px solid rgba(6,182,212,0.06)`, flex:1 }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.2em", color:"rgba(255,255,255,0.25)", marginBottom:10 }}>TEAM PURSE</div>
            {TEAMS.map(t => (
              <div key={t.s} style={{ marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:t.c }} />
                    <span style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.65)", fontFamily:"monospace" }}>{t.s}</span>
                  </div>
                  <span style={{ fontSize:10, fontFamily:"monospace", color:t.c }}>{t.purse}</span>
                </div>
                <div style={{ height:2, borderRadius:1, background:"rgba(255,255,255,0.04)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:1, background:t.c, width:`${t.pct}%`, opacity:0.6 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding:"10px 12px", borderBottom:`1px solid rgba(6,182,212,0.06)` }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.25)", marginBottom:7 }}>QUEUE</div>
            {["Rohit Sharma","J. Bumrah"].map(n => (
              <div key={n} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                <div style={{ width:20, height:20, borderRadius:4, background:"rgba(6,182,212,0.06)",
                  border:`1px solid rgba(6,182,212,0.15)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:8, fontWeight:700, color:TC, fontFamily:"monospace" }}>{n[0]}{n.split(" ")[1]?.[0]}</div>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontFamily:"monospace" }}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.2)", marginBottom:4 }}>SOLD</div>
            <div style={{ fontSize:32, fontWeight:900, color:TC, fontFamily:"monospace",
              textShadow:`0 0 20px rgba(6,182,212,0.5)` }}>042</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", fontFamily:"monospace" }}>/ 060</div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center",
        borderTop:`1px solid rgba(6,182,212,0.08)`,
        background:"rgba(2,11,18,0.9)", overflow:"hidden" }}>
        <div style={{ padding:"0 14px", fontSize:9, fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.2em", color:"rgba(255,255,255,0.18)", whiteSpace:"nowrap", flexShrink:0, fontFamily:"monospace" }}>PWR BY</div>
        <div style={{ flex:1, overflow:"hidden" }}>
          <div style={{ display:"flex", gap:40, animation:"mq3 18s linear infinite", whiteSpace:"nowrap" }}>
            {["DREAM11","JIO CINEMA","TATA","PAYTM","MRF","PEPSI","DREAM11","JIO CINEMA","TATA","PAYTM","MRF","PEPSI"].map((n,i)=>(
              <span key={i} style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.22)", fontFamily:"monospace", letterSpacing:"0.08em" }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
