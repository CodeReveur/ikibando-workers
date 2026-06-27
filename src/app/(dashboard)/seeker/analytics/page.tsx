"use client";

import { useEffect, useState } from "react";
import { getWalletTransactions, getMyApplications, type PaymentDto, type ApplicationDto } from "@/lib/api";
import { StatCard, BarChart, PageLoader } from "@/components/dashboard/ui";
import { fmt } from "@/lib/dashboard-data";

interface BarDatum { day: string; v: number; }

const DAYS_ORDERED = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function buildWeeklyBars(txns: PaymentDto[]): BarDatum[] {
  const totals: Record<string, number> = { Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0 };
  const now = Date.now();
  txns
    .filter(t => t.status === "RELEASED" && t.releasedAt && now - new Date(t.releasedAt).getTime() < 7 * 86_400_000)
    .forEach(t => {
      const d   = new Date(t.releasedAt!);
      const key = DAYS_ORDERED[(d.getDay() + 6) % 7];
      totals[key] += t.amountRwf;
    });
  return DAYS_ORDERED.map(d => ({ day:d, v:totals[d] }));
}

function buildCategoryBreakdown(apps: ApplicationDto[]) {
  const counts: Record<string, number> = {};
  apps.forEach(a => { const c = a.jobCategory || "Other"; counts[c] = (counts[c] ?? 0) + 1; });
  const total  = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const COLORS = ["#f97316","#60a5fa","#a78bfa","#22c55e","#f59e0b"];
  return Object.entries(counts)
    .sort((a,b) => b[1] - a[1]).slice(0, 5)
    .map(([cat, n], i) => ({ cat, pct: Math.round((n / total) * 100), color: COLORS[i % COLORS.length] }));
}

