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
  photoUrl?: string;
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
        photoUrl:      s.photoUrl,
      });
      setLoading(false);
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
