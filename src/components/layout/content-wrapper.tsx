"use client";

import { usePathname } from "next/navigation";

const AUTH_PATHS = ["/signin", "/signup", "/forgot-password", "/reset-password", "/dashboard"];

export function ContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PATHS.includes(pathname) || pathname.startsWith("/dashboard") || pathname.startsWith("/seeker") || pathname.startsWith("/owner");
  return (
    <div style={isAuth ? {} : { paddingTop: "72px" }}>{children}</div>
  );
}
