"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastProvider } from "@/components/ui/toast";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </GoogleOAuthProvider>
  );
}
