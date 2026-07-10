"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";
import { getJob, type JobDto } from "@/lib/api";
import { forwardGeocode } from "@/lib/geocoding";
import { NavigationMap, type NavigationDestination } from "@/components/map/NavigationMap";
import { useLanguage } from "@/lib/language-context";

export default function NavigateToJob() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [job, setJob] = useState<JobDto | null>(null);
  const [dest, setDest] = useState<NavigationDestination | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no-location" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await getJob(id);
        if (!alive) return;
        setJob(j);

        const label = [j.houseNumber, j.street].filter(Boolean).join(" ")
          || j.address
          || [j.village, j.cell, j.sector, j.district].filter(Boolean).join(", ")
          || j.district;

        // Prefer the exact pin the employer dropped; otherwise geocode the street address.
        if (j.latitude != null && j.longitude != null) {
          setDest({ latitude: j.latitude, longitude: j.longitude, label });
          setStatus("ready");
          return;
        }
        const query = [j.street, j.village, j.cell, j.sector, j.district, j.province, "Rwanda"]
          .filter(Boolean).join(", ");
        const hit = await forwardGeocode(query);
        if (!alive) return;
        if (hit) {
          setDest({ latitude: hit.latitude, longitude: hit.longitude, label });
          setStatus("ready");
        } else {
          setStatus("no-location");
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, [id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: 480 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}
        >
          <ArrowLeft size={16} /> {t("common.general.back") || "Back"}
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t("navigate.title") || "Navigate to job"}{job ? ` · ${job.title}` : ""}
          </p>
          {dest?.label && (
            <p style={{ margin: 0, fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} /> {dest.label}
            </p>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 420, position: "relative" }}>
        {status === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, height: "100%", color: "#555" }}>
            <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>{t("navigate.loading") || "Preparing your route…"}</span>
          </div>
        )}
        {status === "ready" && dest && <NavigationMap destination={dest} />}
        {(status === "no-location" || status === "error") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", color: "#888", textAlign: "center", padding: 20 }}>
            <MapPin size={28} color="#ef4444" />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#ccc" }}>
              {status === "error" ? (t("navigate.error") || "Couldn't load this job") : (t("navigate.no_location") || "No precise location for this job")}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#666", maxWidth: 320 }}>
              {t("navigate.no_location_hint") || "The employer hasn't pinned an exact spot yet. Contact them for the street and house number."}
            </p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
