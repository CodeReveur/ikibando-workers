/**
 * Referral-code capture. When a visitor arrives on any page via an invite link (?ref=CODE), we
 * persist the code so it survives navigation into flows that create an account later — notably the
 * guest job-posting flow, where an invited employer never touches the /signup page.
 */
const KEY = "MpahMapu_ref";

/** Store the ?ref= code from the current URL, if present. Safe to call on every page load. */
export function captureReferral(): void {
  if (typeof window === "undefined") return;
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && ref.trim()) localStorage.setItem(KEY, ref.trim().toUpperCase());
  } catch {
    /* ignore */
  }
}

/** The captured referral code, or undefined. */
export function getReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.trim().toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}

/** Forget the captured referral code — call once it has been attributed to a new account. */
export function clearReferralCode(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
