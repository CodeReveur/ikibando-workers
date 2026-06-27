const KEY = "auth_redirect";

export function saveRedirect(url?: string) {
  try {
    const target = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (target) sessionStorage.setItem(KEY, target);
  } catch {}
}

export function getAndClearRedirect(): string | null {
  try {
    const val = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return val;
  } catch {
    return null;
  }
}
