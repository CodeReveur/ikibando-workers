"use client";

import { useState, useEffect } from "react";
import { Briefcase, Shield, Zap, Star } from "lucide-react";

const slides = [
  {
    Icon: Briefcase,
    tag: "For workers",
    headline: "Get hired\ntoday.",
    body: "Browse 100+ daily jobs across Kigali - waiters, cleaners, drivers, security and more. No CV needed.",
    quote: "I earned RWF 45,000 this week alone.",
    author: "Jean Pierre M.",
    role: "Waiter · Kacyiru",
    rating: 4.9,
  },
  {
    Icon: Shield,
    tag: "For employers",
    headline: "Hire in\nminutes.",
    body: "ID-verified, rated workers ready to start the same day. Read reviews, compare rates, book instantly.",
    quote: "Found a waiter for my event in under 10 minutes.",
    author: "Amina K.",
    role: "Event Organiser · Kimihurura",
    rating: 5.0,
  },
  {
    Icon: Zap,
    tag: "Safe payments",
    headline: "Pay via\nMoMo.",
    body: "Pay and get paid securely via Mobile Money. No cash disputes, no upfront fees - funds held safely.",
    quote: "No more cash problems. MoMo makes it simple.",
    author: "Eric N.",
    role: "Driver · Remera",
    rating: 4.8,
  },
];

export function AuthCarousel() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, []);

  const slide = slides[idx];
  const { Icon } = slide;

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 44px 40px",
        overflow: "hidden",
        background: "#0f0f0f",
      }}
    >
      {/* Decorative blob */}
      <div style={{
        position: "absolute", top: -80, right: -80,
        width: 340, height: 340, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -60, left: -60,
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 20, color: "#f97316", textDecoration: "none", letterSpacing: "-0.5px", position: "relative", zIndex: 1 }}>
        <img src="/logo.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain", background: "#fff" }} />
        MpahMapu
      </a>

      {/* Slide content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Tag */}
        <span style={{
          display: "inline-block", background: "rgba(249,115,22,0.1)", color: "#f97316",
          borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 22,
        }}>
          {slide.tag}
        </span>

        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
        }}>
          <Icon size={24} color="#f97316" strokeWidth={1.75} />
        </div>

        {/* Headline */}
        <h2 style={{
          fontSize: "clamp(36px, 5vw, 48px)", fontWeight: 900, color: "#fff",
          lineHeight: 1.05, letterSpacing: "-1.5px", margin: "0 0 16px",
          whiteSpace: "pre-line",
        }}>
          {slide.headline}
        </h2>

        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.75, margin: "0 0 32px", maxWidth: 320 }}>
          {slide.body}
        </p>

        {/* Quote card */}
        <div style={{
          background: "#1a1a1a", border: "1px solid #272727",
          borderRadius: 14, padding: "18px 20px",
        }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#d0d0d0", lineHeight: 1.65, fontStyle: "italic" }}>
            &ldquo;{slide.quote}&rdquo;
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#f0f0f0" }}>{slide.author}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>{slide.role}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Star size={12} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>{slide.rating}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", gap: 6, position: "relative", zIndex: 1 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            style={{
              height: 4, width: i === idx ? 24 : 8,
              borderRadius: 999,
              background: i === idx ? "#f97316" : "#2a2a2a",
              border: "none", cursor: "pointer", padding: 0,
              transition: "width 0.3s, background 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
