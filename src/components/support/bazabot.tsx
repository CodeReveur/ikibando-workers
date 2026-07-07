"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, User as UserIcon, Send, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import {
  submitContact, getContactThread, sendContactTyping,
  getContactTypingStatus, getContactStatus,
} from "@/lib/api";

type Sender = "user" | "bot" | "agent";
interface Msg { sender: Sender; text: string }

export type BazaBotRole = "owner" | "seeker" | "public";

/** Stable identity for the chat. Logged-in users use their account; visitors get a
 *  generated "avatar user" persisted in localStorage so their thread survives reloads. */
interface Identity { name: string; email: string; guest: boolean }

function resolveIdentity(): Identity {
  if (typeof window === "undefined") return { name: "Guest", email: "", guest: true };
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    if (u && u.email) return { name: u.name || "You", email: u.email, guest: false };
  } catch {}
  // Anonymous visitor — create/restore an avatar identity.
  try {
    const saved = localStorage.getItem("bazabot_identity");
    if (saved) {
      const p = JSON.parse(saved);
      if (p?.email) return { name: p.name, email: p.email, guest: true };
    }
  } catch {}
  const n = Math.floor(1000 + Math.random() * 9000);
  const rand = Math.random().toString(36).slice(2, 10);
  const identity: Identity = { name: `Guest ${n}`, email: `guest-${rand}@guest.mpahmapu.com`, guest: true };
  try { localStorage.setItem("bazabot_identity", JSON.stringify(identity)); } catch {}
  return identity;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarColor(seed: string): string {
  const colors = ["#f97316", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/** Role-independent keyword → BazaBot topic resolver. Returns a topic or "fallback". */
function resolveTopic(cleaned: string): string {
  const has = (...ks: string[]) => ks.some(k => cleaned.includes(k));
  if (has("hello", "hi ", "hey", "jambo", "habari", "muraho", "bite", "bonjour", "salut") || cleaned === "hi") return "greetings";
  if (has("how are you", "how's it going", "how do you feel", "are you okay", "comment ça va", "ça va", "amakuru", "mambo", "happy", "fine")) return "feeling";
  if (has("quote", "motivation", "inspire", "wisdom", "citation", "umugani", "methali")) return "quotes";
  if (has("escrow", "deposit", "depot", "dépôt", "amafaranga", "malipo", "payout", "faranga", "get paid", "how do i pay")) return "escrow";
  if (has("fee", "percent", "commission", "deduction", "cut", "frais", "ada")) return "fee";
  if (has("cancel", "refund", "remboursement", "annuler", "ghairi", "guhagarika")) return "refund";
  if (has("verify", "verified", "verification", "id ", "national id", "vérifier", "abakozi", "badge", "check")) return "verify";
  if (has("complete", "completion", "qr", "kugenzura", "confirm job")) return "complete";
  if (has("dispute", "problem", "issue", "litige", "mzozo", "impaka", "complain")) return "dispute";
  if (has("job", "jobs", "hire", "hired", "work", "akazi", "kazi", "emploi", "career", "employ")) return "job";
  if (has("money", "earn", "income", "business", "company", "boss")) return "business";
  return "fallback";
}

function generateResponse(topic: string, t: (k: string, v?: Record<string, string | number>) => string, userName: string): string {
  if (topic === "greetings" || topic === "feeling" || topic === "quotes" || topic === "business") {
    return t(`bazabot.${topic}`) || "I'm here to help — ask me anything about the platform.";
  }
  if (topic === "fallback") {
    const overview = t("bazabot.fallback.overview") || "Your query needs our support team. BazaBot has logged this conversation and created a priority ticket for you.";
    const process = t("bazabot.fallback.process") || "A live agent will reply directly here in real time.";
    const guidelines = t("bazabot.fallback.guidelines") || "We typically reply within 5 minutes. Please keep this tab open.";
    return `${overview}\n\n${process}\n\n${guidelines}`;
  }
  const starterKeys = ["starter1", "starter2", "starter3", "starter4", "starter5"];
  const starter = t(`bazabot.${starterKeys[Math.floor(Math.random() * starterKeys.length)]}`) || "Regarding your query,";
  const vars = { name: userName, time: new Date().toLocaleTimeString(), fee: topic === "fee" ? "25%" : "5%" };
  const overview = t(`bazabot.${topic}.overview`, vars) || "";
  const process = t(`bazabot.${topic}.process`, vars) || "";
  const guidelines = t(`bazabot.${topic}.guidelines`, vars) || "";
  return `${starter}\n\n${overview}\n\n${process}\n\n${guidelines}`.trim();
}

function chipsFor(role: BazaBotRole, t: (k: string) => string): { label: string; query: string }[] {
  if (role === "seeker") return [
    { label: t("seeker_help.faq1_q") || "How do I get paid?", query: t("seeker_help.faq1_q") || "How do I get paid?" },
    { label: t("seeker_help.faq2_q") || "What is the platform fee?", query: t("seeker_help.faq2_q") || "What is the platform fee?" },
    { label: t("seeker_help.faq3_q") || "How do I get jobs?", query: t("seeker_help.faq3_q") || "How do I get jobs?" },
  ];
  if (role === "owner") return [
    { label: t("owner_help.chip_escrow") || "How does escrow work?", query: t("owner_help.chip_escrow") || "How does escrow work?" },
    { label: t("owner_help.chip_refund") || "How do I request a refund?", query: t("owner_help.chip_refund") || "How do I request a refund?" },
    { label: t("owner_help.chip_verify") || "Are workers verified?", query: t("owner_help.chip_verify") || "Are workers verified?" },
  ];
  return [
    { label: "How does escrow work?", query: "How does escrow work?" },
    { label: "How do I get hired?", query: "How do I get hired?" },
    { label: "Are workers verified?", query: "Are workers verified?" },
  ];
}

const CSS = `
  .bb-card { background:#121212; border:1px solid #232323; border-radius:18px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 34px rgba(0,0,0,0.38); }
  .bb-head { display:flex; align-items:center; gap:8px; padding:14px 16px; border-bottom:1px solid #1c1c1c; background:#0d0d0d; }
  .bb-msgs { flex:1; overflow-y:auto; padding:18px 16px; display:flex; flex-direction:column; gap:14px; scroll-behavior:smooth; }
  .bb-msgs::-webkit-scrollbar { width:6px; }
  .bb-msgs::-webkit-scrollbar-thumb { background:#2b2b2b; border-radius:99px; }
  .bb-row { display:flex; gap:8px; align-items:flex-end; }
  .bb-row.user { justify-content:flex-end; }
  .bb-row.bot, .bb-row.agent { justify-content:flex-start; }
  .bb-avatar { width:26px; height:26px; border-radius:99px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; color:#fff; }
  .bb-bubble { max-width:76%; padding:10px 14px; border-radius:14px; font-size:12.5px; line-height:1.55; white-space:pre-line; word-break:break-word; box-shadow:0 1px 2px rgba(0,0,0,0.22); }
  .bb-bot { background:#1e1e1e; color:#e6e6e6; border:1px solid #2b2b2b; border-bottom-left-radius:4px; }
  .bb-agent { background:#15803d; color:#fff; border:1px solid #1a9c4b; border-bottom-left-radius:4px; }
  .bb-user { background:linear-gradient(135deg,#fb8c3c,#f97316); color:#fff; border-bottom-right-radius:4px; }
  .bb-input-area { padding:12px; border-top:1px solid #232323; display:flex; gap:8px; background:#0e0e0e; }
  .bb-input { flex:1; background:#181818; border:1px solid #2a2a2a; border-radius:10px; padding:10px 14px; font-size:12.5px; color:#fff; font-family:inherit; outline:none; transition:border-color .15s; }
  .bb-input:focus { border-color:#f97316; }
  .bb-input::placeholder { color:#5a5a5a; }
  .bb-send { background:#f97316; color:#fff; border:none; border-radius:10px; width:42px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .12s; flex-shrink:0; }
  .bb-send:hover { background:#ea580c; }
  .bb-chips { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 12px; }
  .bb-chip { background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.22); border-radius:99px; padding:6px 12px; font-size:11px; color:#fb923c; cursor:pointer; transition:all .12s; }
  .bb-chip:hover { background:rgba(249,115,22,0.16); border-color:rgba(249,115,22,0.4); }
  .bb-typing { display:inline-flex; gap:4px; align-items:center; padding:3px 2px; }
  .bb-typing span { width:6px; height:6px; border-radius:99px; background:#fff; opacity:0.5; animation:bb-bounce 1.2s infinite ease-in-out; }
  .bb-typing span:nth-child(2){ animation-delay:.2s; } .bb-typing span:nth-child(3){ animation-delay:.4s; }
  @keyframes bb-bounce { 0%,60%,100%{ transform:translateY(0); opacity:.4; } 30%{ transform:translateY(-4px); opacity:1; } }
  .bb-dot { width:7px; height:7px; border-radius:99px; display:inline-block; animation:bb-pulse 1.8s infinite; }
  @keyframes bb-pulse { 0%{ box-shadow:0 0 0 0 rgba(34,197,94,.5);} 70%{ box-shadow:0 0 0 6px rgba(34,197,94,0);} 100%{ box-shadow:0 0 0 0 rgba(34,197,94,0);} }
`;

export function BazaBotChat({ role = "public", onClose, style }: {
  role?: BazaBotRole;
  onClose?: () => void;
  style?: React.CSSProperties;
}) {
  const { t, language } = useLanguage();
  const [identity] = useState<Identity>(() => resolveIdentity());
  const userName = identity.name;
  const userEmail = identity.email;

  const welcome = () => t("bazabot.welcome", { userName }) || `Hello ${userName}! I am BazaBot, your support assistant. How can I help you today?`;
  const [messages, setMessages] = useState<Msg[]>([{ sender: "bot", text: welcome() }]);
  const [inputText, setInputText] = useState("");
  const [agentTyping, setAgentTyping] = useState(false);
  const [escalated, setEscalated] = useState(false);

  const isInitialLoad = useRef(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wasEscalated = useRef(false);

  // Keep the welcome message in sync with the active language.
  useEffect(() => {
    setMessages(prev => (prev.length && prev[0].sender === "bot"
      ? [{ ...prev[0], text: welcome() }, ...prev.slice(1)]
      : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, userName]);

  // Pin to the latest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, agentTyping]);

  // Poll the thread, typing state and conversation status.
  useEffect(() => {
    if (!userEmail) return;
    let mounted = true;

    const poll = async () => {
      try {
        const thread = await getContactThread(userEmail);
        if (!mounted) return;
        if (thread && thread.length > 0) {
          if (isInitialLoad.current) {
            const mapped = thread.map((m: any) => ({
              sender: (m.direction === "OUTBOUND" ? "agent" : "user") as Sender,
              text: m.body,
            }));
            setMessages([{ sender: "bot", text: welcome() }, ...mapped]);
            isInitialLoad.current = false;
          } else {
            const agentReplies = thread.filter((m: any) => m.direction === "OUTBOUND");
            setMessages(prev => {
              const current = prev.filter(m => m.sender === "agent").length;
              if (agentReplies.length > current) {
                const extra = agentReplies.slice(current).map((m: any) => ({ sender: "agent" as Sender, text: m.body }));
                return [...prev, ...extra];
              }
              return prev;
            });
          }
        } else {
          isInitialLoad.current = false;
        }

        const [typing, status] = await Promise.all([
          getContactTypingStatus(userEmail).catch(() => ({ agentTyping: false } as any)),
          getContactStatus(userEmail).catch(() => ({ escalated: false } as any)),
        ]);
        if (!mounted) return;
        setAgentTyping(!!typing?.agentTyping);

        const nowEsc = !!status?.escalated;
        setEscalated(nowEsc);
        // Agent just closed the chat → BazaBot resumes.
        if (wasEscalated.current && !nowEsc) {
          setMessages(prev => [...prev, {
            sender: "bot",
            text: t("bazabot.resumed") || "This conversation has been closed. I'm here again to help — feel free to ask me anything! 🤖",
          }]);
        }
        wasEscalated.current = nowEsc;
      } catch { /* transient */ }
    };

    poll();
    const id = setInterval(poll, 2500);
    return () => { mounted = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const notifyTyping = () => {
    if (!userEmail) return;
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

  const forwardToAgent = (text: string) => {
    submitContact({
      name: userName,
      email: userEmail,
      subject: `BazaBot chat from ${userName}`,
      message: text,
    }).catch(() => {});
  };

  const handleSend = (text: string) => {
    const msg = text.trim();
    if (!msg || !userEmail) return;

    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    sendContactTyping(userEmail, "USER", false).catch(() => {});

    setMessages(prev => [...prev, { sender: "user", text: msg }]);
    setInputText("");

    // While a human agent owns the conversation the bot stays silent and only
    // forwards the visitor's messages until the agent closes the chat.
    if (escalated) {
      forwardToAgent(msg);
      return;
    }

    setTimeout(() => {
      const topic = resolveTopic(msg.toLowerCase());
      const reply = generateResponse(topic, t, userName);
      setMessages(prev => [...prev, { sender: "bot", text: reply }]);
      if (topic === "fallback") {
        forwardToAgent(msg);          // server marks the conversation ESCALATED
        setEscalated(true);           // optimistic: silence the bot immediately
        wasEscalated.current = true;
      }
    }, 400);
  };

  const guestColor = avatarColor(userEmail || userName);

  return (
    <div className="bb-card" style={style}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="bb-head">
        <div style={{ width: 30, height: 30, borderRadius: 99, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot size={16} color="#f97316" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>BazaBot</p>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, color: escalated ? "#f97316" : "#22c55e" }}>
            <span className="bb-dot" style={{ background: escalated ? "#f97316" : "#22c55e" }} />
            {escalated ? (t("bazabot.status_agent") || "Connected to a support agent") : (t("bazabot.status_online") || "Online")}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close chat" style={{ marginLeft: "auto", background: "#181818", border: "1px solid #2a2a2a", borderRadius: 99, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#999" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="bb-msgs">
        {messages.map((m, i) => {
          const isUser = m.sender === "user";
          return (
            <div key={i} className={`bb-row ${m.sender}`}>
              {!isUser && (
                <div className="bb-avatar" style={{ background: m.sender === "agent" ? "#15803d" : "rgba(249,115,22,0.12)" }}>
                  <Bot size={13} color={m.sender === "agent" ? "#fff" : "#f97316"} />
                </div>
              )}
              <div className={`bb-bubble bb-${m.sender}`}>{m.text}</div>
              {isUser && (
                <div className="bb-avatar" style={{ background: guestColor }} title={userName}>
                  {identity.guest ? initials(userName) : <UserIcon size={13} color="#fff" />}
                </div>
              )}
            </div>
          );
        })}
        {agentTyping && (
          <div className="bb-row agent">
            <div className="bb-avatar" style={{ background: "#15803d" }}><Bot size={13} color="#fff" /></div>
            <div className="bb-bubble bb-agent"><span className="bb-typing"><span /><span /><span /></span></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestion chips — hidden while an agent is handling the chat */}
      {!escalated && (
        <div className="bb-chips">
          {chipsFor(role, t).map(c => (
            <button key={c.label} className="bb-chip" onClick={() => handleSend(c.query)}>{c.label}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="bb-input-area">
        <input
          className="bb-input"
          placeholder={escalated ? (t("bazabot.placeholder_agent") || "Message the support agent…") : (t("owner_help.input_placeholder") || "Ask a question…")}
          value={inputText}
          onChange={e => { setInputText(e.target.value); notifyTyping(); }}
          onKeyDown={e => e.key === "Enter" && handleSend(inputText)}
        />
        <button className="bb-send" onClick={() => handleSend(inputText)} aria-label="Send">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
