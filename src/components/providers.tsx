"use client";

import { useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastProvider } from "@/components/ui/toast";
import { LanguageProvider } from "@/lib/language-context";
import { captureReferral } from "@/lib/referral";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
  // Persist a ?ref= invite code app-wide so it survives into the guest post flow.
  useEffect(() => { captureReferral(); }, []);
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LanguageProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}

