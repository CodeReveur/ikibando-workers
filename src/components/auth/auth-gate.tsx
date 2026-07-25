"use client";

import { useState } from "react";
import { Loader2, Mail, ShieldCheck, QrCode, Clock, Copy, Check } from "lucide-react";
import {
  AuthResult, verifyEmailCode, resendOtpCode, loginWithEmail, authenticate2fa, enableTotp,
  snoozeTotpSetup,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";

/** Skip-mode reminder windows for deferring the mandatory 2FA setup. */
const SNOOZE_OPTIONS: { days: number; label: string }[] = [
  { days: 2, label: "2 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
];

interface Props {
  /** The gated login response (requiresEmailVerification / requires2fa / requires2faSetup). */
  result: AuthResult;
  email: string;
  password: string;
  /** Called once the user is fully authenticated (full tokens present). */
  onResolved: (final: AuthResult) => void;
}

type Mode = "EMAIL" | "CODE" | "SETUP";

function modeOf(r: AuthResult): Mode | null {
  if (r.requiresEmailVerification) return "EMAIL";
  if (r.requires2faSetup) return "SETUP";
  if (r.requires2fa) return "CODE";
  return null;
}

export function AuthGate({ result, email, password, onResolved }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [active, setActive] = useState<AuthResult>(result);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(7);
  const [snoozing, setSnoozing] = useState(false);
  const [copied, setCopied] = useState(false);
  const mode = modeOf(active);

  const copySecret = async () => {
    if (!active.secret) return;
    try {
      await navigator.clipboard.writeText(active.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toastError("Copy failed. Select the key and copy it manually.", { title: "Clipboard blocked" });
    }
  };

  // If a fresh result has no gate, resolve immediately.
  const advance = (r: AuthResult) => {
    if (modeOf(r) === null && r.accessToken) onResolved(r);
    else { setActive(r); setCode(""); }
  };

  const submit = async () => {
    if (code.length < 6) { toastError("Enter the 6-digit code.", { title: "Code required" }); return; }
    setLoading(true);
    try {
      if (mode === "EMAIL") {
        await verifyEmailCode(email, code);
        toastSuccess("Email verified.", { title: "Verified" });
        // Re-attempt login now that the email is verified (may surface 2FA next).
        advance(await loginWithEmail({ email, password }));
      } else if (mode === "CODE") {
        onResolved(await authenticate2fa(active.tempToken || "", code));
      } else if (mode === "SETUP") {
        await enableTotp(code, active.accessToken);
        toastSuccess("Two-factor authentication enabled.", { title: "Secured" });
        onResolved(active);
      }
    } catch (e: any) {
      toastError(e?.response?.data?.message || "Invalid or expired code. Please try again.",
        { title: "Verification failed" });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true); setCode("");
    try { await resendOtpCode(email); toastSuccess("A new code has been sent.", { title: "Code sent" }); }
    catch (e: any) { toastError(e?.response?.data?.message || "Failed to resend.", { title: "Resend failed" }); }
    finally { setLoading(false); }
  };

  // Skip mode: defer setup and continue. The user already holds full tokens at the SETUP gate.
  const skipSetup = async () => {
    setSnoozing(true);
    try {
      await snoozeTotpSetup(snoozeDays, active.accessToken);
      const label = SNOOZE_OPTIONS.find(o => o.days === snoozeDays)?.label || `${snoozeDays} days`;
      toastSuccess(`We'll remind you in ${label}.`, { title: "Reminder set" });
      onResolved(active);
    } catch (e: any) {
      toastError(e?.response?.data?.message || "Could not defer setup. Please try again.",
        { title: "Skip failed" });
    } finally {
      setSnoozing(false);
    }
  };

  if (!mode) return null;

  const title = mode === "EMAIL" ? "Verify your email"
    : mode === "SETUP" ? "Set up two-factor authentication"
    : "Two-factor authentication";
  const subtitle = mode === "EMAIL" ? `Enter the code we sent to ${email} to continue.`
    : mode === "SETUP" ? "Scan the QR with an authenticator app, then enter the 6-digit code — or pick a reminder and set it up later."
    : "Enter the 6-digit code from your authenticator app.";
  const Icon = mode === "EMAIL" ? Mail : mode === "SETUP" ? QrCode : ShieldCheck;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#f97316]/15 flex items-center justify-center">
              <Icon size={17} className="text-[#f97316]" />
            </div>
            <h2 className="text-base font-bold text-white leading-tight">{title}</h2>
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">{subtitle}</p>
        </div>

        <div className="p-6 space-y-4">
          {mode === "SETUP" && active.qrCodeUri && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.qrCodeUri} alt="Scan with authenticator"
                className="w-40 h-40 rounded-xl border border-[#2a2a2a] bg-white p-2" />
            </div>
          )}

          {mode === "SETUP" && active.secret && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-gray-500 text-center">
                Can&apos;t scan? Enter this key in your authenticator app.
              </p>
              <button
                type="button"
                onClick={copySecret}
                title="Copy setup key"
                className="w-full flex items-center justify-between gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 hover:border-[#3a3a3a] transition-colors group"
              >
                <code className="text-xs text-gray-300 font-mono tracking-wider break-all text-left leading-relaxed">
                  {active.secret.replace(/(.{4})/g, "$1 ").trim()}
                </code>
                {copied
                  ? <Check size={15} className="text-green-500 shrink-0" />
                  : <Copy size={15} className="text-gray-500 group-hover:text-gray-300 shrink-0" />}
              </button>
            </div>
          )}

          <input
            type="text"
            inputMode="numeric"
            autoFocus
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors text-center tracking-[0.4em] font-mono"
            maxLength={8}
          />

          <button
            onClick={submit}
            disabled={loading || code.length < 6}
            className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {mode === "EMAIL" ? "Verify & continue" : mode === "SETUP" ? "Enable & continue" : "Verify"}
          </button>

          {mode === "SETUP" && (
            <div className="pt-4 mt-1 border-t border-[#2a2a2a] space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock size={13} className="text-gray-500" />
                <span>Not now? Pick when we should remind you.</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {SNOOZE_OPTIONS.map((o) => (
                  <button
                    key={o.days}
                    type="button"
                    onClick={() => setSnoozeDays(o.days)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      snoozeDays === o.days
                        ? "bg-[#f97316]/15 border-[#f97316] text-[#f97316]"
                        : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a]"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={skipSetup}
                disabled={snoozing || loading}
                className="w-full text-xs font-semibold text-gray-400 hover:text-gray-200 disabled:opacity-50 py-2 flex items-center justify-center gap-2 transition-colors"
              >
                {snoozing && <Loader2 size={13} className="animate-spin" />}
                Skip for now
              </button>
            </div>
          )}

          {mode === "EMAIL" && (
            <p className="text-center text-xs text-gray-600">
              Didn&apos;t receive it?{" "}
              <button onClick={resend} disabled={loading} className="text-[#f97316] hover:underline disabled:opacity-50">
                Resend code
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
