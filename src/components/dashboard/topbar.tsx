"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Bell, X, Wallet, Plus } from "lucide-react";
import { useSession } from "./session-ctx";
import { SB_WIDTH } from "./sidebar";
import { Pip } from "./ui";
import { getWallet, getPendingApplicationCount, getMyApplications, type WalletDto } from "@/lib/api";
import { fmt } from "@/lib/dashboard-data";

export const TB_HEIGHT = 64;

const TITLE_MAP: Record<string, string> = {
  "/seeker/applications": "My Applications",
  "/seeker/jobs":         "My Jobs",
  "/seeker/earnings":     "My Earnings",
  "/seeker/bonuses":      "Bonuses",
  "/seeker/analytics":   "Analytics",
  "/seeker/settings":    "Settings",
  "/owner/offers":        "My Offers",
  "/owner/payments":      "Payments",
  "/owner/workers":       "Workers",
  "/owner/analytics":    "Analytics",
  "/owner/settings":     "Settings",
  "/seeker":             "Dashboard",
  "/owner/help":          "Help",
};

export function Topbar() {
  const pathname  = usePathname();
  const session   = useSession();
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [wallet,       setWallet]       = useState<WalletDto | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [seekerNotifs, setSeekerNotifs] = useState<{ text: string; time: string }[]>([]);
  const ref = useRef<HTMLElement>(null);

  const isOwner = pathname.startsWith("/owner");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    getWallet(token).then(setWallet).catch(() => {});

    if (isOwner) {
      getPendingApplicationCount(token).then(setPendingCount).catch(() => {});
    } else {
      getMyApplications(token).then(apps => {
        const notifs = apps
          .filter(a => a.status === "ACCEPTED" || a.status === "REJECTED")
          .slice(0, 5)
          .map(a => ({
            text: a.status === "ACCEPTED"
              ? `Your application for "${a.jobTitle}" was accepted!`
              : `Your application for "${a.jobTitle}" was not selected.`,
            time: a.respondedAt ? new Date(a.respondedAt).toLocaleDateString() : "Recently",
          }));
        setSeekerNotifs(notifs);
      }).catch(() => {});
    }
  }, [isOwner]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const title   = TITLE_MAP[pathname] ?? "Dashboard";
  const unreadN = isOwner ? pendingCount : seekerNotifs.length;

  return (
    <header ref={ref} style={{
      position:"fixed", left:SB_WIDTH, top:0, right:0, height:TB_HEIGHT,
      background:"rgba(9,9,9,0.97)", borderBottom:"1px solid #161616",
      backdropFilter:"blur(14px)",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 28px", zIndex:90,
      fontFamily:"Inter, DM Sans, system-ui, sans-serif",
    }}>

      <div>
        <p style={{ margin:0, fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"-0.4px" }}>{title}</p>
        <p style={{ margin:0, fontSize:11, color:"#2e2e2e" }}>
          {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
        </p>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8 }}>

        <a href={isOwner ? "/owner/payments" : "/seeker/earnings"} style={{
          display:"flex", alignItems:"center", gap:8,
          background:"#131313", border:"1px solid #1c1c1c", borderRadius:10,
          padding:"9px 16px", textDecoration:"none",
        }}>
          <Wallet size={13} color="#f97316" />
          <span style={{ fontSize:11, color:"#3a3a3a", fontWeight:600 }}>Wallet</span>
          <span style={{ fontSize:14, fontWeight:800, color: wallet ? (wallet.balance > 0 ? "#f0f0f0" : "#ef4444") : "#555" }}>
            {wallet ? fmt(wallet.balance) : "…"}
          </span>
          <Plus size={11} color="#f97316" />
        </a>

        <div style={{ position:"relative" }}>
          <button
            onClick={() => setNotifOpen(p => !p)}
            style={{
              position:"relative", background:"#131313", border:"1px solid #1c1c1c",
              borderRadius:10, width:40, height:40,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", color: notifOpen ? "#f97316" : "#555",
            }}
          >
            <Bell size={15} />
            {unreadN > 0 && <Pip n={unreadN} />}
          </button>

          {notifOpen && (
            <DropPanel title="Notifications" onClose={() => setNotifOpen(false)}>
              {isOwner ? (
                pendingCount > 0 ? (
                  <div style={{ padding:"14px 16px", borderBottom:"1px solid #141414", display:"flex", gap:10 }}>
                    <div style={{ width:6, height:6, borderRadius:99, marginTop:5, flexShrink:0, background:"#f97316" }} />
                    <div>
                      <p style={{ margin:"0 0 6px", fontSize:12, color:"#c0c0c0", lineHeight:1.6 }}>
                        You have <strong style={{ color:"#f97316" }}>{pendingCount}</strong> pending
                        application{pendingCount !== 1 ? "s" : ""} waiting for review.
                      </p>
                      <a href="/owner/workers" style={{ fontSize:11, color:"#f97316", fontWeight:700, textDecoration:"none" }}>
                        Review now →
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:"24px 16px", textAlign:"center" }}>
                    <p style={{ margin:0, fontSize:12, color:"#3a3a3a" }}>No pending applications</p>
                  </div>
                )
              ) : (
                seekerNotifs.length > 0 ? seekerNotifs.map((n, i) => (
                  <div key={i} style={{ padding:"11px 16px", borderBottom:"1px solid #141414", display:"flex", gap:10 }}>
                    <div style={{ width:6, height:6, borderRadius:99, marginTop:5, flexShrink:0, background:"#f97316" }} />
                    <div>
                      <p style={{ margin:"0 0 3px", fontSize:12, color:"#c0c0c0", lineHeight:1.5 }}>{n.text}</p>
                      <p style={{ margin:0, fontSize:10, color:"#2e2e2e" }}>{n.time}</p>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding:"24px 16px", textAlign:"center" }}>
                    <p style={{ margin:0, fontSize:12, color:"#3a3a3a" }}>No new notifications</p>
                  </div>
                )
              )}
              <div style={{ padding:"9px 16px" }}>
                <a href={isOwner ? "/owner/workers" : "/seeker/applications"}
                  style={{ display:"block", textAlign:"center", fontSize:12, color:"#f97316", fontWeight:600, textDecoration:"none" }}>
                  {isOwner ? "Manage applications" : "View all applications"}
                </a>
              </div>
            </DropPanel>
          )}
        </div>

      </div>
    </header>
  );
}

function DropPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position:"absolute", top:"calc(100% + 8px)", right:0, width:308,
      background:"#141414", border:"1px solid #1e1e1e", borderRadius:14,
      boxShadow:"0 20px 60px rgba(0,0,0,0.7)", animation:"fadeIn 0.13s ease", zIndex:200,
    }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px 10px", borderBottom:"1px solid #1a1a1a" }}>
        <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#e0e0e0" }}>{title}</p>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#444", display:"flex" }}><X size={14} /></button>
      </div>
      {children}
    </div>
  );
}
