"use client";

import { use, useState, useEffect } from "react";
import Footer from "@/components/layout/footer";
import { OfferModal } from "@/components/hire/offer-modal";
import { getWorker, getWorkerReviews, type WorkerProfileDto, type WorkerReview } from "@/lib/api";
import { ratingInfo } from "@/lib/rating";
import { useLanguage } from "@/lib/language-context";
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
    /* All five stats on a single row. */
    .stats-grid { grid-template-columns: repeat(5, 1fr) !important; }
  }
`;

export default function WorkerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = useLanguage();
  const { slug } = use(params);
  const [worker,   setWorker]   = useState<WorkerProfileDto | null>(null);
  const [reviews,  setReviews]  = useState<WorkerReview[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showHire, setShowHire] = useState(false);

  useEffect(() => {
    getWorker(slug)
      .then(setWorker)
      .catch(() => setWorker(null))
      .finally(() => setLoading(false));
    getWorkerReviews(slug).then(setReviews).catch(() => setReviews([]));
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
      <main style={{
        background: "#111", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "40px 24px", textAlign: "center", boxSizing: "border-box",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}>
        <p style={{ fontSize: 40, margin: "0 0 16px", lineHeight: 1 }}>🔍</p>
        <h1 style={{
          color: "#fff", margin: "0 0 8px", fontSize: "clamp(18px, 5.5vw, 22px)",
          fontWeight: 800, lineHeight: 1.25, maxWidth: 320, overflowWrap: "break-word",
        }}>
          {t("worker_detail.not_found") || "Worker not found"}
        </h1>
        <p style={{
          color: "#555", fontSize: "clamp(12px, 3.6vw, 14px)", margin: "0 0 24px",
          lineHeight: 1.6, maxWidth: 320, overflowWrap: "break-word",
        }}>
          {t("worker_detail.not_found_desc") || "This profile doesn't exist or has been removed."}
        </p>
        <a href="/browse" style={{
          color: "#f97316", fontSize: 14, fontWeight: 700, textDecoration: "none",
          padding: "11px 22px", border: "1px solid #2a2a2a", borderRadius: 999,
          maxWidth: "100%", boxSizing: "border-box",
        }}>
          {t("worker_detail.back") || "← Back to Browse"}
        </a>
      </main>
    );
  }

  const expType     = (worker.experienceType ?? "").toLowerCase();
  const catLabel    = t("common.categories." + expType) || worker.categoryName || worker.experienceType || t("common.general.worker");
  // All categories the worker practises, localized. Falls back to the single one.
  const catSlugs    = (worker.experienceTypes && worker.experienceTypes.length > 0)
    ? worker.experienceTypes
    : (worker.experienceType ? [worker.experienceType] : []);
  const catLabels   = catSlugs.map((s, i) =>
    t("common.categories." + (s ?? "").toLowerCase()) || worker.categoryNames?.[i] || s);
  if (catLabels.length === 0) catLabels.push(t("common.general.worker"));
  // Keep the stat card compact — a couple of categories then "+N" (full list on hover).
  const CAT_MAX   = 2;
  const catAll    = catLabels.join(", ");
  const catShort  = catLabels.slice(0, CAT_MAX).join(", ")
    + (catLabels.length > CAT_MAX ? ` +${catLabels.length - CAT_MAX}` : "");
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
          <ChevronLeft size={14} /> {t("common.nav.browse") || "Browse"}
        </a>

        {/* HERO */}
        <div className="hero-row" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 999, overflow: "hidden",
              background: "rgba(249,115,22,0.12)", border: "2px solid rgba(249,115,22,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 900, color: "#f97316",
            }}>
              {worker.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={worker.photoUrl} alt={worker.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                worker.name[0]?.toUpperCase()
              )}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
                {worker.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <CheckCircle size={16} color="#22c55e" fill="rgba(34,197,94,0.15)" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>
                  {t("worker_detail.badges.verified") || "Verified"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {(() => {
                const MAX = 3;
                const shown = catLabels.slice(0, MAX);
                const extra = catLabels.length - shown.length;
                const chip = (content: React.ReactNode, key: string, withIcon: boolean) => (
                  <span key={key} title={catLabels.join(", ")} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                    borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#f97316",
                  }}>
                    {withIcon && <Briefcase size={11} />}
                    {content}
                  </span>
                );
                return [
                  ...shown.map((c, i) => chip(c, "cat-" + i, i === 0)),
                  extra > 0 ? chip(`+${extra} ${t("worker_detail.more") || "more"}`, "cat-more", false) : null,
                ];
              })()}
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 10px",
                background: isAvailable ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                color: isAvailable ? "#22c55e" : "#555",
              }}>
                {isAvailable ? `● ${t("browse_page.badges.available") || "Available"}` : `● ${t("worker_detail.badges.unavailable") || "Not available"}`}
              </span>
              {(() => {
                const r = ratingInfo(worker.rating, worker.ratingCount);
                return (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                    borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#f97316",
                  }}>
                    <Star size={11} fill="#f97316" />
                    {r.hasReviews ? `${r.value} · ${r.reviews} review${r.reviews === 1 ? "" : "s"}` : r.value}
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
                <span style={{ fontSize: 12, color: "#555" }}>
                  {t("worker_detail.member_since", { year: memberYear })}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}>
          {([
            { label: t("common.general.category") || "Category",       value: catShort, title: catAll },
            { label: t("worker_detail.stats.rating") || "Rating",         value: (() => { const r = ratingInfo(worker.rating, worker.ratingCount); return r.hasReviews ? `${r.value} ★ (${r.reviews})` : `${r.value} ★`; })() },
            { label: t("worker_detail.stats.completed_jobs") || "Completed jobs", value: String(worker.completedJobs ?? 0) },
            { label: t("jobs_page.filters.location") || "Location",       value: worker.locationRegion || worker.locationShort || worker.district || "Rwanda" },
            { label: t("worker_detail.sections.available_days") || "Available days", value: worker.availability.length > 0 ? String(worker.availability.length) : "—",
              title: worker.availability.length > 0 ? (t("worker_detail.trust.availability", { count: worker.availability.length }) || undefined) : undefined },
          ] as { label: string; value: string; title?: string }[]).map(({ label, value, title }) => (
            <div key={label} style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, padding: "11px 12px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 9.5, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.3 }}>{label}</p>
              <p title={title} style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.2px", overflowWrap: "break-word", lineHeight: 1.35 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* EDUCATION */}
        {worker.educationLevel && (
          <Section title={t("worker_detail.sections.education") || "Education"}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} color="#22c55e" />
              <span style={{ fontSize: 13, color: "#aaa" }}>{worker.educationLevel}</span>
            </div>
          </Section>
        )}

        {/* AVAILABILITY */}
        {worker.availability.length > 0 && (
          <Section title={t("worker_detail.sections.available_days") || "Available days"}>
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
          <Section title={t("worker_detail.sections.equipment") || "Equipment & tools"}>
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
        <Section title={t("worker_detail.sections.trust") || "Trust & verification"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: Shield,    label: t("worker_detail.trust.identity") || "Identity registered on MpahMapu",       ok: true },
              { icon: Calendar,  label: t("worker_detail.trust.member_since", { year: memberYear }),      ok: true },
              { icon: Briefcase, label: t("worker_detail.trust.specialty", { category: catLabel }),             ok: !!worker.experienceType },
              { icon: Clock,     label: t("worker_detail.trust.availability", { count: worker.availability.length }), ok: isAvailable },
            ].map(({ icon: Icon, label, ok }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={15} color={ok ? "#22c55e" : "#333"} />
                <span style={{ fontSize: 13, color: ok ? "#aaa" : "#444" }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* REVIEWS */}
        {reviews.length > 0 && (
          <Section title={`${t("worker_detail.sections.reviews") || "Reviews"} (${reviews.length})`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reviews.map((rv, i) => (
                <div key={i} style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: (rv.text || rv.option) ? 8 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} size={12} color="#f97316" fill={(rv.rating ?? 0) > s ? "#f97316" : "none"} />
                        ))}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#aaa" }}>
                        {rv.reviewer || t("worker_detail.reviews.anonymous") || "Client"}
                      </span>
                    </div>
                    {rv.date && <span style={{ fontSize: 11, color: "#555" }}>{new Date(rv.date).toLocaleDateString()}</span>}
                  </div>
                  {rv.text
                    ? <p style={{ margin: 0, fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>{rv.text}</p>
                    : rv.option && <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{rv.option}</p>}
                  {rv.jobTitle && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#555", display: "flex", alignItems: "center", gap: 5 }}>
                      <Briefcase size={10} /> {rv.jobTitle}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

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
              width: 36, height: 36, borderRadius: 999, flexShrink: 0, overflow: "hidden",
              background: "rgba(249,115,22,0.12)", border: "1.5px solid rgba(249,115,22,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900, color: "#f97316",
            }}>
              {worker.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={worker.photoUrl} alt={worker.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                worker.name[0]?.toUpperCase()
              )}
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
                ● {t("browse_page.badges.available") || "Available"}
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
            {isAvailable ? (t("worker_detail.cta.hire", { name: firstName }) || `Hire ${firstName}`) : (t("worker_detail.cta.unavailable") || "Unavailable")}
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