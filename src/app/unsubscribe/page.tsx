"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { unsubscribeNewsletter } from "@/lib/api";

/**
 * Opt-out landing page for the link in broadcast emails.
 *
 * The click lands here and shows a button rather than unsubscribing on load: mail clients and
 * security scanners prefetch links, and a page that acts on GET would quietly unsubscribe people
 * who never clicked anything.
 */
function UnsubscribeInner() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function confirm() {
    if (!token) return;
    setState("loading");
    try {
      await unsubscribeNewsletter(token);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <main
      style={{
        background: "#111",
        minHeight: "100vh",
        color: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "#1c1c1c",
          border: "1px solid #272727",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
        }}
      >
        {state === "done" ? (
          <>
            <CheckCircle2 size={34} color="#22c55e" style={{ marginBottom: 16 }} />
            <h1 style={{ fontSize: 21, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
              You&apos;re unsubscribed
            </h1>
            <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, margin: "0 0 24px" }}>
              You won&apos;t get product updates or the newsletter from us any more. Messages about
              your jobs, payments and account will still reach you - those aren&apos;t marketing.
            </p>
            <Link
              href="/"
              style={{ color: "#f97316", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}
            >
              Back to MpahMapu
            </Link>
          </>
        ) : (
          <>
            <Mail size={32} color="#f97316" style={{ marginBottom: 16 }} />
            <h1 style={{ fontSize: 21, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
              Unsubscribe from updates?
            </h1>
            <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, margin: "0 0 24px" }}>
              You&apos;ll stop getting product updates and the newsletter. Notifications about your
              jobs, payments and account are unaffected.
            </p>

            {!token ? (
              <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>
                This link is missing its code. Please use the Unsubscribe link in the email itself.
              </p>
            ) : (
              <>
                <button
                  onClick={confirm}
                  disabled={state === "loading"}
                  style={{
                    background: "#f97316",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 26px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: state === "loading" ? "default" : "pointer",
                    opacity: state === "loading" ? 0.6 : 1,
                  }}
                >
                  {state === "loading" ? "Unsubscribing…" : "Yes, unsubscribe me"}
                </button>
                {state === "error" && (
                  <p style={{ fontSize: 13, color: "#ef4444", margin: "16px 0 0" }}>
                    That didn&apos;t work. Please try again, or contact us and we&apos;ll do it for
                    you.
                  </p>
                )}
                <div style={{ marginTop: 18 }}>
                  <Link
                    href="/"
                    style={{ color: "#666", fontSize: 13, textDecoration: "none" }}
                  >
                    No, keep me subscribed
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  // useSearchParams needs a Suspense boundary to avoid opting the whole route into CSR bailout.
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
