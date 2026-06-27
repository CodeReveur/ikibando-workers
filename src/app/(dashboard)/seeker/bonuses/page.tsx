"use client";

import { useState } from "react";
import { Zap, CheckCircle, Star, Award, TrendingUp, Shield, Copy, Users } from "lucide-react";
import { useSession } from "@/components/dashboard/session-ctx";
import { fmt } from "@/lib/dashboard-data";
import { SectionHead } from "@/components/dashboard/ui";

export default function SeekerBonuses() {
  const session = useSession();
  const [copied, setCopied] = useState(false);
  const points  = 2_400;
  const refCode = (session?.name?.split(" ")[0]?.toUpperCase() ?? "USER") + "2024";

  const copy = () => {
    navigator.clipboard.writeText(refCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const BADGES = [
    { icon:CheckCircle, label:"First Job Done",  desc:"Complete your debut",  color:"#22c55e", earned:true  },
    { icon:Star,        label:"5-Star Rating",   desc:"Maintain a 5.0 score", color:"#f59e0b", earned:true  },
    { icon:Award,       label:"10 Jobs Club",    desc:"Complete 10 jobs",     color:"#a78bfa", earned:false },
    { icon:TrendingUp,  label:"Top Worker",      desc:"Rank in top 10%",      color:"#f97316", earned:false },
    { icon:Shield,      label:"Verified Pro",    desc:"Pass identity check",  color:"#60a5fa", earned:true  },
    { icon:Zap,         label:"Speed Star",      desc:"Accept within 1 hour", color:"#fb923c", earned:false },
  ];

  return (
    <div>
      {/* Points hero */}
      <div style={{
        background:"linear-gradient(135deg,#120e00 0%,#111 100%)",
        border:"1px solid #221800", borderRadius:18, padding:"26px 28px",
        marginBottom:14, display:"flex", alignItems:"center", gap:20,
      }}>
        <div style={{
          width:62, height:62, borderRadius:18, background:"rgba(249,115,22,0.1)",
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        }}>
          <Zap size={28} color="#f97316" />
        </div>
        <div style={{ flex:1 }}>
          <p style={{ margin:"0 0 4px", fontSize:11, color:"#5a4000", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>MpahMapu Points</p>
          <p style={{ margin:"0 0 4px", fontSize:38, fontWeight:900, color:"#f97316", letterSpacing:"-1.5px" }}>{points.toLocaleString()} pts</p>
          <p style={{ margin:0, fontSize:12, color:"#4a3500" }}>Worth {fmt(points)} · 1 pt = RWF 1</p>
        </div>
        <button style={{
          background:"#f97316", color:"#fff", border:"none",
          borderRadius:10, padding:"11px 24px", fontSize:13, fontWeight:700,
          cursor:"pointer", fontFamily:"inherit", flexShrink:0,
        }}>Redeem</button>
      </div>

      {/* Referral */}
      <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Users size={15} color="#60a5fa" />
          <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#e0e0e0" }}>Referral Program</p>
        </div>
        <p style={{ margin:"0 0 14px", fontSize:13, color:"#4a4a4a", lineHeight:1.7 }}>
          Earn <strong style={{ color:"#f97316" }}>1,000 pts (RWF 1,000)</strong> for every friend who joins and completes their first job.
        </p>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{
            flex:1, background:"#0d0d0d", border:"1px solid #1e1e1e", borderRadius:9,
            padding:"10px 14px", fontSize:13, color:"#555", fontFamily:"monospace",
          }}>{refCode}</div>
          <button onClick={copy} style={{
            background: copied ? "rgba(34,197,94,0.1)" : "#1a1a1a",
            border:`1px solid ${copied ? "rgba(34,197,94,0.3)" : "#222"}`, borderRadius:9,
            padding:"10px 14px", cursor:"pointer",
            color: copied ? "#22c55e" : "#666",
            display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, fontFamily:"inherit",
            transition:"all 0.15s",
          }}>
            <Copy size={13} /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <SectionHead title="Achievements" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {BADGES.map(({ icon:Icon, label, desc, color, earned }) => (
          <div key={label} style={{
            background: earned ? "#131313" : "#0d0d0d",
            border:`1px solid ${earned ? "#1c1c1c" : "#141414"}`,
            borderRadius:14, padding:"18px 16px", textAlign:"center",
            opacity: earned ? 1 : 0.4,
          }}>
            <div style={{
              width:44, height:44, borderRadius:12, margin:"0 auto 12px",
              background: earned ? `${color}18` : "rgba(255,255,255,0.02)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Icon size={22} color={earned ? color : "#2a2a2a"} />
            </div>
            <p style={{ margin:"0 0 4px", fontSize:12, fontWeight:700, color: earned ? "#d0d0d0" : "#2a2a2a" }}>{label}</p>
            <p style={{ margin:0, fontSize:10, color:"#2e2e2e" }}>{desc}</p>
            {earned && <p style={{ margin:"6px 0 0", fontSize:9, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.06em" }}>Earned</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
