"use client";

import { use, useState, useEffect } from "react";
import Footer from "@/components/layout/footer";
import { OfferModal } from "@/components/hire/offer-modal";
import { getWorker, type WorkerProfileDto } from "@/lib/api";
import { ratingInfo } from "@/lib/rating";
import { JOB_CATEGORIES } from "@/lib/constants";
import {
  MapPin, Shield, ChevronLeft, Briefcase,
  CheckCircle, Calendar, Wrench, Clock, Loader2, Star,
} from "lucide-react";

const CSS = `
  * { box-sizing: border-box; }
  .back-btn:hover { border-color: #f97316 !important; color: #f97316 !important; }
  .hire-btn-cta:hover { background: #ea6a0a !important; }
  @media (min-width: 600px) {
    .hero-row   { flex-direction: row !important; align-items: flex-start !important; }
    .stats-grid { grid-template-columns: repeat(4, 1fr) !important; }
  }
`;

export default function WorkerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [worker,   setWorker]   = useState<WorkerProfileDto | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showHire, setShowHire] = useState(false);

  useEffect(() => {
    getWorker(slug)
      .then(setWorker)
      .catch(() => setWorker(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main style={{ background: "#111", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
        <Loader2 size={28} color="#f97316" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </main>
    );
  }

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

  const catLabel    = worker.categoryName ?? JOB_CATEGORIES.find(c => c.value === worker.experienceType)?.label ?? worker.experienceType ?? "Worker";
  const isAvailable = worker.availability.length > 0;
  const memberYear  = new Date(worker.memberSince as unknown as string).getFullYear();
  const firstName   = worker.name.split(" ")[0];

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif", overflowX: "hidden", width: "100%" }}>
      <style>{CSS}</style>
      {showHire && <OfferModal worker={worker} onClose={() => setShowHire(false)} />}

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 140px" }}>

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
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 999,
              background: "rgba(249,115,22,0.12)", border: "2px solid rgba(249,115,22,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 900, color: "#f97316",
            }}>
              {worker.name[0]?.toUpperCase()}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
                {worker.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <CheckCircle size={16} color="#22c55e" fill="rgba(34,197,94,0.15)" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>Verified</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#f97316",
              }}>
                <Briefcase size={11} />
                {catLabel}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 10px",
                background: isAvailable ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                color: isAvailable ? "#22c55e" : "#555",
              }}>
                {isAvailable ? "● Available" : "● Not available"}
              </span>
              {(() => {
                const r = ratingInfo(worker.rating, worker.ratingCount);
                return (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                    borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#f97316",
                  }}>
                    <Star size={11} fill={r.hasReviews ? "#f97316" : "none"} />
                    {r.hasReviews ? `${r.value} · ${r.reviews} review${r.reviews === 1 ? "" : "s"}` : "New worker"}
                  </span>
                );
              })()}
            </div>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              {(worker.locationFull ?? worker.locationShort ?? worker.district) && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={12} color="#555" />
                  <span style={{ fontSize: 12, color: "#555" }}>{worker.locationFull ?? worker.locationShort ?? worker.district}</span>
                </span>
              )}
              <span style={{ fontSize: 12, color: "#555" }}>·</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Calendar size={12} color="#555" />
                <span style={{ fontSize: 12, color: "#555" }}>Member since {memberYear}</span>
              </span>
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Category",       value: catLabel },
            { label: "Rating",         value: (() => { const r = ratingInfo(worker.rating, worker.ratingCount); return r.hasReviews ? `${r.value} ★ (${r.reviews})` : "New"; })() },
            { label: "Location",       value: worker.locationFull || worker.locationShort || worker.district || "Rwanda" },
            { label: "Available days", value: worker.availability.length > 0 ? `${worker.availability.length} day${worker.availability.length !== 1 ? "s" : ""}` : "Not set" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.3px" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* EDUCATION */}
        {worker.educationLevel && (
          <Section title="Education">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} color="#22c55e" />
              <span style={{ fontSize: 13, color: "#aaa" }}>{worker.educationLevel}</span>
            </div>
          </Section>
        )}

        {/* AVAILABILITY */}
        {worker.availability.length > 0 && (
          <Section title="Available days">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {worker.availability.map(day => (
                <span key={day} style={{
                  fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "5px 14px",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e",
                }}>{day}</span>
              ))}
            </div>
          </Section>
        )}

        {/* EQUIPMENT */}
        {worker.equipment.length > 0 && (
          <Section title="Equipment & tools">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {worker.equipment.map(eq => (
                <span key={eq} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "5px 14px",
                  background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.18)", color: "#f97316",
                }}>
                  <Wrench size={10} />{eq}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* TRUST */}
        <Section title="Trust & verification">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: Shield,    label: "Identity registered on MpahMapu",       ok: true },
              { icon: Calendar,  label: `Active member since ${memberYear}`,      ok: true },
              { icon: Briefcase, label: `Specialises in ${catLabel}`,             ok: !!worker.experienceType },
              { icon: Clock,     label: `${worker.availability.length} day${worker.availability.length !== 1 ? "s" : ""} available per week`, ok: isAvailable },
            ].map(({ icon: Icon, label, ok }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={15} color={ok ? "#22c55e" : "#333"} />
                <span style={{ fontSize: 13, color: ok ? "#aaa" : "#444" }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>

      {/* STICKY CTA — matches navbar pill style */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "0 20px 20px",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}>
        <div style={{
          maxWidth: 680, margin: "0 auto",
          background: "rgba(22,22,22,0.85)",
          border: "1px solid rgba(45,45,45,0.9)",
          borderRadius: 999,
          height: 64,
          padding: "0 10px 0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxSizing: "border-box",
        }}>
          {/* Left: worker summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mini avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              background: "rgba(249,115,22,0.12)", border: "1.5px solid rgba(249,115,22,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900, color: "#f97316",
            }}>
              {worker.name[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e0e0e0", letterSpacing: "-0.2px" }}>
                {firstName}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
                {catLabel} · {worker.locationShort ?? worker.district ?? "Rwanda"}
              </p>
            </div>
            {isAvailable && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#22c55e",
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)",
                borderRadius: 999, padding: "3px 9px",
              }}>
                ● Available
              </span>
            )}
          </div>

          {/* Right: CTA button */}
          <button
            className="hire-btn-cta"
            onClick={() => setShowHire(true)}
            disabled={!isAvailable}
            style={{
              background: isAvailable ? "#f97316" : "transparent",
              color: isAvailable ? "#fff" : "#444",
              border: isAvailable ? "none" : "1px solid #2a2a2a",
              borderRadius: 999,
              padding: "0 22px",
              height: 40,
              fontSize: 13, fontWeight: 700,
              cursor: isAvailable ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              transition: "background 0.15s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {isAvailable ? `Hire ${firstName}` : "Unavailable"}
          </button>
        </div>
      </div>

      <Footer />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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