export default function SeekerAnalytics() {
  const [txns,    setTxns]    = useState<PaymentDto[]>([]);
  const [apps,    setApps]    = useState<ApplicationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    Promise.all([
      getWalletTransactions(token).catch(() => [] as PaymentDto[]),
      getMyApplications(token).catch(()  => [] as ApplicationDto[]),
    ]).then(([t, a]) => { setTxns(t); setApps(a); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const released    = txns.filter(t => t.status === "RELEASED");
  const totalEarned = released.reduce((s, t) => s + t.amountRwf, 0);
  const inEscrow    = txns.filter(t => t.status === "PENDING").reduce((s, t) => s + t.amountRwf, 0);
  const jobsDone    = released.length;

  const bars       = buildWeeklyBars(txns);
  const maxV       = Math.max(...bars.map(b => b.v), 1);
  const weekTotal  = bars.reduce((s, b) => s + b.v, 0);
  const activeDays = bars.filter(b => b.v > 0).length;

  const accepted   = apps.filter(a => a.status === "ACCEPTED").length;
  const responded  = apps.filter(a => ["ACCEPTED","REJECTED","WITHDRAWN"].includes(a.status)).length;
  const completionRate = responded > 0 ? Math.round((jobsDone / responded) * 100) : 0;
  const categories = buildCategoryBreakdown(apps);

  // Category earnings
  const catEarnings: Record<string, number> = {};
  txns.filter(t => t.status === "RELEASED").forEach(t => {
    const cat = t.jobTitle ?? "Other";
    catEarnings[cat] = (catEarnings[cat] ?? 0) + t.amountRwf;
  });
  const catEntries = Object.entries(catEarnings).sort((a,b) => b[1]-a[1]).slice(0,5);
  const catMax     = catEntries[0]?.[1] ?? 1;
  const COLORS     = ["#f97316","#60a5fa","#22c55e","#a78bfa","#f59e0b"];

  return (
    <div>
      {/* Top stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
        <StatCard label="This Week"    value={fmt(weekTotal)}   sub="Released earnings"  accent="#f97316" />
        <StatCard label="Total Earned" value={fmt(totalEarned)} sub="All-time released"  accent="#22c55e" />
        <StatCard label="Jobs Done"    value={String(jobsDone)} sub="Completed & paid"   accent="#60a5fa" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
        <StatCard label="In Escrow"    value={fmt(inEscrow)}        sub="Awaiting release"   accent="#f59e0b" />
        <StatCard label="Active Jobs"  value={String(accepted)}      sub="Currently hired"    accent="#a78bfa" />
        <StatCard label="Applications" value={String(apps.length)}   sub="All time"           accent="#60a5fa" />
      </div>

      {/* Weekly earnings chart */}
      <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"22px 24px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Weekly Earnings</p>
          <span style={{ fontSize:11, color:"#333" }}>
            {activeDays > 0 ? `Avg ${fmt(Math.round(weekTotal / activeDays))}/active day` : "Last 7 days"}
          </span>
        </div>
        {weekTotal === 0 ? (
          <p style={{ margin:0, fontSize:12, color:"#333", textAlign:"center", padding:"30px 0" }}>
            No released payments this week yet.
          </p>
        ) : (
          <BarChart bars={bars} maxVal={maxV} color="#f97316" />
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* Completion rate donut */}
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px" }}>
          <p style={{ margin:"0 0 18px", fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Completion Rate</p>
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ position:"relative", width:80, height:80, flexShrink:0 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#1a1a1a" strokeWidth="9"/>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#f97316" strokeWidth="9"
                  strokeDasharray={`${(completionRate / 100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                  strokeDashoffset={2 * Math.PI * 32 * 0.25}
                  strokeLinecap="round"
                />
              </svg>
              <p style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", margin:0, fontWeight:900, fontSize:15, color:"#fff" }}>
                {completionRate}%
              </p>
            </div>
            <div>
              <p style={{ margin:"0 0 6px", fontSize:24, fontWeight:900, color:"#e0e0e0" }}>{completionRate}%</p>
              <p style={{ margin:0, fontSize:11, color:"#444" }}>Based on {responded} resolved</p>
              <p style={{ margin:"4px 0 0", fontSize:11, color:"#333" }}>{jobsDone} completed out of {responded}</p>
            </div>
          </div>

          {/* Application breakdown */}
          <div style={{ marginTop:18, borderTop:"1px solid #191919", paddingTop:14 }}>
            {[
              { label:"Accepted",  count:apps.filter(a => a.status === "ACCEPTED").length,  color:"#22c55e" },
              { label:"Pending",   count:apps.filter(a => a.status === "PENDING").length,   color:"#f59e0b" },
              { label:"Rejected",  count:apps.filter(a => a.status === "REJECTED").length,  color:"#ef4444" },
              { label:"Withdrawn", count:apps.filter(a => a.status === "WITHDRAWN").length, color:"#555" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #191919" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:7, height:7, borderRadius:99, background:color }} />
                  <span style={{ fontSize:12, color:"#444" }}>{label}</span>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:"#d0d0d0" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* By job category applied */}
          <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px" }}>
            <p style={{ margin:"0 0 16px", fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Top Categories</p>
            {categories.length === 0 ? (
              <p style={{ margin:0, fontSize:12, color:"#333" }}>No job history yet</p>
            ) : categories.map(({ cat, pct, color }) => (
              <div key={cat} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:"#555", textTransform:"capitalize" }}>{cat}</span>
                  <span style={{ fontSize:12, fontWeight:700, color }}>{pct}%</span>
                </div>
                <div style={{ height:5, background:"#1a1a1a", borderRadius:99 }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width 0.4s" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Earnings by job */}
          {catEntries.length > 0 && (
            <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px" }}>
              <p style={{ margin:"0 0 16px", fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Earnings by Job</p>
              {catEntries.map(([name, amt], i) => {
                const pct = Math.round((amt / catMax) * 100);
                return (
                  <div key={name} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ fontSize:11, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"65%" }}>{name}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:COLORS[i % COLORS.length] }}>{fmt(amt)}</span>
                    </div>
                    <div style={{ height:4, background:"#1a1a1a", borderRadius:99 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:COLORS[i % COLORS.length], borderRadius:99, transition:"width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
