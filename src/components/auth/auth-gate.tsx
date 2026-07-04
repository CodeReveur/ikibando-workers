"use client";

import { useState } from "react";
import { Loader2, Mail, ShieldCheck, QrCode } from "lucide-react";
import {
  AuthResult, verifyEmailCode, resendOtpCode, loginWithEmail, authenticate2fa, enableTotp,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";

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
  const mode = modeOf(active);

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

  if (!mode) return null;

  const title = mode === "EMAIL" ? "Verify your email"
    : mode === "SETUP" ? "Set up two-factor authentication"
    : "Two-factor authentication";
  const subtitle = mode === "EMAIL" ? `Enter the code we sent to ${email} to continue.`
    : mode === "SETUP" ? "Required after 14 days. Scan the QR with an authenticator app, then enter the 6-digit code."
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
