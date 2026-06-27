"use client";

import { useState } from "react";
import { MessageSquare, Mail, Phone, FileText, ChevronRight } from "lucide-react";
import { SectionHead } from "@/components/dashboard/ui";

const FAQS = [
  { q:"How does escrow work?",              a:"Your payment is locked in escrow as soon as you confirm a booking. It is only released to the worker after you mark the job complete. You have 24 hours post-completion to raise a dispute." },
  { q:"How do I raise a dispute?",          a:"Go to the relevant completed job and click \"Raise Dispute\". Our team reviews all disputes within 2 business hours and will contact both parties." },
  { q:"Can I cancel a booking?",            a:"Yes. Free cancellation is available up to 2 hours before the scheduled start time. Late cancellations may incur a 10% fee to compensate the worker." },
  { q:"How are workers verified?",          a:"All workers on MpahMapu go through ID verification and reference checks before being listed on the platform. Verified badges indicate completed checks." },
  { q:"What payment methods are supported?",a:"We currently support MTN MoMo and Airtel Money. Bank transfers are coming soon." },
];

const CHANNELS = [
  { icon:MessageSquare, label:"Live Chat",     sub:"Usually replies in 5 min",  color:"#60a5fa" },
  { icon:Mail,          label:"Email Support", sub:"support@MpahMapu.rw",        color:"#f97316" },
  { icon:Phone,         label:"Call Us",       sub:"+250 788 000 100",           color:"#22c55e" },
  { icon:FileText,      label:"User Guide",    sub:"Read the full docs",         color:"#a78bfa" },
];

export default function OwnerHelp() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ maxWidth:580 }}>
      {/* Support channels */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:28 }}>
        {CHANNELS.map(({ icon:Icon, label, sub, color }) => (
          <div key={label} className="dash-card" style={{
            background:"#131313", border:"1px solid #1c1c1c", borderRadius:14,
            padding:"18px 18px", cursor:"pointer", transition:"all 0.12s",
          }}>
            <div style={{
              width:40, height:40, borderRadius:10,
              background:`${color}18`,
              display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12,
            }}>
              <Icon size={18} color={color} />
            </div>
            <p style={{ margin:"0 0 3px", fontWeight:700, fontSize:13, color:"#d0d0d0" }}>{label}</p>
            <p style={{ margin:0, fontSize:11, color:"#3a3a3a" }}>{sub}</p>
          </div>
        ))}
      </div>

      <SectionHead title="Frequently Asked Questions" />

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
              <div style={{ padding:"0 18px 14px", fontSize:13, color:"#4a4a4a", lineHeight:1.75 }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
