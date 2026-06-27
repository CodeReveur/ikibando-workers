const links = [
  { href: "/browse",  label: "Browse"  },
  { href: "/jobs",    label: "Jobs"    },
  { href: "/about",   label: "About"   },
  { href: "/contact", label: "Contact" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-and-conditions",   label: "Terms"   },
];

export default function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid #1e1e1e",
      maxWidth: 760, margin: "0 auto",
      padding: "28px 20px 44px",
      display: "flex", flexWrap: "wrap",
      justifyContent: "space-between", alignItems: "center", gap: 14,
      fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      <div>
        <p style={{ margin: 0, fontWeight: 900, fontSize: 15, color: "#f97316" }}>MpahMapu</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#444" }}>© 2026 MpahMapu Company Ltd · Kigali, Rwanda</p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12 }}>
        {links.map(({ href, label }) => (
          <a key={href} href={href} style={{ color: "#444", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
            onMouseLeave={e => (e.currentTarget.style.color = "#444")}
          >
            {label}
          </a>
        ))}
      </div>
    </footer>
  );
}
