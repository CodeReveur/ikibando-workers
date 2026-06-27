"use client";

import { useEffect, useState } from "react";
import { getMyJobs, getWalletTransactions, getJobApplications, type JobDto, type PaymentDto, type ApplicationDto } from "@/lib/api";
import { StatCard, BarChart, PageLoader } from "@/components/dashboard/ui";
import { fmt } from "@/lib/dashboard-data";

interface BarDatum { day: string; v: number; }

function buildWeeklyBars(payments: PaymentDto[]): BarDatum[] {
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const totals: Record<string, number> = { Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0 };
  payments.forEach(p => {
    const d = new Date(p.createdAt);
    const key = days[(d.getDay() + 6) % 7];
    totals[key] += p.amountRwf;
  });
  return days.map(d => ({ day:d, v:totals[d] }));
}

export default function OwnerAnalytics() {
  const [jobs,     setJobs]     = useState<JobDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [allApps,  setAllApps]  = useState<ApplicationDto[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    Promise.all([
      getMyJobs(token),
      getWalletTransactions(token),
    ]).then(async ([j, p]) => {
      setJobs(j);
      setPayments(p);
      const appResults = await Promise.all(
        j.map(job => getJobApplications(job.id as unknown as string, token).catch(() => [] as ApplicationDto[]))
      );
      setAllApps(appResults.flat());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const totalSpent   = payments.reduce((s, p) => s + p.amountRwf, 0);
  const heldNow      = payments.filter(p => p.status === "HELD").reduce((s, p) => s + p.amountRwf, 0);
  const completedJobs = jobs.filter(j => (j.status as string) === "COMPLETED").length;
  const acceptedApps = allApps.filter(a => a.status === "ACCEPTED").length;
  const pendingApps  = allApps.filter(a => a.status === "PENDING").length;

  // Category breakdown
  const catTotals: Record<string, number> = {};
  payments.forEach(p => {
    const job = jobs.find(j => (j.id as unknown as string) === p.jobId);
    const cat = job?.category ?? "Other";
    catTotals[cat] = (catTotals[cat] ?? 0) + p.amountRwf;
  });
  const catEntries = Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const catMax     = catEntries[0]?.[1] ?? 1;

  const COLORS = ["#f97316","#60a5fa","#22c55e","#a78bfa","#f59e0b"];

  // Weekly bars (last 7 calendar days per payment)
  const recentPayments = payments.filter(p => {
    const d = new Date(p.createdAt);
    return Date.now() - d.getTime() < 7 * 86_400_000;
  });
  const bars  = buildWeeklyBars(recentPayments);
  const maxV  = Math.max(...bars.map(b => b.v), 1);
  const weekTotal = recentPayments.reduce((s,p) => s + p.amountRwf, 0);

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
        <StatCard label="Spent This Week"  value={fmt(weekTotal)}         sub="Last 7 days"     accent="#f97316" />
        <StatCard label="Total Deposited"  value={fmt(totalSpent)}        sub="All time"        accent="#a78bfa" />
        <StatCard label="Workers Hired"    value={String(acceptedApps)}   sub="Accepted total"  accent="#60a5fa" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
        <StatCard label="In Escrow"        value={fmt(heldNow)}           sub="Pending release" accent="#f59e0b" />
        <StatCard label="Jobs Completed"   value={String(completedJobs)}  sub="All time"        accent="#22c55e" />
        <StatCard label="Pending Review"   value={String(pendingApps)}    sub="Need action"     accent="#ef4444" />
      </div>

      {/* Weekly spending chart */}
      <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"22px 24px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Weekly Spending</p>
          <span style={{ fontSize:11, color:"#333" }}>Last 7 days</span>
        </div>
        {weekTotal === 0 ? (
          <p style={{ margin:0, fontSize:12, color:"#333", textAlign:"center", padding:"30px 0" }}>No spending data for the last 7 days</p>
        ) : (
          <BarChart bars={bars} maxVal={maxV} color="#f97316" />
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

        {/* Spending by category */}
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px" }}>
          <p style={{ margin:"0 0 18px", fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Spending by Category</p>
          {catEntries.length === 0 ? (
            <p style={{ margin:0, fontSize:12, color:"#333" }}>No category data yet</p>
          ) : catEntries.map(([cat, amount], i) => {
            const pct = Math.round((amount / catMax) * 100);
            return (
              <div key={cat} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:"#555" }}>{cat}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:COLORS[i] }}>{fmt(amount)}</span>
                </div>
                <div style={{ height:5, background:"#1a1a1a", borderRadius:99 }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:COLORS[i], borderRadius:99, transition:"width 0.4s" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Job status overview */}
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px" }}>
          <p style={{ margin:"0 0 18px", fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Offer Breakdown</p>
          {[
            { label:"Open",       count: jobs.filter(j => (j.status as string) === "OPEN").length,      color:"#60a5fa" },
            { label:"Completed",  count: jobs.filter(j => (j.status as string) === "COMPLETED").length,  color:"#22c55e" },
            { label:"Filled",     count: jobs.filter(j => (j.status as string) === "FILLED").length,     color:"#a3e635" },
            { label:"Cancelled",  count: jobs.filter(j => (j.status as string) === "CANCELLED").length,  color:"#ef4444" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #191919" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:99, background:color }} />
                <span style={{ fontSize:12, color:"#555" }}>{label}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:800, color:"#e0e0e0" }}>{count}</span>
            </div>
          ))}
          <div style={{ marginTop:14, padding:"10px 12px", background:"rgba(249,115,22,0.04)", borderRadius:9 }}>
            <p style={{ margin:0, fontSize:11, color:"#555" }}>
              Avg. job rate: <strong style={{ color:"#f97316" }}>
                {jobs.length > 0 ? fmt(Math.round(jobs.reduce((s,j) => s + j.ratePerHour, 0) / jobs.length)) : "—"}
              </strong> per hour
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
