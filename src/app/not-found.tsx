"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <main
        className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
        style={{ backgroundColor: "#111", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}
      >
        <h1 className="text-7xl font-extrabold text-[#f97316]">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-white">
          {t("not_found_page.heading")}
        </h2>
        <p className="mt-2 max-w-md text-gray-400">
          {t("not_found_page.description")}
        </p>

        <nav className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-lg bg-[#f97316] px-6 py-3 font-semibold text-white transition hover:bg-[#ea580c]"
          >
            {t("not_found_page.go_home")}
          </Link>
          <Link
            href="/browse"
            className="rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition hover:border-[#f97316] hover:text-[#f97316]"
          >
            {t("not_found_page.browse_workers")}
          </Link>
          <Link
            href="/jobs"
            className="rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition hover:border-[#f97316] hover:text-[#f97316]"
          >
            {t("not_found_page.find_jobs")}
          </Link>
        </nav>
      </main>
    </>
  );
}
