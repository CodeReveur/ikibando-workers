"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ShieldAlert, XCircle, Star, Briefcase, Calendar, Loader2 } from "lucide-react";
import { verifyBadge, type BadgeVerification } from "@/lib/api";
import { ratingInfo } from "@/lib/rating";

export default function VerifyBadgePage({ params }: { params: Promise<{ badgeId: string }> }) {
  const { badgeId } = use(params);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BadgeVerification | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    verifyBadge(badgeId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [badgeId]);

  const isCompany = data?.accountType === "COMPANY";
  const roleLabel = isCompany ? "Verified Company" : "Verified Worker";
  const r = ratingInfo(data?.rating, data?.ratingCount);
  const memberYear = data?.memberSince ? new Date(data.memberSince).getFullYear() : null;

  return (
    <div style={{ minHeight: "100vh", background: "#090909", display: "flex", flexDirection: "column",
      alignItems: "center", padding: "40px 20px", fontFamily: "inherit" }}>
      {/* brand */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: 28 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.5px" }}>
          Mpah<span style={{ color: "#f97316" }}>Mapu</span>
        </span>
      </Link>

      <div style={{ width: "100%", maxWidth: 420, background: "#141414", border: "1px solid #232323",
        borderRadius: 20, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "70px 24px", textAlign: "center", color: "#666" }}>
            <Loader2 size={26} color="#f97316" style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ margin: "14px 0 0", fontSize: 13 }}>Verifying badge…</p>
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : error || !data || !data.valid ? (
          /* NOT FOUND */
          <div style={{ padding: "48px 28px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <XCircle size={32} color="#ef4444" />
            </div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#f0f0f0" }}>Badge not found</h1>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#777", lineHeight: 1.6 }}>
              No badge with ID <strong style={{ color: "#aaa" }}>{badgeId}</strong> is registered on Mpah Mapu.
              This badge may be invalid or counterfeit.
            </p>
          </div>
        ) : (
          /* VERIFIED */
          <>
            <div style={{ background: data.active ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
              borderBottom: `1px solid ${data.active ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
              padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {data.active
                ? <BadgeCheck size={18} color="#22c55e" />
                : <ShieldAlert size={18} color="#f59e0b" />}
              <span style={{ fontSize: 13, fontWeight: 700, color: data.active ? "#22c55e" : "#f59e0b" }}>
                {data.active ? "Verified by Mpah Mapu" : `Badge ${(data.status || "inactive").toLowerCase()}`}
              </span>
            </div>

            <div style={{ padding: "28px 28px 32px", textAlign: "center" }}>
              {/* photo */}
              <div style={{ width: 128, height: 128, borderRadius: "50%", margin: "0 auto 18px",
                border: "3px solid #f97316", overflow: "hidden", background: "rgba(249,115,22,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {data.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={data.photoUrl} alt={data.name ?? "Badge holder"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 44, fontWeight: 800, color: "#f97316" }}>
                      {(data.name ?? "?").charAt(0).toUpperCase()}</span>}
              </div>

              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.4px" }}>
                {data.name}
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, color: "#f97316",
                textTransform: "uppercase", letterSpacing: "0.1em" }}>{roleLabel}</p>

              {/* meta chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 18 }}>
                {!isCompany && data.category && (
                  <Chip icon={<Briefcase size={12} />}>{data.category}</Chip>
                )}
                <Chip icon={<Star size={12} color="#f97316" />}>
                  {r.hasReviews ? `${r.value} · ${r.reviews} review${r.reviews === 1 ? "" : "s"}` : "New"}
                </Chip>
                {memberYear && <Chip icon={<Calendar size={12} />}>Since {memberYear}</Chip>}
              </div>

              {/* badge id */}
              <div style={{ marginTop: 22, background: "#0d0d0d", border: "1px solid #232323",
                borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>ID</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#f97316", letterSpacing: "0.5px",
                  fontFamily: "monospace" }}>{data.badgeId}</span>
              </div>

              {!data.active && (
                <p style={{ margin: "16px 0 0", fontSize: 12, color: "#f59e0b", lineHeight: 1.6 }}>
                  This badge holder's account is currently {(data.status || "inactive").toLowerCase()}.
                  Please treat this badge with caution.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <p style={{ marginTop: 22, fontSize: 11, color: "#444", textAlign: "center" }}>
        Scan any Mpah Mapu badge to confirm the holder's identity. ·{" "}
        <Link href="/" style={{ color: "#666" }}>mpahmapu.com</Link>
      </p>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#1c1c1c",
      border: "1px solid #272727", borderRadius: 999, padding: "5px 12px", fontSize: 12,
      fontWeight: 600, color: "#c0c0c0" }}>
      {icon}{children}
    </span>
  );
}
