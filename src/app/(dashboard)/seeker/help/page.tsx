"use client";

import { useState, useEffect } from "react";
import { Mail, Phone, FileText, ChevronRight } from "lucide-react";
import { SectionHead } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";
import { BazaBotChat } from "@/components/support/bazabot";
import { getPricingConfig, DEFAULT_PRICING, type PricingConfig } from "@/lib/api";
import { feePercents } from "@/lib/help-content";

function WhatsAppIcon({ size = 18, color = "#25d366" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill={color} d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008 0c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.504-5.729-1.464L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.29 1.977 13.82 1.95 11.8 1.95c-5.438 0-9.863 4.373-9.867 9.803-.001 1.73.475 3.424 1.378 4.9l-1.01 3.687 3.756-.986zm11.597-6.812c-.278-.139-1.643-.809-1.897-.901-.253-.093-.438-.139-.623.139-.184.278-.716.901-.877 1.086-.162.186-.324.208-.602.069-.278-.139-1.173-.432-2.235-1.378-.826-.736-1.383-1.644-1.545-1.922-.162-.278-.017-.428.122-.566.124-.124.278-.324.417-.486.139-.162.186-.278.278-.463.093-.185.046-.347-.023-.486-.069-.139-.623-1.503-.853-2.057-.224-.541-.448-.467-.622-.476-.16-.008-.344-.01-.527-.01-.184 0-.486.069-.74.347-.253.278-.971.949-.971 2.315 0 1.366.995 2.685 1.134 2.87.139.185 1.957 2.99 4.743 4.195.662.287 1.18.459 1.583.587.666.21 1.272.18 1.751.109.534-.08 1.643-.671 1.874-1.319.231-.648.231-1.203.162-1.319-.069-.117-.253-.186-.531-.326z"/>
    </svg>
  );
}

const CSS = `
  .help-page-container {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 28px;
    align-items: start;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  .help-channels-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }
  @media (max-width: 1024px) {
    .help-page-container { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .help-channels-grid { grid-template-columns: 1fr; }
  }
`;

export default function SeekerHelp() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  useEffect(() => { getPricingConfig().then(setPricing).catch(() => {}); }, []);
  const f = feePercents(pricing);

  const FAQS = [
    { q: t("seeker_help.faq1_q") || "How do I get paid?",                a: t("seeker_help.faq1_a") || "Your earnings are held in escrow when a job starts and are released directly to your wallet as soon as the employer marks the job complete. You can transfer wallet funds to your MTN MoMo or Airtel Money account anytime." },
    { q: t("seeker_help.faq2_q") || "What is the platform fee?",          a: `A ${f.worker}% commission is deducted from worker earnings to run the service, verify users and process payments - so you keep ${f.workerKeeps}% of the job amount. The exact figure is always shown before you accept a job.` },
    { q: t("seeker_help.faq3_q") || "How do I get jobs?",                 a: t("seeker_help.faq3_a") || "Make sure your profile details, specialties, education, and district are complete. Employers can find you in 'Browse Workers' or you can apply to open jobs listed in the marketplace." },
    { q: t("seeker_help.faq4_q") || "How do I verify completion?",        a: t("seeker_help.faq4_a") || "Once you finish the job, ask the employer to scan your worker badge or mark the job complete from their dashboard to release your payout." },
    { q: t("seeker_help.faq5_q") || "What happens if there is a dispute?", a: t("seeker_help.faq5_a") || "If an employer refuses to release payment or opens a dispute, our support team reviews the case within 2 hours. We will contact both parties to resolve the issue based on work evidence." },
  ];

  const CHANNELS = [
    { icon:WhatsAppIcon, label: t("owner_help.live_chat") || "Live Chat",     sub: t("owner_help.live_chat_sub") || "Usually replies in 5 min",  color:"#25d366", href: "https://wa.me/250781121117" },
    { icon:Mail,          label: t("owner_help.email_support") || "Email Support", sub:"info@mpahmapu.com",          color:"#f97316", href: "mailto:info@mpahmapu.com" },
    { icon:Phone,         label: t("owner_help.call_us") || "Call Us",       sub:"+250 781 121 117",           color:"#22c55e", href: "tel:+250781121117" },
    { icon:FileText,      label: t("owner_help.user_guide") || "Help Center",    sub: t("owner_guide.user_guide_sub") || "Browse all articles",         color:"#a78bfa", href: "/help" },
  ];

  return (
    <div className="help-page-container">
      <style>{CSS}</style>

      {/* Left Column: Support info & FAQs */}
      <div>
        <div className="help-channels-grid">
          {CHANNELS.map(({ icon:Icon, label, sub, color, href }) => (
            <div
              key={label}
              className="dash-card"
              onClick={() => window.open(href, href.startsWith("http") ? "_blank" : "_self")}
              style={{
                background:"#131313", border:"1px solid #1c1c1c", borderRadius:14,
                padding:"18px 18px", cursor:"pointer", transition:"all 0.12s",
              }}
            >
              <div style={{
                width:40, height:40, borderRadius:10,
                background:`${color}18`,
                display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12,
              }}>
                <Icon size={20} color={color} />
              </div>
              <p style={{ margin:"0 0 3px", fontWeight:700, fontSize:13, color:"#d0d0d0" }}>{label}</p>
              <p style={{ margin:0, fontSize:11, color:"#707070" }}>{sub}</p>
            </div>
          ))}
        </div>

        <SectionHead title={t("seeker_help.faq_title") || "Frequently Asked Questions"} />

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:12, overflow:"hidden" }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"14px 18px", background:"none", border:"none",
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                }}
              >
                <span style={{ fontSize:13, fontWeight:600, color:"#d0d0d0" }}>{faq.q}</span>
                <ChevronRight
                  size={14} color="#333"
                  style={{ transform: open === i ? "rotate(90deg)" : "none", transition:"transform 0.15s", flexShrink:0, marginLeft:12 }}
                />
              </button>
              {open === i && (
                <div style={{ padding:"0 18px 14px", fontSize:13, color:"#9a9a9a", lineHeight:1.75 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: BazaBot assistant */}
      <BazaBotChat role="seeker" style={{ height: 520 }} />
    </div>
  );
}
