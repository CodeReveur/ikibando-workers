import { useLanguage } from "@/lib/language-context";

export default function Footer() {
  const { t } = useLanguage();

  const links = [
    { href: "/browse",  label: t("common.nav.browse")  },
    { href: "/jobs",    label: t("common.nav.jobs")    },
    { href: "/about",   label: t("common.nav.about")   },
    { href: "/contact", label: t("common.nav.contact") },
    { href: "/privacy-policy", label: t("common.nav.privacy") },
    { href: "/terms-and-conditions",   label: t("common.nav.terms")   },
  ];

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
        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#444" }}>{t("common.footer.copyright")}</p>
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

