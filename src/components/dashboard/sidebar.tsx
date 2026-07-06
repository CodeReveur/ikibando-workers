"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText, Briefcase, Wallet, Gift, BarChart2, Settings,
  Send, CreditCard, Users, HelpCircle, LogOut, Home
} from "lucide-react";
import { useSession } from "./session-ctx";
import { useLanguage } from "@/lib/language-context";

/* ── constants ──────────────────────────────────────────────────────────── */
export const SB_WIDTH = 260;

const SEEKER_NAV = [
  { href:"/seeker",              label:"Dashboard",       icon:Home },
  { href:"/seeker/applications", label:"My Applications", icon:FileText  },
  { href:"/seeker/jobs",         label:"My Jobs",         icon:Briefcase },
  { href:"/seeker/earnings",     label:"My Earnings",     icon:Wallet    },
  { href:"/seeker/bonuses",      label:"Bonuses",         icon:Gift      },
  { href:"/seeker/analytics",   label:"Analytics",       icon:BarChart2 },
  { href:"/seeker/settings",    label:"Settings",        icon:Settings  },
  { href:"/seeker/help",        label:"Help",            icon:HelpCircle },
];

const OWNER_NAV = [
  { href:"/owner/offers",    label:"My Offers",  icon:Send       },
  { href:"/owner/payments",  label:"Payments",   icon:CreditCard },
  { href:"/owner/workers",   label:"Workers",    icon:Users      },
  { href:"/owner/analytics", label:"Analytics",  icon:BarChart2  },
  { href:"/owner/settings",  label:"Settings",   icon:Settings   },
  { href:"/owner/help",      label:"Help",       icon:HelpCircle },
];

