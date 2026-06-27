/* Shared primitive components used across all dashboard pages */

export function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent: string;
}) {
  return (
    <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px" }}>
      <p style={{ margin:"0 0 10px", fontSize:10, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</p>
      <p style={{ margin:"0 0 4px", fontSize:26, fontWeight:900, color:accent, letterSpacing:"-1px", lineHeight:1 }}>{value}</p>
      <p style={{ margin:0, fontSize:11, color:"#2e2e2e" }}>{sub}</p>
    </div>
  );
}

export function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
      <p style={{ margin:0, fontSize:14, fontWeight:800, color:"#e0e0e0", letterSpacing:"-0.2px" }}>{title}</p>
      {action}
    </div>
  );
}

export function BarChart({ bars, maxVal, color }: {
  bars: { day: string; v: number }[];
  maxVal: number;
  color: string;
}) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:110 }}>
      {bars.map(b => (
        <div key={b.day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%" }}>
          <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
            <div style={{
              width:"100%", borderRadius:"5px 5px 0 0",
              height: maxVal > 0 ? `${Math.max((b.v / maxVal) * 100, b.v > 0 ? 6 : 0)}%` : "4px",
              background: b.v > 0 ? color : "#1a1a1a",
              transition:"height 0.3s",
            }} />
          </div>
          <p style={{ margin:0, fontSize:10, color:"#333", fontWeight:600 }}>{b.day}</p>
        </div>
      ))}
    </div>
  );
}

export function Dot() {
  return <span style={{ fontSize:12, color:"#252525" }}>·</span>;
}

export function Pip({ n }: { n: number }) {
  return (
    <span style={{
      position:"absolute", top:-5, right:-5, minWidth:16, height:16,
      background:"#f97316", borderRadius:99, fontSize:9, fontWeight:800,
      color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
      border:"2px solid #090909", padding:"0 3px", pointerEvents:"none",
    }}>{n}</span>
  );
}

export function DashCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="dash-card" style={{
      background:"#131313", border:"1px solid #1c1c1c", borderRadius:14,
      transition:"border-color 0.12s, background 0.12s",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function PageLoader() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh" }}>
      <div style={{ width:24, height:24, border:"3px solid #f97316", borderTopColor:"transparent", borderRadius:999, animation:"spin 0.7s linear infinite" }} />
    </div>
  );
}
