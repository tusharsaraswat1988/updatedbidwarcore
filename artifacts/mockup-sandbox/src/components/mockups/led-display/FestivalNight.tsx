/**
 * FestivalNight — Vibrant, celebratory, Indian festival energy.
 * Aesthetic: Diwali meets IPL. Deep navy with magenta/gold.
 * Dense but joyful. Feels like the crowd is already cheering.
 */

const TC = "#ec4899"; // hot pink
const GOLD = "#fbbf24";
const TEAMS = [
  { s: "MUW", purse: "₹24Cr", pct: 72, c: "#ec4899" },
  { s: "DEL", purse: "₹31Cr", pct: 54, c: "#60a5fa" },
  { s: "CSK", purse: "₹18Cr", pct: 85, c: "#fbbf24" },
  { s: "RCB", purse: "₹12Cr", pct: 91, c: "#f87171" },
  { s: "KKR", purse: "₹9Cr",  pct: 94, c: "#a78bfa" },
  { s: "PBK", purse: "₹28Cr", pct: 61, c: "#34d399" },
];

export function FestivalNight() {
  return (
    <div style={{
      width:"100vw", height:"100vh", display:"grid",
      gridTemplateRows:"60px 1fr 40px",
      background:"linear-gradient(160deg, #060414 0%, #080520 60%, #06040f 100%)",
      fontFamily:"system-ui, -apple-system, sans-serif",
      overflow:"hidden", position:"relative",
    }}>
      <style>{`
        @keyframes mq2 { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes glow { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes pulse3 { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* Festive radial glows */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background:`radial-gradient(ellipse 60% 50% at 30% 60%, rgba(236,72,153,0.1) 0%, transparent 70%),
                    radial-gradient(ellipse 50% 40% at 70% 30%, rgba(251,191,36,0.07) 0%, transparent 70%)` }} />

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 28px", gap:16,
        background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)",
        borderBottom:`1px solid rgba(236,72,153,0.2)`,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
          <div style={{ width:40, height:40, borderRadius:10,
            background:`linear-gradient(135deg, rgba(236,72,153,0.3), rgba(251,191,36,0.2))`,
            border:`1px solid rgba(236,72,153,0.4)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:900, color:GOLD, flexShrink:0 }}>IPL</div>
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:"#fff" }}>IPL Mega Auction 2025</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:"0.15em", textTransform:"uppercase", marginTop:1 }}>BCCI · Mumbai</div>
          </div>
        </div>

        <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)",
          display:"flex", alignItems:"center", gap:8, padding:"5px 20px", borderRadius:999,
          background:`linear-gradient(90deg, rgba(236,72,153,0.15), rgba(251,191,36,0.1))`,
          border:`1px solid rgba(236,72,153,0.3)` }}>
          <div style={{ width:24, height:24, borderRadius:6,
            background:`linear-gradient(135deg, ${TC}, ${GOLD})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:10, fontWeight:900, color:"#000" }}>BW</div>
          <span style={{ fontWeight:900, fontSize:14, letterSpacing:"0.2em", color:"#fff", textTransform:"uppercase" }}>BidWar</span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, justifyContent:"flex-end" }}>
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)", fontFamily:"monospace" }}>
            <span style={{ color:"#4ade80", fontWeight:700 }}>42</span> Sold · <span>18</span> Left
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 14px", borderRadius:999,
            background:"rgba(74,222,128,0.15)", border:"1px solid rgba(74,222,128,0.3)", color:"#4ade80" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", animation:"pulse3 1.5s infinite" }} />
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.15em" }}>LIVE</span>
          </div>
          <div style={{ borderLeft:"1px solid rgba(255,255,255,0.08)", paddingLeft:12 }}>
            <div style={{ padding:"6px 16px", borderRadius:8,
              background:`linear-gradient(135deg, rgba(236,72,153,0.15), rgba(251,191,36,0.1))`,
              border:`1px solid rgba(236,72,153,0.25)`,
              fontSize:13, fontWeight:900, color:TC }}>Dream11</div>
          </div>
        </div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"210px 1fr 185px", overflow:"hidden" }}>

        {/* Player panel */}
        <div style={{ position:"relative", overflow:"hidden",
          background:"linear-gradient(160deg, #100520 0%, #060210 100%)",
          borderRight:`1px solid rgba(236,72,153,0.12)` }}>
          <div style={{ position:"absolute", inset:0,
            background:`radial-gradient(ellipse 80% 70% at 40% 40%, rgba(236,72,153,0.1) 0%, transparent 70%)` }} />
          <div style={{ position:"absolute", inset:0,
            background:"linear-gradient(90deg, transparent 55%, rgba(6,4,20,0.97) 100%)" }} />
          <div style={{ position:"absolute", inset:0,
            background:"linear-gradient(0deg, rgba(6,4,20,0.99) 0%, transparent 35%)" }} />
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:90, fontWeight:900, color:"rgba(236,72,153,0.07)", userSelect:"none" }}>VK</div>

          {/* Jersey */}
          <div style={{ position:"absolute", top:16, left:16, width:42, height:42, borderRadius:10,
            background:`linear-gradient(135deg, ${TC}, ${GOLD})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:12, fontWeight:900, color:"#fff" }}>#18</div>

          {/* Category - gradient pill */}
          <div style={{ position:"absolute", top:16, right:12, padding:"4px 10px", borderRadius:999,
            background:`linear-gradient(90deg, ${TC}, ${GOLD})`,
            fontSize:9, fontWeight:900, color:"#fff", letterSpacing:"0.12em" }}>PLATINUM</div>

          {/* Bottom */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"10px 14px",
            background:"rgba(0,0,0,0.75)", borderTop:`1px solid rgba(236,72,153,0.1)` }}>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.1em" }}>India · Age 35</div>
            <div style={{ display:"flex", gap:4, marginTop:5, flexWrap:"wrap" }}>
              {["BATSMAN","RHB","ODI:284"].map(s => (
                <span key={s} style={{ fontSize:9, padding:"2px 6px", borderRadius:999,
                  background:`rgba(236,72,153,0.12)`, border:`1px solid rgba(236,72,153,0.2)`,
                  color:"rgba(255,255,255,0.6)", fontFamily:"monospace" }}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Bid info */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"24px 28px", overflow:"hidden" }}>
          <div>
            <div style={{ fontSize:11, fontFamily:"monospace", letterSpacing:"0.25em", textTransform:"uppercase",
              color:"rgba(236,72,153,0.5)", marginBottom:6 }}>BATSMAN · RIGHT HAND</div>
            <div style={{ lineHeight:1 }}>
              <div style={{ fontSize:38, fontWeight:900, color:"rgba(255,255,255,0.4)" }}>VIRAT</div>
              <div style={{ fontSize:76, fontWeight:900, lineHeight:0.9,
                background:`linear-gradient(90deg, ${TC} 0%, ${GOLD} 100%)`,
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>KOHLI</div>
            </div>
            <div style={{ marginTop:8, fontSize:11, color:"rgba(255,255,255,0.25)", fontFamily:"monospace" }}>
              Available: Mar 15–Apr 30 · 3x MVP
            </div>
          </div>

          <div>
            <div style={{ fontSize:10, fontFamily:"monospace", letterSpacing:"0.2em", textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:4 }}>CURRENT BID</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:20, marginBottom:14 }}>
              <div style={{ fontSize:60, fontWeight:900, color:"#fff", lineHeight:1 }}>₹14 Cr</div>
              <div style={{ marginBottom:3 }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace" }}>BASE</div>
                <div style={{ fontSize:18, fontWeight:700, color:"rgba(255,255,255,0.45)" }}>₹2 Cr</div>
              </div>
              <div style={{ marginBottom:3 }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace" }}>STEP</div>
                <div style={{ fontSize:18, fontWeight:700, color:"rgba(255,255,255,0.45)" }}>₹10L</div>
              </div>
            </div>

            {/* Leading team */}
            <div style={{ display:"inline-flex", alignItems:"center", gap:12, padding:"10px 18px",
              borderRadius:12, marginBottom:14,
              background:`linear-gradient(90deg, rgba(236,72,153,0.15), rgba(251,191,36,0.08))`,
              border:`1px solid rgba(236,72,153,0.25)` }}>
              <div style={{ width:30, height:30, borderRadius:8,
                background:`linear-gradient(135deg, ${TC}, ${GOLD})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:10, fontWeight:900, color:"#fff" }}>MW</div>
              <div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontFamily:"monospace", letterSpacing:"0.15em" }}>LEADING BID</div>
                <div style={{ fontSize:18, fontWeight:900, color:"#fff" }}>MUMBAI WARRIORS</div>
              </div>
            </div>

            {/* Timer */}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px",
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10,
              width:"fit-content" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:GOLD, animation:"pulse3 1.5s infinite" }} />
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontFamily:"monospace", letterSpacing:"0.15em" }}>TIMER</span>
              <span style={{ fontSize:26, fontWeight:900, color:GOLD, fontFamily:"monospace" }}>0:28</span>
            </div>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            {[["IPL CAPS","237"],["AVG","52.4"],["SR","131.2"],["100s","7"]].map(([l,v]) => (
              <div key={l} style={{ flex:1, padding:"8px 8px", borderRadius:10,
                background:"rgba(255,255,255,0.03)",
                border:`1px solid rgba(236,72,153,0.12)`, textAlign:"center" }}>
                <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:15, fontWeight:900, color:"#fff" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Purse panel */}
        <div style={{ display:"flex", flexDirection:"column", borderLeft:`1px solid rgba(236,72,153,0.1)`, overflow:"hidden" }}>
          <div style={{ padding:"14px 12px", borderBottom:`1px solid rgba(236,72,153,0.08)`, flex:1 }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.3)", marginBottom:10 }}>TEAM PURSE</div>
            {TEAMS.map(t => (
              <div key={t.s} style={{ marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:t.c }} />
                    <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.75)" }}>{t.s}</span>
                  </div>
                  <span style={{ fontSize:10, fontFamily:"monospace", color:t.c }}>{t.purse}</span>
                </div>
                <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.05)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:2, background:t.c, width:`${t.pct}%`, opacity:0.7 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding:"10px 12px", borderBottom:`1px solid rgba(236,72,153,0.08)` }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.15em", color:"rgba(255,255,255,0.3)", marginBottom:6 }}>NEXT UP</div>
            {["Rohit Sharma","J. Bumrah"].map(n => (
              <div key={n} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                <div style={{ width:22, height:22, borderRadius:6,
                  background:`rgba(236,72,153,0.1)`, border:`1px solid rgba(236,72,153,0.2)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, fontWeight:700, color:TC }}>{n[0]}{n.split(" ")[1]?.[0]}</div>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:9, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.15em", color:"rgba(255,255,255,0.25)", marginBottom:3 }}>SOLD TODAY</div>
            <div style={{ fontSize:34, fontWeight:900,
              background:`linear-gradient(135deg, ${TC}, ${GOLD})`,
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>42</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", fontFamily:"monospace" }}>of 60</div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center",
        borderTop:`1px solid rgba(236,72,153,0.15)`,
        background:"rgba(0,0,0,0.6)", overflow:"hidden" }}>
        <div style={{ padding:"0 14px", fontSize:9, fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.2em", color:"rgba(255,255,255,0.2)", whiteSpace:"nowrap", flexShrink:0 }}>POWERED BY</div>
        <div style={{ flex:1, overflow:"hidden" }}>
          <div style={{ display:"flex", gap:40, animation:"mq2 18s linear infinite", whiteSpace:"nowrap" }}>
            {["Dream11","Jio Cinema","TATA","PayTM","MRF","Pepsi","Dream11","Jio Cinema","TATA","PayTM","MRF","Pepsi"].map((n,i)=>(
              <span key={i} style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.3)" }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
