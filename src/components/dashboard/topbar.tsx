"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Bell, X, Wallet, Plus, Globe } from "lucide-react";
import { useSession } from "./session-ctx";
import { useLanguage } from "@/lib/language-context";
import { Pip } from "./ui";
import { getWallet, getNotifications, getUnreadNotificationCount, markAllNotificationsRead, notificationHref, type WalletDto, type NotificationDto } from "@/lib/api";
import { fmt } from "@/lib/dashboard-data";
import { PaymentApprovalModal } from "@/components/payments/payment-approval-modal";

export const TB_HEIGHT = 64;

export function Topbar({ onToggleMenu }: { onToggleMenu?: () => void }) {
  const { t, language, setLanguage } = useLanguage();
  const pathname  = usePathname();
  const session   = useSession();
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [wallet,       setWallet]       = useState<WalletDto | null>(null);
  const [notifs,       setNotifs]       = useState<NotificationDto[]>([]);
  const [unread,       setUnread]       = useState(0);

  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";

  const ref = useRef<HTMLElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const [dateMounted, setDateMounted] = useState(false);

  const isOwner = pathname.startsWith("/owner");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    const fetchAll = () => {
      getWallet(token).then(setWallet).catch(() => {});
      getNotifications(token, 0, 15).then(p => setNotifs(p.content)).catch(() => {});
      getUnreadNotificationCount(token).then(setUnread).catch(() => {});
    };

    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [isOwner, currentLocale]);

  // Opening the bell marks everything read.
  function openNotifs() {
    setNotifOpen(v => {
      const next = !v;
      if (next && unread > 0) {
        const token = localStorage.getItem("access_token");
        if (token) {
          markAllNotificationsRead(token).catch(() => {});
          setUnread(0);
          setNotifs(ns => ns.map(n => ({ ...n, read: true })));
        }
      }
      return next;
    });
  }

  useEffect(() => {
    setDateMounted(true);
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getPageTitle = (path: string) => {
    let key = "dashboard";
    if (path === "/seeker/applications") key = "applications";
    else if (path === "/seeker/jobs" || path.startsWith("/seeker/jobs/")) key = "jobs";
    else if (path === "/seeker/earnings" || path.startsWith("/seeker/earnings/")) key = "earnings";
    else if (path === "/seeker/bonuses") key = "bonuses";
    else if (path === "/seeker/analytics" || path === "/owner/analytics") key = "analytics";
    else if (path === "/seeker/settings" || path === "/owner/settings") key = "settings";
    else if (path === "/owner/offers" || path.startsWith("/owner/offers/")) key = "offers";
    else if (path === "/owner/payments") key = "payments";
    else if (path === "/owner/workers" || path.startsWith("/owner/workers/")) key = "workers";
    else if (path === "/owner/help" || path === "/seeker/help") key = "help";
    else if (path.startsWith("/owner/jobs/")) key = "jobs";
    else if (path === "/seeker" || path === "/owner") key = "dashboard";
    
    return t("common.nav." + key);
  };

  const title   = getPageTitle(pathname);
  const unreadN = unread;
  const dateLocale = language === "fr" ? "fr-FR" : language === "sw" ? "sw" : language === "kinyy" ? "rw-RW" : "en-GB";

  return (
    <header className="dashboard-topbar" ref={ref} style={{
      position:"fixed", left:"var(--sb-width)", top:0, right:0, height:"var(--tb-height)",
      background:"rgba(9,9,9,0.97)", borderBottom:"1px solid #161616",
      backdropFilter:"blur(14px)",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 28px", zIndex:90,
      fontFamily:"Inter, DM Sans, system-ui, sans-serif",
    }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button 
          className="mobile-menu-btn" 
          onClick={onToggleMenu}
          style={{ background:"transparent", border:"none", color:"#fff", cursor:"pointer", padding:0 }}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div>
          <p className="topbar-title" style={{ margin:0, fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"-0.4px" }}>{title}</p>
          <p style={{ margin:0, fontSize:11, color:"#2e2e2e", display: "none" }} className="topbar-date">
            {dateMounted ? new Date().toLocaleDateString(dateLocale, { weekday:"long", day:"numeric", month:"long", year:"numeric" }) : ""}
          </p>
          <style>{`@media (min-width: 600px) { .topbar-date { display: block !important; } }`}</style>
          <style>{`
            .topbar-icon-btn {
              background: #131313; border: 1px solid #1c1c1c;
              border-radius: 10px; width: 40px; height: 40px;
              display: flex; align-items: center; justify-content: center;
              cursor: pointer; transition: color 0.12s, border-color 0.12s;
            }
            .topbar-icon-btn:hover { border-color: #252525; color: #f97316; }

            .topbar-lang-item {
              display: flex; align-items: center; justify-content: space-between;
              width: 100%; padding: 6px 10px; border-radius: 8px; background: transparent;
              border: none; color: #b0b0b0; font-size: 12px; font-weight: 500;
              cursor: pointer; transition: background 0.12s, color 0.12s;
            }
            .topbar-lang-item:hover { background: #242424; color: #fff; }
            .topbar-lang-item.active { background: rgba(249,115,22,0.1); color: #f97316; font-weight: 700; }

            @media (max-width: 500px) {
              .wallet-label { display: none !important; }
              .wallet-btn { padding: 9px 10px !important; }
            }
            @media (max-width: 400px) {
              .notif-panel { width: 280px !important; right: -60px !important; }
            }
            @media (max-width: 340px) {
              .topbar-icon-btn {
                width: 30px !important;
                height: 30px !important;
                border-radius: 6px !important;
              }
              .wallet-btn {
                padding: 4px 6px !important;
                border-radius: 6px !important;
              }
              .wallet-label, .wallet-plus {
                display: none !important;
              }
              .wallet-amount {
                font-size: 11px !important;
              }
              .dashboard-topbar {
                padding: 0 10px !important;
              }
              .topbar-title {
                display: none !important;
              }
            }
          `}</style>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>

        <a href={isOwner ? "/owner/payments" : "/seeker/earnings"} className="wallet-btn" style={{
          display:"flex", alignItems:"center", gap:8,
          background:"#131313", border:"1px solid #1c1c1c", borderRadius:10,
          padding:"9px 16px", textDecoration:"none", flexShrink:0,
        }}>
          <Wallet size={13} color="#f97316" />
          <span className="wallet-label" style={{ fontSize:11, color:"#3a3a3a", fontWeight:600 }}>{t("common.nav.wallet") || "Wallet"}</span>
          <span className="wallet-amount" style={{ fontSize:14, fontWeight:800, color: wallet ? (wallet.balance > 0 ? "#f0f0f0" : "#ef4444") : "#555" }}>
            {wallet ? fmt(wallet.balance) : "…"}
          </span>
          <Plus size={11} color="#f97316" className="wallet-plus" />
        </a>

        {/* Language Selector */}
        <div style={{ position:"relative" }} ref={langDropdownRef}>
          <button
            className="topbar-icon-btn"
            onClick={() => setLangDropdownOpen(v => !v)}
            aria-label="Select language"
            aria-expanded={langDropdownOpen}
            style={{ color: langDropdownOpen ? "#f97316" : "#555" }}
          >
            <Globe size={15} />
          </button>
          
          {langDropdownOpen && (
            <div className="lang-dropdown-panel" style={{
              position:"absolute", top:"calc(100% + 8px)", right:0, width:140,
              background:"#141414", border:"1px solid #1e1e1e", borderRadius:14,
              boxShadow:"0 20px 60px rgba(0,0,0,0.7)", padding:"6px",
              display:"flex", flexDirection:"column", gap:"2px", zIndex:200,
            }}>
              <button onClick={() => { setLanguage("en"); setLangDropdownOpen(false); }} className={`topbar-lang-item${language === "en" ? " active" : ""}`}>
                <span>English</span>
                {language === "en" && <span style={{ fontSize: 10 }}>✓</span>}
              </button>
              <button onClick={() => { setLanguage("fr"); setLangDropdownOpen(false); }} className={`topbar-lang-item${language === "fr" ? " active" : ""}`}>
                <span>Français</span>
                {language === "fr" && <span style={{ fontSize: 10 }}>✓</span>}
              </button>
              <button onClick={() => { setLanguage("sw"); setLangDropdownOpen(false); }} className={`topbar-lang-item${language === "sw" ? " active" : ""}`}>
                <span>Kiswahili</span>
                {language === "sw" && <span style={{ fontSize: 10 }}>✓</span>}
              </button>
              <button onClick={() => { setLanguage("kinyy"); setLangDropdownOpen(false); }} className={`topbar-lang-item${language === "kinyy" ? " active" : ""}`}>
                <span>Kinyarwanda</span>
                {language === "kinyy" && <span style={{ fontSize: 10 }}>✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Employer payment approvals — pending per-period requests with countdown */}
        {isOwner && <PaymentApprovalModal />}

        <div style={{ position:"relative" }}>
          <button
            onClick={openNotifs}
            className="topbar-icon-btn"
            style={{ color: notifOpen ? "#f97316" : "#555" }}
          >
            <Bell size={15} />
            {unreadN > 0 && <Pip n={unreadN} />}
          </button>

          {notifOpen && (
            <DropPanel title={t("common.nav.notifications") || "Notifications"} onClose={() => setNotifOpen(false)}>
              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {notifs.length > 0 ? notifs.map((n) => {
                  const jobId = n.data?.jobId;
                  // Job notifications route to the recipient's own dashboard view; everything else
                  // uses the stored url, reduced to a same-origin path so a bad host can't send it
                  // to a dead page or a login screen.
                  const link = jobId
                    ? (isOwner ? `/owner/jobs/${jobId}` : `/seeker/jobs/${jobId}`)
                    : notificationHref(n.data?.url);
                  const time = n.createdAt ? new Date(n.createdAt).toLocaleDateString(currentLocale) : "";
                  return (
                    <div key={n.id} style={{ padding:"14px 16px", borderBottom:"1px solid #141414", display:"flex", gap:10, background: n.read ? "transparent" : "rgba(249,115,22,0.04)" }}>
                      <div style={{ width:6, height:6, borderRadius:99, marginTop:5, flexShrink:0, background: n.read ? "#333" : "#f97316" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin:"0 0 3px", fontSize:12, fontWeight:700, color:"#e0e0e0", lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{n.title}</p>
                        {/* Clamp to three lines: a post with no excerpt stores its whole body here,
                            which otherwise fills the dropdown with one notification. */}
                        <p style={{ margin:"0 0 6px", fontSize:12, color:"#a0a0a0", lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", wordBreak:"break-word" }}>{n.body}</p>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <p style={{ margin:0, fontSize:10, color:"#444" }}>{time}</p>
                          {link && <a href={link} style={{ fontSize:10, color:"#f97316", textDecoration:"none", fontWeight:600 }}>{t("seeker_jobs.track_link") || "View"} →</a>}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ padding:"24px 16px", textAlign:"center" }}>
                    <p style={{ margin:0, fontSize:12, color:"#3a3a3a" }}>{t("notifications.no_new") || "No new notifications"}</p>
                  </div>
                )}
              </div>
              {/* The bell holds only the newest few and clips the text — full history lives here. */}
              <a href={isOwner ? "/owner/notifications" : "/seeker/notifications"}
                 onClick={() => setNotifOpen(false)}
                 style={{
                   display: "block", padding: "12px 16px", borderTop: "1px solid #1a1a1a",
                   fontSize: 12, fontWeight: 700, color: "#f97316", textDecoration: "none", textAlign: "center",
                 }}>
                {t("notifications.view_all") || "View all notifications"}
              </a>
            </DropPanel>
          )}
        </div>

      </div>
    </header>
  );
}

function DropPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="notif-panel" style={{
      position:"absolute", top:"calc(100% + 8px)", right:0, width:308,
      background:"#141414", border:"1px solid #1e1e1e", borderRadius:14,
      boxShadow:"0 20px 60px rgba(0,0,0,0.7)", animation:"fadeIn 0.13s ease", zIndex:200,
    }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @media (max-width: 340px) {
          .notif-panel {
            width: 280px !important;
            right: -40px !important;
          }
        }
      `}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px 10px", borderBottom:"1px solid #1a1a1a" }}>
        <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#e0e0e0" }}>{title}</p>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#444", display:"flex" }}><X size={14} /></button>
      </div>
      {children}
    </div>
  );
}
