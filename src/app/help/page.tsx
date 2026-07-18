"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Search, ChevronDown, MessageCircle } from "lucide-react";
import { getPricingConfig, DEFAULT_PRICING, type PricingConfig } from "@/lib/api";
import { buildHelpSections } from "@/lib/help-content";

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008 0c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.504-5.729-1.464L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.29 1.977 13.82 1.95 11.8 1.95c-5.438 0-9.863 4.373-9.867 9.803-.001 1.73.475 3.424 1.378 4.9l-1.01 3.687 3.756-.986z"/>
    </svg>
  );
}

export default function HelpCenter() {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getPricingConfig().then(setPricing).catch(() => {});
  }, []);

  const sections = useMemo(() => buildHelpSections(pricing), [pricing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map(s => ({ ...s, items: s.items.filter(i => (i.q + " " + i.a).toLowerCase().includes(q)) }))
      .filter(s => s.items.length > 0);
  }, [sections, query]);

  const channels = [
    { Icon: WhatsAppIcon, label: "WhatsApp", sub: "Replies in ~5 min", href: "https://wa.me/250781121117", color: "#25d366" },
    { Icon: Mail, label: "Email", sub: "info@mpahmapu.com", href: "mailto:info@mpahmapu.com", color: "#f97316" },
    { Icon: Phone, label: "Call us", sub: "+250 781 121 117", href: "tel:+250781121117", color: "#22c55e" },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Help Center</h1>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-gray-500">
          Answers about jobs, workers, payments, escrow, fees and verification on MpahMapu. Still stuck?
          Tap the chat bubble at the bottom-right to talk to BazaBot — it can connect you to a live agent.
        </p>
      </div>

      {/* Search */}
      <div className="relative mx-auto mt-7 max-w-xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search help…"
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-[15px] text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
      </div>

      {/* Channels */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {channels.map(c => (
          <a
            key={c.label} href={c.href} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 transition hover:border-orange-300 hover:shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${c.color}18`, color: c.color }}>
              <c.Icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-gray-900">{c.label}</span>
              <span className="block truncate text-xs text-gray-500">{c.sub}</span>
            </span>
          </a>
        ))}
      </div>

      {/* FAQ sections */}
      <div className="mt-10 space-y-9">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">No results for “{query}”. Try different words.</p>
        )}
        {filtered.map(section => (
          <section key={section.title}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-600">{section.title}</h2>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {section.items.map(item => {
                const id = section.title + item.q;
                const isOpen = open === id || !!query.trim();
                return (
                  <div key={id}>
                    <button
                      onClick={() => setOpen(open === id ? null : id)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
                    >
                      <span className="text-[14.5px] font-semibold text-gray-900">{item.q}</span>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-[14px] leading-relaxed text-gray-600">{item.a}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Foot note */}
      <div className="mt-10 flex items-center justify-center gap-2 rounded-xl bg-orange-50 px-4 py-3 text-center text-[13px] text-orange-700">
        <MessageCircle size={16} />
        Can’t find your answer? Chat with BazaBot (bottom-right) — it can connect you to a live agent.
      </div>
    </main>
  );
}
