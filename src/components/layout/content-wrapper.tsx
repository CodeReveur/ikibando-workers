"use client";

import { usePathname } from "next/navigation";

const AUTH_PATHS = ["/signin", "/signup", "/forgot-password", "/reset-password"];

export function ContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PATHS.includes(pathname);
  return (
    <div style={isAuth ? {} : { paddingTop: "72px" }}>{children}</div>
  );
}