/* ── sidebar ─────────────────────────────────────────────────────────────── */
export function Sidebar({ mobileOpen, closeMobile }: { mobileOpen?: boolean; closeMobile?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const session  = useSession();
  const { t }    = useLanguage();

  if (!session) return (
    <aside style={{
      position:"fixed", left:0, top:0, bottom:0, width:"var(--sb-active-width)",
      background:"#090909", zIndex:100,
    }} />
  );

  const isOwner  = pathname.startsWith("/owner");
  const nav      = isOwner ? OWNER_NAV : SEEKER_NAV;
  const initials = session.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const handleSignOut = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/signin");
  };

  const getNavLabel = (href: string, defaultLabel: string) => {
    let key = "";
    if (href === "/seeker" || href === "/owner") key = "dashboard";
    else if (href === "/seeker/applications") key = "applications";
    else if (href === "/seeker/jobs") key = "jobs";
    else if (href === "/seeker/earnings") key = "earnings";
    else if (href === "/seeker/bonuses") key = "bonuses";
    else if (href === "/seeker/settings" || href === "/owner/settings") key = "settings";
    else if (href === "/owner/offers") key = "offers";
    else if (href === "/owner/payments") key = "payments";
    else if (href === "/owner/workers") key = "workers";
    else if (href === "/owner/analytics" || href === "/seeker/analytics") key = "analytics";
    else if (href === "/owner/help" || href === "/seeker/help") key = "help";
    
    return key ? t("common.nav." + key) : defaultLabel;
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sb-navlink { transition: background 0.1s, color 0.1s; text-decoration: none; }
        .sb-navlink:hover:not(.sb-active) { background: rgba(249,115,22,0.06) !important; color: #888 !important; }
        .sb-signout:hover { border-color: #ef4444 !important; color: #ef4444 !important; background: rgba(239,68,68,0.04) !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 99px; }
        .dash-card:hover { border-color: #252525 !important; background: #161616 !important; }
        @media (max-width: 340px) {
          .sidebar-logo-img {
            width: 130px !important;
            height: 28px !important;
          }
        }
      `}</style>

      <aside className={`dashboard-sidebar${mobileOpen ? " mobile-open" : ""}`} style={{
        position:"fixed", left:0, top:0, bottom:0, width:"var(--sb-active-width)",
        background:"#090909",
        display:"flex", flexDirection:"column",
        padding:10, gap:8, zIndex:100,
        fontFamily:"Inter, DM Sans, system-ui, sans-serif",
        overflow:"hidden",
      }}>

        {/* ─── LOGO CARD ──────────────────────────────────────────────── */}
        <div style={{
          background:"#131313", border:"1px solid #1c1c1c", borderRadius:14,
          padding:"15px 15px", flexShrink:0,
        }}>
          {/* Logo */}
          <a href="/" onClick={closeMobile} className="nav-logo" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
            <img src="/cover-a.png" className="sidebar-logo-img" alt="Logo" style={{ width: 190, height: 40, borderRadius: 6, objectFit: "cover" }} />
          </a>
        </div>

        {/* ─── PROFILE CARD ───────────────────────────────────────────── */}
        <div style={{
          background:"#131313", border:"1px solid #1c1c1c", borderRadius:14,
          padding:"14px 14px", flexShrink:0,
        }}>
          {/* User row */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{
              width:42, height:42, borderRadius:999, flexShrink:0,
              background:"linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:800, fontSize:15, color:"#fff",
              boxShadow:"0 0 0 2px #131313, 0 0 0 3.5px rgba(249,115,22,0.35)",
            }}>{initials}</div>

            <div style={{ minWidth:0, flex:1 }}>
              <p style={{
                margin:0, fontWeight:700, fontSize:13, color:"#e8e8e8",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              }}>{session.name}</p>
              <span style={{
                display:"inline-block", marginTop:3, fontSize:10, fontWeight:700,
                borderRadius:99, padding:"2px 7px",
                color:  isOwner ? "#f97316" : "#60a5fa",
                background: isOwner ? "rgba(249,115,22,0.1)" : "rgba(96,165,250,0.1)",
              }}>
                {isOwner ? t("common.nav.employer") : t("common.nav.job_seeker")}
              </span>
            </div>
          </div>

          {/* Sign-out button */}
          <button
            className="sb-signout"
            onClick={handleSignOut}
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              background:"transparent", border:"1px solid #1e1e1e", borderRadius:9,
              padding:"8px", fontSize:11, fontWeight:600, color:"#2e2e2e",
              cursor:"pointer", fontFamily:"inherit", transition:"all 0.12s",
            }}
          >
            <LogOut size={11} /> {t("common.nav.sign_out")}
          </button>
        </div>

        {/* ─── NAV CARD ───────────────────────────────────────────────── */}
        <div style={{
          background:"#131313", border:"1px solid #1c1c1c", borderRadius:14,
          padding:"12px 10px",
          flex:1, overflowY:"auto", minHeight:0,
          display:"flex", flexDirection:"column",
        }}>
          <p style={{ margin:"4px 0 8px 10px", fontSize:9, fontWeight:700, color:"#2a2a2a", textTransform:"uppercase", letterSpacing:"0.12em" }}>
            {t("common.nav.menu")}
          </p>

          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/seeker" || href === "/owner"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={`sb-navlink${active ? " sb-active" : ""}`}
                style={{
                  display:"flex", alignItems:"center", gap:10,
                  background: active ? "rgba(249,115,22,0.1)" : "transparent",
                  borderRadius:9, padding:"10px 12px", marginBottom:2,
                  color: active ? "#f97316" : "#555",
                }}
              >
                <Icon size={15} style={{ color: active ? "#f97316" : "#3e3e3e", flexShrink:0 }} />
                <span style={{ fontSize:13, fontWeight: active ? 700 : 500, flex:1, letterSpacing: active ? "-0.1px" : "normal" }}>
                  {getNavLabel(href, label)}
                </span>
                {active && <div style={{ width:5, height:5, borderRadius:99, background:"#f97316", flexShrink:0 }} />}
              </Link>
            );
          })}
        </div>

      </aside>
    </>
  );
}
