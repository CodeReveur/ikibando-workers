"use client";

import { useState } from "react";
import { SessionProvider } from "./session-ctx";
import { Sidebar, SB_WIDTH } from "./sidebar";
import { Topbar, TB_HEIGHT } from "./topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SessionProvider>
      <div style={{ fontFamily:"Inter, DM Sans, system-ui, sans-serif", background:"#090909", color:"#f0f0f0", height:"100vh", overflow:"hidden" }}>
        <style>{`
          .dashboard-sidebar {
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .dashboard-topbar {
            transition: left 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .dashboard-main {
            transition: left 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .mobile-menu-btn {
            display: none !important;
          }
          @media (max-width: 768px) {
            .dashboard-sidebar {
              transform: translateX(-100%);
            }
            .dashboard-sidebar.mobile-open {
              transform: translateX(0);
              box-shadow: 0 0 50px rgba(0,0,0,0.8);
            }
            .dashboard-topbar, .dashboard-main {
              left: 0 !important;
            }
            .mobile-menu-btn {
              display: flex !important;
            }
            .dashboard-main {
              padding: 16px !important;
            }
            .dashboard-topbar {
              padding: 0 16px !important;
            }
          }
        `}</style>
        
        {mobileOpen && (
          <div 
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 95 }}
          />
        )}

        <Sidebar mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} />
        <Topbar onToggleMenu={() => setMobileOpen(true)} />
        <main className="dashboard-main" style={{
          position:"fixed", top:TB_HEIGHT, left:SB_WIDTH, right:0, bottom:0,
          overflowY:"auto", padding:"28px",
          background:"#090909",
        }}>
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
