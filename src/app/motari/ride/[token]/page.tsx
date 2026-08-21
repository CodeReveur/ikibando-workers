"use client";

import { useState, useEffect, useCallback, use } from "react";
import Footer from "@/components/layout/footer";
import { TrackMap } from "@/components/motari/TrackMap";
import { trackRide, cancelRide, rateRide, apiError, type RideDto } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { Bike, Phone, Star, X } from "lucide-react";

const ACTIVE_TOKEN_KEY = "motari_ride_token";
const POLL_MS = 4000;

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const km = (m?: number) => `${((m ?? 0) / 1000).toFixed(1)} km`;

const TERMINAL = ["CLOSED", "CANCELLED", "NO_MATCH"];

/**
 * The passenger's live ride page, keyed by the private ride token from the URL —
 * shareable with family as a trip-share link. Polls ride state; the server is
 * always the truth, so reopening this link recovers the ride on any device.
 */
export default function RidePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t } = useLanguage();

  const [ride, setRide] = useState<RideDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stars, setStars] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await trackRide(token);
      setRide(r);
      if (TERMINAL.includes(r.status)) localStorage.removeItem(ACTIVE_TOKEN_KEY);
    } catch {
      setNotFound(true);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      // Stop polling once the ride can no longer change under us.
      setRide(current => {
        if (!current || !TERMINAL.includes(current.status)) refresh();
        return current;
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const doCancel = async () => {
    setBusy(true);
    setError("");
    try { setRide(await cancelRide(token)); localStorage.removeItem(ACTIVE_TOKEN_KEY); }
    catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const doRate = async (n: number) => {
    setStars(n);
    try { setRide(await rateRide(token, n)); } catch (e) { setError(apiError(e)); }
  };

  const box: React.CSSProperties = {
    background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14, padding: 16,
  };

  if (notFound) {
    return (
      <div style={{ background: "#111", minHeight: "100vh", color: "#eee", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#888" }}>{t("motari.ride.not_found") || "This ride link isn't valid anymore."}</p>
          <a href="/motari" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>
            {t("common.buttons.ask_motari") || "Ask Motari"} →
          </a>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div style={{ background: "#111", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#f97316] animate-spin" />
      </div>
    );
  }

  const meteredSoFar = ride.fareMode === "METERED"
    ? Math.max(ride.minFareRwf, Math.round((ride.baseFareRwf + ride.perKmRwf * (ride.riddenDistanceM ?? 0) / 1000) / 100) * 100)
    : null;

  const statusLine: Record<string, string> = {
    SEARCHING: t("motari.ride.searching") || "Finding your motari…",
    ASSIGNED: t("motari.ride.assigned") || "Your motari is on the way",
    ARRIVED: t("motari.ride.arrived") || "Your motari has arrived — look for the plate below",
    IN_RIDE: t("motari.ride.in_ride") || "Ride in progress — enjoy the trip",
    COMPLETED: t("motari.ride.completed") || "You've arrived. Please pay your motari.",
    CLOSED: t("motari.ride.closed") || "Ride complete — thank you!",
    CANCELLED: t("motari.ride.cancelled") || "This ride was cancelled.",
    NO_MATCH: t("motari.ride.no_match") || "No motari found nearby right now.",
  };

  return (
    <div style={{ background: "#111", minHeight: "100vh", color: "#eee" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 48px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Bike size={24} color="#f97316" />
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{statusLine[ride.status]}</h1>
        </div>
        <p style={{ color: "#777", fontSize: 12.5, margin: "0 0 18px" }}>
          {ride.pickupName || `${ride.pickupLat.toFixed(4)}, ${ride.pickupLng.toFixed(4)}`}
          {ride.destName
            ? ` → ${ride.destName}`
            : ` · ${t("motari.ride.open_destination") || "open destination (metered)"}`}
        </p>

        {/* SEARCHING */}
        {ride.status === "SEARCHING" && (
          <div style={{ ...box, textAlign: "center", marginBottom: 14 }}>
            <div style={{ margin: "12px auto 16px", width: 44, height: 44, borderRadius: "50%", border: "3px solid #2a2a2a", borderTopColor: "#f97316", animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: "#888", fontSize: 13, margin: "0 0 4px" }}>
              {t("motari.ride.searching_hint") || "Nearby motari can see your request."}
            </p>
            {typeof ride.searchSecondsLeft === "number" && (
              <p style={{ color: "#555", fontSize: 12, margin: 0 }}>
                {(t("motari.ride.seconds_left") || "Giving up in")} {Math.ceil(ride.searchSecondsLeft)}s
              </p>
            )}
            <button onClick={doCancel} disabled={busy} style={{
              marginTop: 14, background: "transparent", color: "#f87171", borderRadius: 999,
              padding: "9px 22px", fontWeight: 700, fontSize: 13, border: "1px solid #7f1d1d",
              cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <X size={13} /> {t("motari.ride.cancel") || "Cancel request"}
            </button>
          </div>
        )}

        {/* Driver card */}
        {ride.driver && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
          <div style={{ ...box, marginBottom: 14, display: "flex", gap: 14, alignItems: "center" }}>
            {ride.driver.photoUrl
              ? <img src={ride.driver.photoUrl} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid #f97316" }} />
              : <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#fff" }}>
                  {ride.driver.name?.[0] ?? "M"}
                </div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{ride.driver.name}</div>
              <div style={{ fontSize: 12.5, color: "#888", display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                <span style={{ background: "#141414", border: "1px solid #333", borderRadius: 6, padding: "1px 8px", fontWeight: 700, color: "#f97316", letterSpacing: "0.05em" }}>
                  {ride.driver.plateNumber || "—"}
                </span>
                {typeof ride.driver.rating === "number" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Star size={12} color="#fbbf24" fill="#fbbf24" /> {ride.driver.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            {ride.driver.phone && (
              <a href={`tel:${ride.driver.phone}`} style={{
                background: "#f97316", borderRadius: "50%", width: 42, height: 42,
                display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
              }}>
                <Phone size={17} color="#fff" />
              </a>
            )}
          </div>
        )}

        {/* Map */}
        {["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
          <div style={{ marginBottom: 14 }}>
            <TrackMap
              pickup={{ latitude: ride.pickupLat, longitude: ride.pickupLng }}
              destination={ride.destLat != null && ride.destLng != null
                ? { latitude: ride.destLat, longitude: ride.destLng } : null}
              driver={ride.driver?.latitude != null && ride.driver?.longitude != null
                ? { latitude: ride.driver.latitude, longitude: ride.driver.longitude } : null}
            />
          </div>
        )}

        {/* Fare panel */}
        <div style={{ ...box, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", fontWeight: 700 }}>
              {ride.fareMode === "QUOTED"
                ? (t("motari.ride.fixed_fare") || "Fixed fare")
                : (t("motari.ride.metered") || "Metered")}
            </div>
            <div style={{ fontSize: 12.5, color: "#888", marginTop: 3 }}>
              {ride.fareMode === "QUOTED"
                ? `≈ ${km(ride.quotedDistanceM)}`
                : `${km(ride.riddenDistanceM)} · ${fmt(ride.baseFareRwf)} + ${fmt(ride.perKmRwf)}/km`}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#f97316" }}>
            {ride.finalFareRwf != null
              ? fmt(ride.finalFareRwf)
              : ride.fareMode === "QUOTED" && ride.quotedFareRwf != null
                ? fmt(ride.quotedFareRwf)
                : ride.status === "IN_RIDE" && meteredSoFar != null
                  ? `≈ ${fmt(meteredSoFar)}`
                  : `${fmt(ride.perKmRwf)}/km`}
          </div>
        </div>

        {/* Cancel while waiting for pickup */}
        {["ASSIGNED", "ARRIVED"].includes(ride.status) && (
          <button onClick={doCancel} disabled={busy} style={{
            width: "100%", background: "transparent", color: "#f87171", borderRadius: 999,
            padding: "11px 22px", fontWeight: 700, fontSize: 13, border: "1px solid #7f1d1d",
            cursor: "pointer", fontFamily: "inherit", marginBottom: 14,
          }}>
            {t("motari.ride.cancel_ride") || "Cancel this ride"}
          </button>
        )}

        {/* Payment nudge */}
        {ride.status === "COMPLETED" && (
          <div style={{ ...box, marginBottom: 14, borderColor: "#f97316" }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "#ddd", lineHeight: 1.6 }}>
              {t("motari.ride.pay_hint") || "Pay your motari in cash or mobile money. They'll confirm and you'll get your ride record here."}
            </p>
          </div>
        )}

        {/* Receipt + rating */}
        {ride.status === "CLOSED" && (
          <div style={{ ...box, marginBottom: 14 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", fontWeight: 700, marginBottom: 8 }}>
              {t("motari.ride.receipt") || "Ride record"}
            </div>
            <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.9 }}>
              <div>{t("motari.ride.receipt_driver") || "Motari"}: <b>{ride.driver?.name}</b> · {ride.driver?.plateNumber}</div>
              <div>{t("motari.ride.receipt_distance") || "Distance"}: {km(ride.fareMode === "QUOTED" ? ride.quotedDistanceM : ride.riddenDistanceM)}</div>
              <div>{t("motari.ride.receipt_paid") || "Paid"}: <b style={{ color: "#f97316" }}>{ride.finalFareRwf != null ? fmt(ride.finalFareRwf) : "—"}</b> ({ride.paymentMethod})</div>
            </div>
            {!ride.rating ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12.5, color: "#888", marginBottom: 6 }}>
                  {t("motari.ride.rate_prompt") || "How was your motari?"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => doRate(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      <Star size={26} color="#fbbf24" fill={n <= stars ? "#fbbf24" : "none"} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, color: "#4ade80" }}>
                {(t("motari.ride.rated") || "Rated")} {ride.rating}/5 ★
              </div>
            )}
          </div>
        )}

        {/* Terminal exits */}
        {["CANCELLED", "NO_MATCH"].includes(ride.status) && (
          <a href="/motari" style={{
            display: "block", textAlign: "center", background: "#f97316", color: "#fff",
            borderRadius: 999, padding: "13px 26px", fontWeight: 800, fontSize: 14, textDecoration: "none",
          }}>
            {t("motari.ride.try_again") || "Ask again"}
          </a>
        )}

        {error && <div style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</div>}
      </div>
      <Footer />
    </div>
  );
}
