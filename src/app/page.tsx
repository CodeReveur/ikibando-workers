"use client";

import { useState, useEffect } from "react";
import Footer from "@/components/layout/footer";
import { PostJobModal } from "@/components/jobs/post-job-modal";
import { getWorkers, getJobs, daysAgo, type WorkerProfileDto, type JobDto } from "@/lib/api";
import {
  UtensilsCrossed, Sparkles, Shield, Car, Zap, Wrench, Leaf,
  MapPin, ChevronRight, Briefcase,
} from "lucide-react";

const categories = [
  { icon: UtensilsCrossed, label: "Waiters" },
  { icon: Sparkles,        label: "Cleaners" },
  { icon: Shield,          label: "Security" },
  { icon: Car,             label: "Drivers" },
  { icon: Zap,             label: "Electricians" },
  { icon: Wrench,          label: "Plumbers" },
  { icon: Leaf,            label: "Gardeners" },
];

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

export default function Home() {
  const [showPostJob, setShowPostJob] = useState(false);
  const [workers, setWorkers] = useState<WorkerProfileDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);

  useEffect(() => {
    getWorkers({ size: 7 }).then(p => setWorkers(p.content)).catch(() => {});
    getJobs({ size: 6 }).then(p => setJobs(p.content)).catch(() => {});
  }, []);

  return (
    <main style={{ background: "#111", minHeight: "100vh", fontFamily: "Inter, DM Sans, system-ui, sans-serif", color: "#f5f5f5" }}>
      {showPostJob && <PostJobModal onClose={() => setShowPostJob(false)} />}

      {/* responsive grid styles */}
      <style>{`
        .card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 560px) {
          .card-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 800px) {
          .card-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .card-hover {
          transition: border-color 0.15s;
        }
        .card-hover:hover {
          border-color: #f97316 !important;
        }
      `}</style>

      {/* HERO */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "68px 20px 52px", textAlign: "center" }}>
        <span style={{
          display: "inline-block", background: "rgba(249,115,22,0.1)", color: "#f97316",
          borderRadius: 999, padding: "4px 14px", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 22,
        }}>
          Kigali · Rwanda
        </span>
        <h1 style={{ fontSize: "clamp(36px,9vw,54px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-1.5px", margin: "0 0 16px", color: "#fff" }}>
          Find work.<br />
          <span style={{ color: "#f97316" }}>Hire verified.</span>
        </h1>
        <p style={{ fontSize: 15, color: "#666", lineHeight: 1.7, margin: "0 auto", maxWidth: 420 }}>
          On-demand workers for events, cleaning, security and more - ID-verified, rated, and paid via MoMo.
        </p>
        <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowPostJob(true)} style={{
            background: "#f97316", color: "#fff", borderRadius: 999,
            padding: "12px 26px", fontWeight: 700, fontSize: 14,
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}>
            Post a request
          </button>
          <a href="/signup" style={{
            background: "transparent", color: "#aaa", borderRadius: 999,
            padding: "12px 26px", fontWeight: 600, fontSize: 14, textDecoration: "none",
            border: "1px solid #2a2a2a",
          }}>
            Become a worker
          </a>
        </div>
      </div>

      {/* CATEGORIES */}
      <section id="categories" style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px 20px" }}>
        <SectionHeader title="Categories" href="/browse" />
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {categories.map(({ icon: Icon, label }) => (
            <a
              key={label}
              href={`/browse?category=${label.toLowerCase()}`}
              style={{
                flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                background: "#1c1c1c", border: "1px solid #272727", borderRadius: 16,
                padding: "18px 20px", textDecoration: "none", minWidth: 84,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#f97316")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#272727")}
            >
              <Icon size={22} color="#f97316" strokeWidth={1.75} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa", whiteSpace: "nowrap" }}>{label}</span>
            </a>
          ))}
        </div>
      </section>

      {/* AVAILABLE WORKERS */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 20px" }}>
        <SectionHeader title="Available workers" href="/browse" Icon={Briefcase} />
        <div className="card-grid">
          {workers.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background:"#1c1c1c", border:"1px solid #272727", borderRadius:14, padding:16, height:90, animation:"pulse 1.5s ease-in-out infinite" }} />
              ))
            : workers.map((w: WorkerProfileDto) => (
              <div
                key={w.id}
                className="card-hover"
                style={{
                  background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                  padding: "16px", display: "flex", flexDirection: "column", gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 999, flexShrink: 0,
                    background: "rgba(249,115,22,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 800, color: "#f97316",
                  }}>
                    {w.name[0]}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{w.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#555", marginTop: 2 }}>{w.categoryName ?? w.experienceType ?? "Worker"}</p>
                  </div>
                </div>
                {(w.locationShort ?? w.district) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={11} color="#555" />
                    <span style={{ fontSize: 11, color: "#555" }}>{w.locationShort ?? w.district}</span>
                  </div>
                )}
              </div>
            ))
          }
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </section>

      {/* AVAILABLE JOBS */}
      <section id="jobs" style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 64px" }}>
        <SectionHeader title="Available jobs" href="/jobs" Icon={Briefcase} />
        <div className="card-grid">
          {jobs.length === 0
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ background:"#1c1c1c", border:"1px solid #272727", borderRadius:14, padding:16, height:110, animation:"pulse 1.5s ease-in-out infinite" }} />
              ))
            : jobs.map((j: JobDto) => (
              <a
                key={j.id}
                href={`/jobs/${j.id}`}
                className="card-hover"
                style={{
                  display: "flex", flexDirection: "column", gap: 10,
                  background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                  padding: "16px", textDecoration: "none",
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#f0f0f0" }}>{j.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} color="#555" />
                  <span style={{ fontSize: 11, color: "#555" }}>{j.district}</span>
                </div>
                <span style={{
                  alignSelf: "flex-start", marginTop: "auto",
                  background: "rgba(249,115,22,0.1)", borderRadius: 999,
                  padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#f97316",
                }}>
                  {fmt(j.ratePerHour)} / hr
                </span>
              </a>
            ))
          }
        </div>
      </section>

      <Footer />

    </main>
  );
}

function SectionHeader({ title, href, Icon }: { title: string; href: string; Icon?: React.ElementType }) {
  return (
    <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Icon && <Icon size={16} color="#f97316" strokeWidth={2} />}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", margin: 0 }}>
          {title}
        </h2>
      </div>
      <a href={href} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12, color: "#f97316", textDecoration: "none", fontWeight: 600 }}>
        More <ChevronRight size={13} color="#f97316" />
      </a>
    </div>
  );
}