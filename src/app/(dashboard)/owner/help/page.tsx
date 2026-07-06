"use client";

import { useState } from "react";
import { MessageSquare, Mail, Phone, FileText, ChevronRight, Send, Bot, User as UserIcon } from "lucide-react";
import { SectionHead } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";
import { useSession } from "@/components/dashboard/session-ctx";

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
  .chat-bot-container {
    background: #131313;
    border: 1px solid #1c1c1c;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    height: 480px;
    overflow: hidden;
  }
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .msg-bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.5;
  }
  .msg-bot {
    background: #1a1a1a;
    color: #d0d0d0;
    align-self: flex-start;
    border-bottom-left-radius: 2px;
    border: 1px solid #222;
  }
  .msg-user {
    background: #f97316;
    color: #fff;
    align-self: flex-end;
    border-bottom-right-radius: 2px;
  }
  .chat-input-area {
    padding: 12px;
    border-top: 1px solid #1c1c1c;
    display: flex;
    gap: 8px;
    background: #0d0d0d;
  }
  .chat-input {
    flex: 1;
    background: #141414;
    border: 1px solid #222;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    color: #fff;
    font-family: inherit;
    outline: none;
  }
  .chat-send-btn {
    background: #f97316;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s;
  }
  .chat-send-btn:hover {
    background: #ea580c;
  }
  .suggestion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 12px;
  }
  .chip {
    background: rgba(249,115,22,0.06);
    border: 1px solid rgba(249,115,22,0.15);
    border-radius: 99px;
    padding: 6px 12px;
    font-size: 11px;
    color: #f97316;
    cursor: pointer;
    transition: all 0.12s;
    border-style: solid;
  }
  .chip:hover {
    background: rgba(249,115,22,0.12);
  }
  @media (max-width: 1024px) {
    .help-page-container {
      grid-template-columns: 1fr;
    }
    .chat-bot-container {
      height: 400px;
    }
  }
  @media (max-width: 480px) {
    .help-channels-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default function OwnerHelp() {
  const { t } = useLanguage();
  const session = useSession();
  const userName = session?.name || "User";
  const [open, setOpen] = useState<number | null>(null);

  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: t("owner_help.bot_greeting", { name: userName }) || `Hello ${userName}! I am your MpahMapu support assistant. How can I help you today?` }
  ]);
  const [inputText, setInputText] = useState("");

  const FAQS = [
    { q: t("owner_help.faq1_q") || "How does escrow work?",              a: t("owner_help.faq1_a") || "Your payment is locked in escrow as soon as you confirm a booking. It is only released to the worker after you mark the job complete. You have 24 hours post-completion to raise a dispute." },
    { q: t("owner_help.faq2_q") || "How do I raise a dispute?",          a: t("owner_help.faq2_a") || "Go to the relevant completed job and click \"Raise Dispute\". Our team reviews all disputes within 2 business hours and will contact both parties." },
    { q: t("owner_help.faq3_q") || "Can I cancel a booking?",            a: t("owner_help.faq3_a") || "Yes. Free cancellation is available up to 2 hours before the scheduled start time. Late cancellations may incur a 10% fee to compensate the worker." },
    { q: t("owner_help.faq4_q") || "How are workers verified?",          a: t("owner_help.faq4_a") || "All workers on MpahMapu go through ID verification and reference checks before being listed on the platform. Verified badges indicate completed checks." },
    { q: t("owner_help.faq5_q") || "What payment methods are supported?", a: t("owner_help.faq5_a") || "We currently support MTN MoMo and Airtel Money. Bank transfers are coming soon." },
  ];

  const CHANNELS = [
    { icon:MessageSquare, label: t("owner_help.live_chat") || "Live Chat",     sub: t("owner_help.live_chat_sub") || "Usually replies in 5 min",  color:"#60a5fa", href: "https://wa.me/250788000100" },
    { icon:Mail,          label: t("owner_help.email_support") || "Email Support", sub:"support@MpahMapu.rw",        color:"#f97316", href: "mailto:support@MpahMapu.rw" },
    { icon:Phone,         label: t("owner_help.call_us") || "Call Us",       sub:"+250 788 000 100",           color:"#22c55e", href: "tel:+250788000100" },
    { icon:FileText,      label: t("owner_help.user_guide") || "User Guide",    sub: t("owner_help.user_guide_sub") || "Read the full docs",         color:"#a78bfa", href: "/about" },
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMsg = text.trim();
    setMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setInputText("");

    setTimeout(() => {
      let botResponse = "";
      const cleaned = userMsg.toLowerCase();

      if (cleaned.includes("escrow") || cleaned.includes("deposit") || cleaned.includes("pay") || cleaned.includes("money") || cleaned.includes("amafaranga") || cleaned.includes("malipo")) {
        botResponse = t("owner_help.bot_escrow") || "All payments are held securely in escrow. Funds are only released to the worker after you mark the job complete.";
      } else if (cleaned.includes("cancel") || cleaned.includes("refund") || cleaned.includes("ghairi") || cleaned.includes("guhagarika")) {
        botResponse = t("owner_help.bot_refund") || "You can request a refund on HELD payments. Go to My Payments, click 'Request refund', or cancel open bookings up to 2 hours before start.";
      } else if (cleaned.includes("verify") || cleaned.includes("worker") || cleaned.includes("id") || cleaned.includes("abakozi") || cleaned.includes("verification")) {
        botResponse = t("owner_help.bot_verify") || "All workers are ID-verified and background-checked by the MpahMapu team before they can take jobs.";
      } else {
        botResponse = t("owner_help.bot_fallback") || "Thank you for your query. For detailed personal assistance, please click the Live Chat option above to chat directly with us on WhatsApp!";
      }

      setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
    }, 400);
  };

  return (
    <div className="help-page-container">
      <style>{CSS}</style>

      {/* Left Column: Support info & FAQs */}
      <div>
        {/* Support channels */}
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
                <Icon size={18} color={color} />
              </div>
              <p style={{ margin:"0 0 3px", fontWeight:700, fontSize:13, color:"#d0d0d0" }}>{label}</p>
              <p style={{ margin:0, fontSize:11, color:"#3a3a3a" }}>{sub}</p>
            </div>
          ))}
        </div>

        <SectionHead title={t("owner_help.faq_title") || "Frequently Asked Questions"} />

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

      {/* Right Column: Trained bot chat assistant */}
      <div className="chat-bot-container">
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 16px", borderBottom:"1px solid #1c1c1c", background:"#0d0d0d" }}>
          <div style={{ width:28, height:28, borderRadius:99, background:"rgba(249,115,22,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Bot size={15} color="#f97316" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:12, fontWeight:700, color:"#fff" }}>{t("owner_help.bot_title") || "AI Support Bot"}</p>
            <p style={{ margin:0, fontSize:10, color:"#22c55e", fontWeight:600 }}>● Online</p>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} style={{ display:"flex", gap:8, flexDirection: m.sender === "bot" ? "row" : "row-reverse", alignItems:"flex-end" }}>
              <div style={{
                width:20, height:20, borderRadius:99,
                background: m.sender === "bot" ? "rgba(249,115,22,0.08)" : "#f97316",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
              }}>
                {m.sender === "bot" ? <Bot size={10} color="#f97316" /> : <UserIcon size={10} color="#fff" />}
              </div>
              <div className={`msg-bubble msg-${m.sender}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="suggestion-chips">
          <button className="chip" onClick={() => handleSend(t("owner_help.chip_escrow") || "How does escrow work?")}>
            {t("owner_help.chip_escrow") || "How does escrow work?"}
          </button>
          <button className="chip" onClick={() => handleSend(t("owner_help.chip_refund") || "How do I request a refund?")}>
            {t("owner_help.chip_refund") || "How do I request a refund?"}
          </button>
          <button className="chip" onClick={() => handleSend(t("owner_help.chip_verify") || "Are workers verified?")}>
            {t("owner_help.chip_verify") || "Are workers verified?"}
          </button>
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            placeholder={t("owner_help.input_placeholder") || "Ask a question..."}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend(inputText)}
          />
          <button className="chat-send-btn" onClick={() => handleSend(inputText)}>
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
