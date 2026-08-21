"use client";

import { useGoogleLogin } from "@react-oauth/google";

/**
 * True when a Google client id was baked into the bundle at build time.
 * NEXT_PUBLIC_* values are inlined at build, so this is a constant per deploy.
 */
export const GOOGLE_AUTH_ENABLED = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GateProps {
  onSuccess: (tokens: { access_token: string }) => void | Promise<void>;
  onError?: () => void;
  /** Render prop for the actual button; `start` opens the Google popup. */
  children: (start: () => void) => React.ReactNode;
}

/**
 * Mounts the Google login hook only where it can actually work. `useGoogleLogin`
 * initializes the GSI client on mount, and with an empty client id GSI throws
 * "Missing required parameter client_id" — crashing the whole page before any
 * button is clicked. Callers must render this gate (and its button) only when
 * {@link GOOGLE_AUTH_ENABLED} is true; without the env var, Google sign-in simply
 * doesn't appear and email/password still works.
 */
export function GoogleLoginGate({ onSuccess, onError, children }: GateProps) {
  const start = useGoogleLogin({ onSuccess, onError });
  return <>{children(() => start())}</>;
}
