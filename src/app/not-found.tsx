import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found | MpahMapu",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: "#111" }}
    >
      <h1 className="text-7xl font-extrabold text-[#f97316]">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-white">
        Page Not Found
      </h2>
      <p className="mt-2 max-w-md text-gray-400">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might
        have been moved or no longer exists.
      </p>

      <nav className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-lg bg-[#f97316] px-6 py-3 font-semibold text-white transition hover:bg-[#ea580c]"
        >
          Go Home
        </Link>
        <Link
          href="/browse"
          className="rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition hover:border-[#f97316] hover:text-[#f97316]"
        >
          Browse Workers
        </Link>
        <Link
          href="/jobs"
          className="rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition hover:border-[#f97316] hover:text-[#f97316]"
        >
          Find Jobs
        </Link>
      </nav>
    </main>
  );
}
