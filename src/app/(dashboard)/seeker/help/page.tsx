"use client";

import { useState, useEffect, useRef } from "react";
import { Mail, Phone, FileText, ChevronRight, Send, Bot, User as UserIcon, ShieldAlert } from "lucide-react";
import { SectionHead } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";
import { useSession } from "@/components/dashboard/session-ctx";
import { submitContact, getContactThread, sendContactTyping, getContactTypingStatus } from "@/lib/api";

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
    white-space: pre-line;
  }
  .msg-bot {
    background: #1a1a1a;
    color: #d0d0d0;
    align-self: flex-start;
    border-bottom-left-radius: 2px;
    border: 1px solid #222;
  }
  .msg-agent {
    background: #15803d;
    color: #fff;
    align-self: flex-start;
    border-bottom-left-radius: 2px;
    border: 1px solid #166534;
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

export default function SeekerHelp() {
  const { t, language } = useLanguage();
  const session = useSession();
  const userName = session?.name || "User";
  const userEmail = session?.email || "info@mpahmapu.com";
  const [open, setOpen] = useState<number | null>(null);

  const welcomeMsg = {
    sender: "bot" as const,
    text: t("bazabot.welcome", { userName }) || `Hello ${userName}! I am BazaBot, your MpahMapu support assistant. How can I help you today?`
  };

  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot" | "agent"; text: string }>>([
    welcomeMsg
  ]);

  const [inputText, setInputText] = useState("");
  const [agentTyping, setAgentTyping] = useState(false);
  
  const isInitialLoad = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamically update welcome message language when locale changes
  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].sender === "bot") {
        const copy = [...prev];
        copy[0] = {
          ...copy[0],
          text: t("bazabot.welcome", { userName }) || `Hello ${userName}! I am BazaBot, your MpahMapu support assistant. How can I help you today?`
        };
        return copy;
      }
      return prev;
    });
  }, [language, userName, t]);

  // Polling thread and typing status from backend
  useEffect(() => {
    let isMounted = true;

    const pollData = async () => {
      try {
        const thread = await getContactThread(userEmail);
        if (!isMounted) return;

        if (thread && thread.length > 0) {
          if (isInitialLoad.current) {
            // Load full thread history
            const mappedThread = thread.map((m: any) => ({
              sender: m.direction === "OUTBOUND" ? ("agent" as const) : ("user" as const),
              text: m.body
            }));
            setMessages([
              {
                sender: "bot",
                text: t("bazabot.welcome", { userName }) || `Hello ${userName}! I am BazaBot, your MpahMapu support assistant. How can I help you today?`
              },
              ...mappedThread
            ]);
            isInitialLoad.current = false;
          } else {
            // Poll for new agent replies only
            const agentReplies = thread.filter((m: any) => m.direction === "OUTBOUND");
            setMessages(prev => {
              const currentAgentReplies = prev.filter(m => m.sender === "agent");
              if (agentReplies.length > currentAgentReplies.length) {
                const newReplies = agentReplies.slice(currentAgentReplies.length);
                const newMsgs = newReplies.map((m: any) => ({
                  sender: "agent" as const,
                  text: m.body
                }));
                return [...prev, ...newMsgs];
              }
              return prev;
            });
          }
        } else {
          isInitialLoad.current = false;
        }

        // Fetch typing status
        const status = await getContactTypingStatus(userEmail);
        if (!isMounted) return;
        setAgentTyping(status?.agentTyping || false);

      } catch (err) {
        console.error("error polling bazabot thread", err);
      }
    };

    pollData();
    const interval = setInterval(pollData, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userEmail, userName, t]);

  const FAQS = [
    { q: t("seeker_help.faq1_q") || "How do I get paid?",                a: t("seeker_help.faq1_a") || "Your earnings are held in escrow when a job starts and are released directly to your wallet as soon as the employer marks the job complete. You can transfer wallet funds to your MTN MoMo or Airtel Money account anytime." },
    { q: t("seeker_help.faq2_q") || "What is the platform fee?",          a: t("seeker_help.faq2_a") || "We deduct a 25% platform fee from worker earnings to maintain the service, verify users, and process MTN MoMo transactions." },
    { q: t("seeker_help.faq3_q") || "How do I get jobs?",                 a: t("seeker_help.faq3_a") || "Make sure your profile details, specialties, education, and district are complete. Employers can find you in 'Browse Workers' or you can apply to open jobs listed in the marketplace." },
    { q: t("seeker_help.faq4_q") || "How do I verify completion?",        a: t("seeker_help.faq4_a") || "Once you finish the job, ask the employer to scan your worker badge or mark the job complete from their dashboard to release your payout." },
    { q: t("seeker_help.faq5_q") || "What happens if there is a dispute?", a: t("seeker_help.faq5_a") || "If an employer refuses to release payment or opens a dispute, our support team reviews the case within 2 hours. We will contact both parties to resolve the issue based on work evidence." },
  ];

  const CHANNELS = [
    { icon:WhatsAppIcon, label: t("owner_help.live_chat") || "Live Chat",     sub: t("owner_help.live_chat_sub") || "Usually replies in 5 min",  color:"#25d366", href: "https://wa.me/250781121117" },
    { icon:Mail,          label: t("owner_help.email_support") || "Email Support", sub:"info@mpahmapu.com",          color:"#f97316", href: "mailto:info@mpahmapu.com" },
    { icon:Phone,         label: t("owner_help.call_us") || "Call Us",       sub:"+250 781 121 117",           color:"#22c55e", href: "tel:+250781121117" },
    { icon:FileText,      label: t("owner_help.user_guide") || "User Guide",    sub: t("owner_guide.user_guide_sub") || "Read the full docs",         color:"#a78bfa", href: "/about" },
  ];

  const handleUserTyping = () => {
    if (typingTimeoutRef.current === null) {
      sendContactTyping(userEmail, "USER", true).catch(() => {});
    } else {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendContactTyping(userEmail, "USER", false).catch(() => {});
      typingTimeoutRef.current = null;
    }, 3000);
  };

  // AI Sentence Generator
  const generateResponse = (topic: string) => {
    if (topic === "greetings" || topic === "feeling" || topic === "quotes" || topic === "business") {
      return t(`bazabot.${topic}`) || "";
    }
    if (topic === "fallback") {
      const fbOverview = t("bazabot.fallback.overview") || "Your query requires personal support team intervention. BazaBot has logged your current conversation history and account details to create a priority support ticket in our customer relations management backend.";
      const fbProcess = t("bazabot.fallback.process") || "Your ticket will be routed to a live agent. They will reply directly to your query and you will see the updates here in real-time.";
      const fbGuidelines = t("bazabot.fallback.guidelines") || "We typically reply in 5 minutes. Please keep this tab open to chat with the agent.";
      return `${fbOverview}\n\n${fbProcess}\n\n${fbGuidelines}`;
    }

    const starterKeys = ["starter1", "starter2", "starter3", "starter4", "starter5"];
    const randomKey = starterKeys[Math.floor(Math.random() * starterKeys.length)];
    const randomStarter = t(`bazabot.${randomKey}`) || "Regarding your query, ";
    
    const timeStr = new Date().toLocaleTimeString();
    const feePercent = topic === "fee" ? "25%" : "5%";
    const vars = { name: userName, time: timeStr, fee: feePercent };

    const overview = t(`bazabot.${topic}.overview`, vars) || "";
    const process = t(`bazabot.${topic}.process`, vars) || "";
    const guidelines = t(`bazabot.${topic}.guidelines`, vars) || "";
    
    return `${randomStarter}\n\n${overview}\n\n${process}\n\n${guidelines}`;
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMsg = text.trim();

    // Clear typing timeout and set user isTyping to false immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendContactTyping(userEmail, "USER", false).catch(() => {});

    setMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setInputText("");

    setTimeout(() => {
      let botResponse = "";
      const cleaned = userMsg.toLowerCase();

      // Multilingual keywords checks
      const isGreetings = cleaned.includes("hello") || cleaned.includes("hi") || cleaned.includes("hey") || cleaned.includes("jambo") || cleaned.includes("habari") || cleaned.includes("muraho") || cleaned.includes("bite") || cleaned.includes("bonjour") || cleaned.includes("salut");

      const isFeeling = cleaned.includes("how are you") || cleaned.includes("how's it going") || cleaned.includes("how do you feel") || cleaned.includes("are you okay") || cleaned.includes("comment ça va") || cleaned.includes("ça va") || cleaned.includes("bite se") || cleaned.includes("amakuru") || cleaned.includes("habari yako") || cleaned.includes("mambo") || cleaned.includes("happy") || cleaned.includes("sad") || cleaned.includes("angry") || cleaned.includes("fine") || cleaned.includes("good");

      const isQuotes = cleaned.includes("quote") || cleaned.includes("motivation") || cleaned.includes("inspire") || cleaned.includes("inspiration") || cleaned.includes("wisdom") || cleaned.includes("citation") || cleaned.includes("umugani") || cleaned.includes("methali");

      const isBusiness = cleaned.includes("business") || cleaned.includes("work") || cleaned.includes("job") || cleaned.includes("earn") || cleaned.includes("income") || cleaned.includes("company") || cleaned.includes("career") || cleaned.includes("money") || cleaned.includes("employer") || cleaned.includes("employee") || cleaned.includes("boss");

      const isEscrow = cleaned.includes("escrow") || cleaned.includes("deposit") || cleaned.includes("pay") || cleaned.includes("money") || cleaned.includes("amafaranga") || cleaned.includes("payout") || cleaned.includes("earnings") || cleaned.includes("malipo") || cleaned.includes("faranga") ||
        userMsg === t("seeker_help.faq1_q");

      const isFee = cleaned.includes("fee") || cleaned.includes("percent") || cleaned.includes("deduction") || cleaned.includes("cut") || cleaned.includes("frais") || cleaned.includes("ada") ||
        userMsg === t("seeker_help.faq2_q");

      const isJob = cleaned.includes("job") || cleaned.includes("jobs") || cleaned.includes("hired") || cleaned.includes("work") || cleaned.includes("akazi") || cleaned.includes("kazi") || cleaned.includes("emploi") ||
        userMsg === t("seeker_help.faq3_q");

      const isComplete = cleaned.includes("complete") || cleaned.includes("completion") || cleaned.includes("verify") || cleaned.includes("badge") || cleaned.includes("qr") || cleaned.includes("kugenzura") ||
        userMsg === t("seeker_help.faq4_q");

      const isDispute = cleaned.includes("dispute") || cleaned.includes("problem") || cleaned.includes("support") || cleaned.includes("litige") || cleaned.includes("mzozo") || cleaned.includes("impaka") ||
        userMsg === t("seeker_help.faq5_q");

      if (isGreetings) {
        botResponse = generateResponse("greetings");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isFeeling) {
        botResponse = generateResponse("feeling");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isQuotes) {
        botResponse = generateResponse("quotes");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isBusiness) {
        botResponse = generateResponse("business");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isEscrow) {
        botResponse = generateResponse("escrow");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isFee) {
        botResponse = generateResponse("fee");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isJob) {
        botResponse = generateResponse("job");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isComplete) {
        botResponse = generateResponse("complete");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else if (isDispute) {
        botResponse = generateResponse("dispute");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
      } else {
        // Fallback case: notify contact backend and set unresolved state
        botResponse = generateResponse("fallback");
        setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
        
        // Notify admin via contact backend
        submitContact({
          name: userName,
          email: userEmail,
          subject: `BazaBot Unresolved Question from ${userName}`,
          message: userMsg
        }).catch(() => {});
      }
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
                <Icon size={20} color={color} />
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
            <p style={{ margin:0, fontSize:12, fontWeight:700, color:"#fff" }}>BazaBot</p>
            <p style={{ margin:0, fontSize:10, color:"#22c55e", fontWeight:600 }}>● Online</p>
          </div>
          <a 
            href="https://wa.me/250781121117" 
            target="_blank" 
            style={{ 
              marginLeft: "auto", 
              display: "flex", 
              alignItems: "center", 
              gap: 6, 
              background: "rgba(37,211,102,0.1)", 
              border: "1px solid rgba(37,211,102,0.2)", 
              borderRadius: 8, 
              padding: "5px 10px", 
              fontSize: 10, 
              color: "#25d366", 
              textDecoration: "none", 
              fontWeight: 700 
            }}
          >
            <WhatsAppIcon size={12} color="#25d366" />
            WhatsApp Call
          </a>
        </div>

        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} style={{ display:"flex", gap:8, flexDirection: m.sender === "user" ? "row" : "row-reverse", alignItems:"flex-end" }}>
              <div style={{
                width:20, height:20, borderRadius:99,
                background: m.sender === "user" ? "#f97316" : (m.sender === "agent" ? "#15803d" : "rgba(249,115,22,0.08)"),
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
              }}>
                {m.sender === "user" ? <UserIcon size={10} color="#fff" /> : <Bot size={10} color={m.sender === "agent" ? "#fff" : "#f97316"} />}
              </div>
              <div className={`msg-bubble msg-${m.sender}`}>
                {m.text}
              </div>
            </div>
          ))}
          {agentTyping && (
            <div style={{ display:"flex", gap:8, flexDirection: "row-reverse", alignItems:"flex-end" }}>
              <div style={{
                width:20, height:20, borderRadius:99,
                background: "#15803d",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
              }}>
                <Bot size={10} color="#fff" />
              </div>
              <div className="msg-bubble msg-agent" style={{ fontStyle: "italic", opacity: 0.8 }}>
                Typing...
              </div>
            </div>
          )}
        </div>

        <div className="suggestion-chips">
          <button className="chip" onClick={() => handleSend(t("seeker_help.faq1_q") || "How do I get paid?")}>
            {t("seeker_help.faq1_q") || "How do I get paid?"}
          </button>
          <button className="chip" onClick={() => handleSend(t("seeker_help.faq2_q") || "What is the platform fee?")}>
            {t("seeker_help.faq2_q") || "What is the platform fee?"}
          </button>
          <button className="chip" onClick={() => handleSend(t("seeker_help.faq4_q") || "How do I verify completion?")}>
            {t("seeker_help.faq4_q") || "How do I verify completion?"}
          </button>
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            placeholder={t("owner_help.input_placeholder") || "Ask a question..."}
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              handleUserTyping();
            }}
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
