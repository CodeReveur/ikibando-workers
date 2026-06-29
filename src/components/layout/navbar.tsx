"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HireModal } from "@/components/hire/hire-modal";
import { LogOut, Briefcase, FileText, Home, Users, ChevronDown, Settings, Menu, X } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [hireOpen, setHireOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try { setUser(JSON.parse(u)); } catch {}
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  const handleSignOut = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    router.push("/signin");
  };

  const links = [
    { href: "/browse",  label: "Browse"  },
    { href: "/jobs",    label: "Jobs"    },
    { href: "/contact", label: "Contact" },
    { href: "/about",   label: "About"   },
  ];

  if (
    pathname === "/signin" || pathname === "/signup" ||
    pathname === "/forgot-password" || pathname === "/reset-password" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/seeker") ||
    pathname.startsWith("/owner")
  ) return null;

  const initials = user?.name
    ?.split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  const firstName = user?.name?.split(" ")[0] ?? "";
  const roleLabel = user?.role === "EMPLOYER" ? "Employer" : "Job Seeker";

  const dashboardLinks = user?.role === "EMPLOYER"
    ? [
        { href: "/owner",          icon: <Home size={14} />,      label: "Dashboard"    },
        { href: "/owner/offers",   icon: <Briefcase size={14} />, label: "Offers"       },
        { href: "/owner/workers",  icon: <Users size={14} />,     label: "Requests"     },
        { href: "/owner/settings", icon: <Settings size={14} />,  label: "Settings"     },
      ]
    : [
        { href: "/seeker",               icon: <Home size={14} />,      label: "Dashboard"    },
        { href: "/seeker/jobs",          icon: <Briefcase size={14} />, label: "Jobs"         },
        { href: "/seeker/applications",  icon: <FileText size={14} />,  label: "Applications" },
        { href: "/seeker/settings",      icon: <Settings size={14} />,  label: "Settings"     },
      ];

  return (
    <>
      {hireOpen && <HireModal onClose={() => setHireOpen(false)} />}

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mobileMenuIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .profile-dropdown { animation: fadeSlideDown 0.18s cubic-bezier(0.16,1,0.3,1) forwards; }
        .mobile-menu      { animation: mobileMenuIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards; }

        .nav-link { color: #555; font-weight: 400; text-decoration: none; transition: color 0.15s; font-size: 13px; }
        .nav-link:hover { color: #ccc; }
        .nav-link.active { color: #f97316; font-weight: 600; }

        .dd-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; color: #b0b0b0; text-decoration: none;
          font-size: 13px; font-weight: 500; border-radius: 9px;
          transition: background 0.12s, color 0.12s; cursor: pointer;
          background: none; border: none; width: 100%; text-align: left;
        }
        .dd-item:hover { background: #242424; color: #fff; }
        .dd-item.danger { color: #f87171; }
        .dd-item.danger:hover { background: rgba(239,68,68,0.08); color: #ef4444; }

        .hire-btn {
          background: transparent; color: #f97316;
          border: 1.5px solid rgba(249,115,22,0.5); border-radius: 999px;
          padding: 6px 16px; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .hire-btn:hover { background: rgba(249,115,22,0.1); border-color: #f97316; color: #fb923c; }

        .hire-btn-mobile {
          background: rgba(249,115,22,0.1); color: #f97316;
          border: 1.5px solid rgba(249,115,22,0.4); border-radius: 10px;
          padding: 11px 16px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit; width: 100%;
          transition: background 0.15s, border-color 0.15s;
        }
        .hire-btn-mobile:hover { background: rgba(249,115,22,0.18); border-color: #f97316; }

        .profile-trigger {
          display: flex; align-items: center; gap: 7px;
          background: none; border: none; cursor: pointer; padding: 0;
        }
        .profile-trigger:focus-visible { outline: 2px solid #f97316; border-radius: 999px; }

        .hamburger-btn {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #888;
          transition: background 0.15s, color 0.15s; flex-shrink: 0;
        }
        .hamburger-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

        .mobile-nav-link {
          display: flex; align-items: center;
          padding: 11px 14px; color: #888; text-decoration: none;
          font-size: 14px; font-weight: 500; border-radius: 10px;
          transition: background 0.12s, color 0.12s;
        }
        .mobile-nav-link:hover { background: #1f1f1f; color: #fff; }
        .mobile-nav-link.active { color: #f97316; background: rgba(249,115,22,0.08); }

        /* ── Desktop only ── */
        @media (min-width: 601px) {
          .hamburger-btn       { display: none !important; }
          .mobile-menu-wrapper { display: none !important; }
        }

        /* ── Mobile only ── */
        @media (max-width: 600px) {
          .desktop-links   { display: none !important; }
          .desktop-right   { display: none !important; }
          .hamburger-btn   { display: flex !important; }
          .nav-logo img    { width: 120px !important; height: 48px !important; }
        }
      `}</style>

      {/* ── Outer wrapper: blur sits here, above the page, behind the pill ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        padding: "14px 20px 0",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}>

        {/* ── Pill nav ── */}
        <nav style={{
          maxWidth: 760, margin: "0 auto",
          background: "rgba(22,22,22,0.75)",
          border: "1px solid rgba(45,45,45,0.9)",
          borderRadius: 999,
          padding: "0 10px 0 20px",
          height: 64,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxSizing: "border-box",
        }}>

          {/* Logo */}
          <a href="/" className="nav-logo" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
            <img src="/cover-a.png" alt="Logo" style={{ width: 149, height: 59, borderRadius: 6, objectFit: "cover" }} />
          </a>

          {/* Desktop: center links */}
          <div className="desktop-links" style={{ display: "flex", gap: 22, alignItems: "center" }}>
            {links.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <a key={href} href={href} className={`nav-link${active ? " active" : ""}`}>{label}</a>
              );
            })}
            {!user && (
              <a href="/signin" className={`nav-link${pathname === "/signin" ? " active" : ""}`}>Sign in</a>
            )}
          </div>

          {/* Desktop: hire + profile */}
          <div className="desktop-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="hire-btn" onClick={() => setHireOpen(true)}>Hire now</button>

            {user && (
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <button
                  className="profile-trigger"
                  onClick={() => setDropdownOpen((v) => !v)}
                  aria-expanded={dropdownOpen}
                  style={{ padding: "0 6px 0 2px" }}
                >
                  <div style={{ position: "relative" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 999,
                      background: "linear-gradient(135deg, #f97316, #ea580c)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, color: "#fff",
                      boxShadow: dropdownOpen
                        ? "0 0 0 2px #f97316, 0 0 0 4px rgba(249,115,22,0.2)"
                        : "0 0 0 2px rgba(249,115,22,0.25)",
                      transition: "box-shadow 0.2s",
                    }}>{initials}</div>
                    <div style={{
                      position: "absolute", bottom: 0, right: 0,
                      width: 8, height: 8, borderRadius: 999,
                      background: "#22c55e", border: "2px solid #161616",
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#d0d0d0", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {firstName}
                  </span>
                  <ChevronDown size={12} color="#555" style={{ transition: "transform 0.2s", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }} />
                </button>

                {dropdownOpen && (
                  <div className="profile-dropdown" style={{
                    position: "absolute", top: "calc(100% + 10px)", right: 0,
                    width: 220, background: "#161616",
                    border: "1px solid #272727", borderRadius: 14,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.6)", overflow: "hidden",
                  }}>
                    <div style={{ padding: "11px 13px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid #1f1f1f" }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 999, flexShrink: 0,
                        background: "linear-gradient(135deg, #f97316, #ea580c)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, color: "#fff",
                        boxShadow: "0 3px 8px rgba(249,115,22,0.28)",
                      }}>{initials}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <span style={{ width: 4, height: 4, borderRadius: 999, background: "#f97316", display: "inline-block" }} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#f97316" }}>{roleLabel}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "6px 6px 4px" }}>
                      {dashboardLinks.map(({ href, icon, label }) => (
                        <a key={href} href={href} className="dd-item">{icon}{label}</a>
                      ))}
                    </div>
                    <div style={{ padding: "4px 6px 6px", borderTop: "1px solid #1f1f1f" }}>
                      <button onClick={handleSignOut} className="dd-item danger"><LogOut size={14} />Sign out</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </nav>

        {/* ── Mobile slide-down menu ── */}
        <div className="mobile-menu-wrapper" ref={mobileMenuRef}>
          {mobileMenuOpen && (
            <div className="mobile-menu" style={{
              maxWidth: 760, margin: "8px auto 0",
              background: "rgba(18,18,18,0.97)",
              border: "1px solid rgba(45,45,45,0.9)",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            }}>
              {user && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #1f1f1f" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 999, flexShrink: 0,
                    background: "linear-gradient(135deg, #f97316, #ea580c)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, color: "#fff",
                    boxShadow: "0 3px 8px rgba(249,115,22,0.3)",
                  }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{user.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: "#f97316", display: "inline-block" }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#f97316" }}>{roleLabel}</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ padding: "10px 8px" }}>
                {links.map(({ href, label }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <a key={href} href={href} className={`mobile-nav-link${active ? " active" : ""}`}>{label}</a>
                  );
                })}
                {!user && (
                  <a href="/signin" className={`mobile-nav-link${pathname === "/signin" ? " active" : ""}`}>Sign in</a>
                )}

                {user && (
                  <>
                    <div style={{ height: 1, background: "#1f1f1f", margin: "6px 6px" }} />
                    {dashboardLinks.map(({ href, icon, label }) => (
                      <a key={href} href={href} className="dd-item" style={{ borderRadius: 10, padding: "10px 14px", fontSize: 14 }}>{icon}{label}</a>
                    ))}
                  </>
                )}

                <div style={{ padding: "8px 6px 2px" }}>
                  <button className="hire-btn-mobile" onClick={() => { setMobileMenuOpen(false); setHireOpen(true); }}>
                    Hire now
                  </button>
                </div>

                {user && (
                  <div style={{ padding: "6px 6px 4px", borderTop: "1px solid #1f1f1f", marginTop: 8 }}>
                    <button onClick={handleSignOut} className="dd-item danger" style={{ borderRadius: 10, padding: "10px 14px", fontSize: 14 }}>
                      <LogOut size={14} />Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}