"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
export interface Session {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  totpEnabled: boolean;
  emailVerified: boolean;
  createdAt?: string;
  badgeId?: string;
  badgeUrl?: string;
  /** Badge photo (the badge's own picture). */
  photoUrl?: string;
  /** Custom profile picture the user uploaded, if any. */
  profilePhotoUrl?: string | null;
  /** Whether the badge photo may be shown as the profile picture. */
  photoOnProfile?: boolean;
  /** Resolved picture shown publicly - custom, else badge photo if consented, else null. */
  profilePhoto?: string | null;
  accountStatus?: string;
  profileCompletion?: number;
  approvalEligible?: boolean;
  approved?: boolean;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const s   = raw ? JSON.parse(raw) : null;
      if (!s || !s.email) {
        throw new Error("Invalid session");
      }
      setSession({
        id:            s.id   || "",
        name:          s.name,
        email:         s.email,
        phone:         s.phone || "",
        role:          s.role,
        totpEnabled:   s.totpEnabled ?? false,
        emailVerified: s.emailVerified ?? false,
        createdAt:     s.createdAt,
        badgeId:       s.badgeId,
        badgeUrl:      s.badgeUrl,
        photoUrl:      s.photoUrl,
        profilePhotoUrl: s.profilePhotoUrl,
        photoOnProfile:  s.photoOnProfile,
        profilePhoto:    s.profilePhoto,
        accountStatus:     s.accountStatus,
        profileCompletion: s.profileCompletion,
        approvalEligible:  s.approvalEligible,
        approved:          s.approved,
      });
      setLoading(false);

      // Async fetch to ensure we have the freshest data (e.g. badge updates)
      const token = localStorage.getItem("access_token");
      if (token) {
        // Browsers rotate push subscriptions; re-register silently for anyone who already
        // granted permission. No-op when unsupported or not granted - never prompts here.
        import("@/lib/push").then(({ syncPushSubscription }) => syncPushSubscription(token)).catch(() => {});
        import("@/lib/api").then(({ getProfile }) => {
          getProfile(token).then((freshUser) => {
            const updated = {
              ...s,
              ...freshUser,
            };
            localStorage.setItem("user", JSON.stringify(updated));
            setSession((prev) => prev ? {
              ...prev,
              badgeId: freshUser.badgeId,
              badgeUrl: freshUser.badgeUrl,
              photoUrl: freshUser.photoUrl,
              name: freshUser.name,
              phone: freshUser.phone || prev.phone,
              accountStatus:     freshUser.accountStatus,
              profileCompletion: freshUser.profileCompletion,
              approvalEligible:  freshUser.approvalEligible,
              approved:          freshUser.approved,
            } : prev);
          }).catch(() => { /* ignore */ });
        });
      }

    } catch {
      // If we're already on an auth page, don't loop
      if (!pathname.startsWith("/signin") && !pathname.startsWith("/signup")) {
        router.push("/signin");
      } else {
        setLoading(false);
      }
    }
  }, [router, pathname]);

  if (loading) {
    return <div style={{ height: "100vh", background: "#090909" }} />;
  }

  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
