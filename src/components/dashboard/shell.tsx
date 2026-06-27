"use client";

import { SessionProvider } from "./session-ctx";
import { Sidebar, SB_WIDTH } from "./sidebar";
import { Topbar, TB_HEIGHT } from "./topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div style={{ fontFamily:"Inter, DM Sans, system-ui, sans-serif", background:"#090909", color:"#f0f0f0", height:"100vh", overflow:"hidden" }}>
        <Sidebar />
        <Topbar />
        <main style={{
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
