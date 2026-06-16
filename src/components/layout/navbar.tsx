"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HireModal } from "@/components/hire/hire-modal";

export default function Navbar() {
  const pathname = usePathname();
  const [hireOpen, setHireOpen] = useState(false);

  const links = [
    { href: "/browse",  label: "Browse"     },
    { href: "/jobs",    label: "Jobs"       },
    { href: "/contact", label: "Contact" },
  ];

  if (pathname === "/signin" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password") return null;

  return (
    <>
    {hireOpen && <HireModal onClose={() => setHireOpen(false)} />}
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      padding: "16px 20px 0",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
    }}>
      <nav style={{
        maxWidth: 760, margin: "0 auto",
        background: "rgba(28, 28, 28, 0.6)", border: "1px solid rgba(39,39,39,0.8)",
        borderRadius: 999, padding: "10px 16px 10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}>
        <a href="/" style={{ fontWeight: 900, fontSize: 17, color: "#f97316", letterSpacing: "-0.5px", textDecoration: "none" }}>
          Ikibando
        </a>

        <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <a
                key={href}
                href={href}
                style={{
                  color: active ? "#f97316" : "#666",
                  textDecoration: "none",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {label}
              </a>
            );
          })}
          <a href="/signin" style={{ color: pathname === "/signin" ? "#f97316" : "#666", fontWeight: pathname === "/signin" ? 700 : 400, textDecoration: "none" }}>Sign in</a>
        </div>

        <button onClick={() => setHireOpen(true)} style={{
          background: "#f97316", color: "#fff", borderRadius: 999,
          padding: "8px 18px", fontSize: 13, fontWeight: 700,
          border: "none", cursor: "pointer", fontFamily: "inherit",
        }}>
          Hire now
        </button>
      </nav>
    </div>
    </>
  );
}