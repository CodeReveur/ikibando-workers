"use client";

import { useEffect, useState } from "react";
import { X, HeartHandshake, Loader2, Check, AlertCircle } from "lucide-react";
import { PayMethodSelector, payFieldsOf, type PayMethodValue, type SelectedMethod } from "@/components/ui/pay-logos";
import { runDonation } from "@/lib/pay-flow";
import { useLanguage } from "@/lib/language-context";
import { Z } from "@/lib/z-layers";

const PRESETS = [1000, 2000, 5000, 10000, 20000];
const ACCENT = "#f97316";

type Phase = "form" | "processing" | "success" | "failed";

/**
 * A donation checkout. Works for guests and signed-in users alike (a stored access token, when
 * present, links the gift to the account; otherwise it is anonymous). Mobile money pushes a USSD
 * prompt; card opens the hosted checkout in a new tab. We poll until the gift settles.
 */
export function DonationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState<number>(2000);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<PayMethodValue>("MTN_MOMO");
  const [selMethod, setSelMethod] = useState<SelectedMethod | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);

  const isCard = method === "VISA" || method === "MASTERCARD";
  const effectiveAmount = custom.trim() ? Math.max(0, parseInt(custom.replace(/[^0-9]/g, ""), 10) || 0) : amount;

  // Reset to a clean form whenever the modal is (re)opened.
  useEffect(() => {
    if (open) { setPhase("form"); setError(null); }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && phase !== "processing") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    if (effectiveAmount < 100) { setError(t("donate.err_amount")); return; }
    if (!isCard && phone.trim().length < 8) { setError(t("donate.err_phone")); return; }

    setPhase("processing");
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || undefined : undefined;
    try {
      const outcome = await runDonation({
        amount: effectiveAmount,
        paymentMethod: method,
        phoneNumber: isCard ? undefined : phone.trim(),
        name: name.trim() || undefined,
        message: message.trim() || undefined,
        anonymous,
        ...payFieldsOf(selMethod),
      }, token);
      if (outcome === "success") setPhase("success");
      else if (outcome === "failed") { setPhase("failed"); setError(t("donate.err_failed")); }
      else { setPhase("failed"); setError(t("donate.err_pending")); }
    } catch {
      setPhase("failed");
      setError(t("donate.err_generic"));
    }
  };

  return (
    <div
      onClick={() => phase !== "processing" && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: Z.modal, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <style>{`
        .donate-card { scrollbar-width: thin; scrollbar-color: #3a3a3a transparent; }
        .donate-card::-webkit-scrollbar { width: 6px; }
        .donate-card::-webkit-scrollbar-track { background: transparent; }
        .donate-card::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 999px; }
        .donate-card::-webkit-scrollbar-thumb:hover { background: #4a4a4a; }
      `}</style>
      <div
        className="donate-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440, background: "#141414", border: "1px solid #2a2a2a",
          borderRadius: 16, padding: "20px clamp(16px, 4vw, 22px)",
          maxHeight: "min(88vh, 720px)", overflowY: "auto", overflowX: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(249,115,22,0.14)", color: ACCENT, flexShrink: 0,
            }}>
              <HeartHandshake size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f0f0" }}>{t("donate.title")}</div>
              <div style={{ fontSize: 12, color: "#8a8a8a" }}>{t("donate.subtitle")}</div>
            </div>
          </div>
          <button onClick={onClose} disabled={phase === "processing"} aria-label="Close" style={{
            background: "none", border: "none", color: "#888", cursor: phase === "processing" ? "not-allowed" : "pointer", padding: 4,
          }}><X size={18} /></button>
        </div>

        {phase === "success" ? (
          <div style={{ textAlign: "center", padding: "26px 8px 10px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 99, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(34,197,94,0.15)", color: "#22c55e",
            }}><Check size={28} /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#f0f0f0", marginBottom: 6 }}>{t("donate.thanks_title")}</div>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 20 }}>
              {t("donate.thanks_body")} <strong style={{ color: "#f0f0f0" }}>{effectiveAmount.toLocaleString()} RWF</strong>.
            </div>
            <button onClick={onClose} style={primaryBtn}>{t("donate.done")}</button>
          </div>
        ) : phase === "processing" ? (
          <div style={{ textAlign: "center", padding: "30px 8px" }}>
            <Loader2 size={34} color={ACCENT} style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", marginTop: 16 }}>
              {isCard ? t("donate.processing_card") : t("donate.processing_momo")}
            </div>
            <div style={{ fontSize: 12.5, color: "#8a8a8a", marginTop: 6 }}>{t("donate.processing_hint")}</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Amount presets */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>
              {t("donate.amount")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {PRESETS.map(p => {
                const active = !custom.trim() && amount === p;
                return (
                  <button key={p} onClick={() => { setAmount(p); setCustom(""); }} style={{
                    flex: "1 0 auto", minWidth: 72, padding: "9px 10px", borderRadius: 10, cursor: "pointer",
                    fontSize: 13, fontWeight: 700,
                    background: active ? "rgba(249,115,22,0.14)" : "#1c1c1c",
                    border: `1px solid ${active ? ACCENT : "#2a2a2a"}`,
                    color: active ? ACCENT : "#ccc",
                  }}>{p.toLocaleString()}</button>
                );
              })}
            </div>
            <input
              value={custom}
              onChange={e => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder={t("donate.custom_amount")}
              style={inputStyle}
            />

            {/* Payment method */}
            <div style={{ margin: "16px 0 8px", fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("donate.method")}
            </div>
            <PayMethodSelector value={method} onChange={setMethod} onMethod={setSelMethod} />

            {!isCard && (
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                inputMode="tel"
                placeholder={t("donate.phone")}
                style={{ ...inputStyle, marginTop: 10 }}
              />
            )}

            {/* Optional identity */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("donate.name_optional")}
              style={{ ...inputStyle, marginTop: 10 }}
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t("donate.message_optional")}
              rows={2}
              style={{ ...inputStyle, marginTop: 10, resize: "vertical" as const }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontSize: 13, color: "#bbb" }}>
              <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} style={{ accentColor: ACCENT }} />
              {t("donate.anonymous")}
            </label>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12.5, color: "#ef4444" }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button onClick={submit} style={{ ...primaryBtn, marginTop: 16 }}>
              {t("donate.give")} {effectiveAmount > 0 ? `${effectiveAmount.toLocaleString()} RWF` : ""}
            </button>
            <div style={{ fontSize: 11, color: "#666", textAlign: "center", marginTop: 10 }}>{t("donate.secure_note")}</div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 10,
  padding: "10px 12px", fontSize: 13.5, color: "#f0f0f0", outline: "none",
};

const primaryBtn: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
  background: ACCENT, color: "#fff", fontSize: 14, fontWeight: 800,
};
