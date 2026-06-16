"use client";

import { use } from "react";
import { useState } from "react";
import Footer from "@/components/layout/footer";
import { OfferModal } from "@/components/hire/offer-modal";
import { WORKERS, WorkerType } from "@/lib/data";
import {
  MapPin, Star, Briefcase, Shield, ChevronLeft,
  Users, Building2, User, CheckCircle, MessageCircle,
} from "lucide-react";

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

const TYPE_META: Record<WorkerType, { icon: React.ElementType; label: (w: { teamSize?: number }) => string; color: string }> = {
  individual: { icon: User,      label: () => "Individual",             color: "#3b82f6" },
  team:       { icon: Users,     label: w => `Team · ${w.teamSize ?? 2} members`, color: "#a855f7" },
  company:    { icon: Building2, label: w => `Company · ${w.teamSize ?? 0} staff`, color: "#f97316" },
};

const CSS = `
  * { box-sizing: border-box; }
  .back-btn:hover { border-color: #f97316 !important; color: #f97316 !important; }
  .hire-btn:hover { background: #ea6a0a !important; }
  @media (min-width: 600px) {
    .hero-row { flex-direction: row !important; align-items: flex-start !important; }
    .stats-grid { grid-template-columns: repeat(4, 1fr) !important; }
  }
`;

export default function WorkerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [showHire, setShowHire] = useState(false);

  const worker = WORKERS.find(w => w.slug === slug);

  if (!worker) {
    return (
      <main style={{ background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
        <p style={{ fontSize: 40, margin: "0 0 16px" }}>🔍</p>
        <h1 style={{ color: "#fff", margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Worker not found</h1>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 24px" }}>This profile doesn't exist or has been removed.</p>
        <a href="/browse" style={{ color: "#f97316", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← Back to Browse</a>
      </main>
    );
  }

  const meta = TYPE_META[worker.type];
  const TypeIcon = meta.icon;

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
      <style>{CSS}</style>
      {showHire && <OfferModal worker={worker} onClose={() => setShowHire(false)} />}

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 64px" }}>

        {/* BACK */}
        <a href="/browse" className="back-btn" style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 13, fontWeight: 600, color: "#555", textDecoration: "none",
          border: "1px solid #272727", borderRadius: 999, padding: "6px 14px",
          marginBottom: 24, transition: "border-color 0.15s, color 0.15s",
        }}>
          <ChevronLeft size={14} /> Browse
        </a>

        {/* HERO */}
        <div className="hero-row" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 999,
              background: "rgba(249,115,22,0.12)", border: "2px solid rgba(249,115,22,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 900, color: "#f97316",
            }}>
              {worker.name[0]}
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
                {worker.name}
              </h1>
              {/* Verified */}
              {worker.verified && (
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <CheckCircle size={16} color="#22c55e" fill="rgba(34,197,94,0.15)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>Verified</span>
                </div>
              )}
            </div>

            {/* Type + availability row */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
                borderRadius: 999, padding: "4px 10px",
                fontSize: 11, fontWeight: 700, color: meta.color,
              }}>
                <TypeIcon size={11} />
                {meta.label(worker)}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 10px",
                background: worker.available ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                color: worker.available ? "#22c55e" : "#555",
              }}>
                {worker.available ? "● Available now" : "● Busy"}
              </span>
            </div>

            {/* Location + category */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={12} color="#555" />
                <span style={{ fontSize: 12, color: "#555" }}>{worker.location}</span>
              </span>
              <span style={{ fontSize: 12, color: "#555" }}>·</span>
              <span style={{ fontSize: 12, color: "#555" }}>{worker.category}</span>
              <span style={{ fontSize: 12, color: "#555" }}>·</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Star size={12} color="#f97316" fill="#f97316" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>{worker.rating}</span>
                <span style={{ fontSize: 12, color: "#555" }}>({worker.jobs} jobs)</span>
              </span>
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="stats-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24,
        }}>
          {[
            { label: "Jobs done",    value: `${worker.jobs}` },
            { label: "Rating",       value: `★ ${worker.rating}` },
            { label: "Experience",   value: `${worker.yearsExp} yrs` },
            { label: "Daily rate",   value: fmt(worker.ratePerDay) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, padding: "14px 16px",
            }}>
              <p style={{ margin: 0, fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: value.startsWith("★") ? "#f97316" : "#f0f0f0", letterSpacing: "-0.4px" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* BIO */}
        <Section title="About">
          <p style={{ margin: 0, fontSize: 13, color: "#aaa", lineHeight: 1.8 }}>{worker.bio}</p>
        </Section>

        {/* SKILLS */}
        <Section title="Skills & categories">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {worker.categories.map(c => (
              <span key={c} style={{
                fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "5px 14px",
                background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "#f97316",
              }}>{c}</span>
            ))}
          </div>
        </Section>

        {/* LANGUAGES */}
        <Section title="Languages">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {worker.languages.map(l => (
              <span key={l} style={{
                fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "5px 14px",
                background: "#1c1c1c", border: "1px solid #272727", color: "#aaa",
              }}>{l}</span>
            ))}
          </div>
        </Section>

        {/* TRUST BADGES */}
        <Section title="Trust & verification">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: Shield,         label: "Identity verified",          ok: worker.verified },
              { icon: CheckCircle,    label: "Rated by previous employers", ok: worker.jobs > 0 },
              { icon: Briefcase,      label: `${worker.jobs} completed jobs on Ikibando`, ok: true },
            ].map(({ icon: Icon, label, ok }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={15} color={ok ? "#22c55e" : "#333"} />
                <span style={{ fontSize: 13, color: ok ? "#aaa" : "#444" }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* REVIEWS */}
        <Section title={`Reviews (${worker.reviews.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {worker.reviews.map((r, i) => (
              <div key={i} style={{
                background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 999,
                      background: "#272727", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, color: "#666",
                    }}>
                      <MessageCircle size={13} color="#555" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#f0f0f0" }}>{r.author}</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#444" }}>{r.date}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={11} color="#f97316" fill={i < r.rating ? "#f97316" : "none"} />
                    ))}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#777", lineHeight: 1.7 }}>{r.text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <div style={{
          position: "sticky", bottom: 20,
          background: "#1a1a1a", border: "1px solid #272727",
          borderRadius: 16, padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)", gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>Daily rate</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#f97316", letterSpacing: "-0.5px" }}>
              {fmt(worker.ratePerDay)}
            </p>
          </div>
          <button
            className="hire-btn"
            onClick={() => setShowHire(true)}
            disabled={!worker.available}
            style={{
              background: worker.available ? "#f97316" : "#1c1c1c",
              color: worker.available ? "#fff" : "#444",
              border: worker.available ? "none" : "1px solid #272727",
              borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700,
              cursor: worker.available ? "pointer" : "not-allowed", fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {worker.available ? `Hire ${worker.name.split(" ")[0]}` : "Currently busy"}
          </button>
        </div>

      </div>
      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.2px" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
