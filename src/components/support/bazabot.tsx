"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, User as UserIcon, Send, X, RotateCw, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { AgentAction, Suggestion, ResultCard } from "@/lib/bazabot/types";
import {
  submitContact, getContactThread, sendContactTyping,
  getContactTypingStatus, getContactStatus,
} from "@/lib/api";

type Sender = "user" | "bot" | "agent";
interface Msg {
  sender: Sender;
  text: string;
  /** Concise, user-safe notes on what the assistant did (AI mode). */
  actions?: AgentAction[];
  /** Follow-up chips attached to this bot message. */
  suggestions?: Suggestion[];
  /** True while tokens are still streaming in. */
  streaming?: boolean;
  /** True if the turn errored - shows a Retry affordance. */
  error?: boolean;
  /** Renders the name+email hand-off form inside this bubble. */
  form?: boolean;
  /** Actionable job/worker cards rendered as buttons below the bubble. */
  results?: ResultCard[];
}

// ── Client-side session persistence ─────────────────────────────────────────
// The visitor's chat is kept in localStorage and auto-cleared after 24h. The
// server (admin) keeps the escalated conversation thread indefinitely, so this
// only affects what the visitor sees in their own browser.
const SESSION_KEY = "bazabot_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredSession { createdAt: number; messages: Msg[]; seenAgentIds: string[] }

/** Read a non-expired stored session, or null. Does not mutate storage. */
function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s.createdAt || Date.now() - s.createdAt >= SESSION_TTL_MS) return null; // expired
    return { createdAt: s.createdAt, messages: Array.isArray(s.messages) ? s.messages : [], seenAgentIds: s.seenAgentIds ?? [] };
  } catch { return null; }
}

/**
 * Clear an expired session AND the guest identity, so chats older than 24h don't
 * reload - including the escalated thread the server still keeps for admins.
 * Rotating the guest identity gives a fresh (empty) server thread.
 */
function clearExpiredSession(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as StoredSession;
    if (!s.createdAt || Date.now() - s.createdAt >= SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem("bazabot_identity");
    }
  } catch {}
}

function saveSession(messages: Msg[], seenAgentIds: string[], createdAt: number): void {
  if (typeof window === "undefined") return;
  try {
    // Persist finished messages only (no transient streaming/form state).
    const clean = messages
      .filter(m => !m.streaming)
      .map(({ streaming, form, ...m }) => { void streaming; void form; return m; });
    localStorage.setItem(SESSION_KEY, JSON.stringify({ createdAt, messages: clean, seenAgentIds } satisfies StoredSession));
  } catch {}
}

/** Short live-agent hand-off copy shown when BazaBot escalates. */
const ESCALATION_INTRO = "I'll connect you with a live agent - just add your details:";

export type BazaBotRole = "owner" | "seeker" | "public";

/** Stable identity for the chat. Logged-in users use their account; visitors get a
 *  generated "avatar user" persisted in localStorage so their thread survives reloads. */
interface Identity { name: string; email: string; guest: boolean; token?: string }

function resolveIdentity(): Identity {
  if (typeof window === "undefined") return { name: "Guest", email: "", guest: true };
  clearExpiredSession(); // drop a >24h session + guest identity before resolving
  const token = localStorage.getItem("access_token") || undefined;
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    if (u && u.email) return { name: u.name || "You", email: u.email, guest: false, token };
  } catch {}
  // Anonymous visitor - create/restore an avatar identity.
  try {
    const saved = localStorage.getItem("bazabot_identity");
    if (saved) {
      const p = JSON.parse(saved);
      if (p?.email) return { name: p.name, email: p.email, guest: true, token };
    }
  } catch {}
  const n = Math.floor(1000 + Math.random() * 9000);
  const rand = Math.random().toString(36).slice(2, 10);
  const identity: Identity = { name: `Guest ${n}`, email: `guest-${rand}@guest.mpahmapu.com`, guest: true };
  try { localStorage.setItem("bazabot_identity", JSON.stringify(identity)); } catch {}
  return { ...identity, token };
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

function defaultChips(role: BazaBotRole, t: (k: string) => string): Suggestion[] {
  if (role === "seeker") return [
    { label: t("seeker_help.faq1_q") || "How do I get paid?", query: t("seeker_help.faq1_q") || "How do I get paid?" },
    { label: t("seeker_help.faq3_q") || "How do I get jobs?", query: t("seeker_help.faq3_q") || "How do I get jobs?" },
  ];
  if (role === "owner") return [
    { label: t("owner_help.chip_escrow") || "How does escrow work?", query: t("owner_help.chip_escrow") || "How does escrow work?" },
    { label: t("owner_help.chip_verify") || "Are workers verified?", query: t("owner_help.chip_verify") || "Are workers verified?" },
  ];
  return [
    { label: "How does escrow work?", query: "How does escrow work?" },
    { label: "Are workers verified?", query: "Are workers verified?" },
  ];
}

// ── Minimal, safe markdown renderer (bold, links, bullet lists, line breaks) ────
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold** and [label](url) tokens.
  const re = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyBase}-b${i++}`}>{tok.slice(2, -2)}</strong>);
    } else {
      const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (lm && /^(https?:|\/)/.test(lm[2])) {
        nodes.push(<a key={`${keyBase}-a${i++}`} href={lm[2]} target="_blank" rel="noreferrer" style={{ color: "#fb923c", textDecoration: "underline" }}>{lm[1]}</a>);
      } else if (lm) {
        nodes.push(lm[1]);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key} style={{ margin: "4px 0", paddingLeft: 18 }}>
        {list.map((li, i) => <li key={i} style={{ marginBottom: 2 }}>{renderInline(li, `${key}-${i}`)}</li>)}
      </ul>
    );
    list = [];
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) { list.push(bullet[1]); return; }
    flush(`ul-${idx}`);
    if (line.trim() === "") { blocks.push(<div key={`sp-${idx}`} style={{ height: 6 }} />); return; }
    blocks.push(<p key={`p-${idx}`} style={{ margin: "2px 0" }}>{renderInline(line, `p-${idx}`)}</p>);
  });
  flush("ul-end");
  return <>{blocks}</>;
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
  .bb-bubble { max-width:78%; padding:10px 14px; border-radius:14px; font-size:12.5px; line-height:1.55; word-break:break-word; box-shadow:0 1px 2px rgba(0,0,0,0.22); }
  .bb-bubble p { white-space:pre-wrap; }
  .bb-bot { background:#1e1e1e; color:#e6e6e6; border:1px solid #2b2b2b; border-bottom-left-radius:4px; }
  .bb-agent { background:#15803d; color:#fff; border:1px solid #1a9c4b; border-bottom-left-radius:4px; }
  .bb-user { background:linear-gradient(135deg,#fb8c3c,#f97316); color:#fff; border-bottom-right-radius:4px; white-space:pre-line; }
  .bb-note { font-size:10.5px; color:#8a8a8a; margin-top:5px; display:flex; align-items:center; gap:4px; }
  .bb-input-area { padding:12px; border-top:1px solid #232323; display:flex; gap:8px; background:#0e0e0e; }
  .bb-input { flex:1; background:#181818; border:1px solid #2a2a2a; border-radius:10px; padding:10px 14px; font-size:12.5px; color:#fff; font-family:inherit; outline:none; transition:border-color .15s; }
  .bb-input:focus { border-color:#f97316; }
  .bb-input::placeholder { color:#5a5a5a; }
  .bb-send { background:#f97316; color:#fff; border:none; border-radius:10px; width:42px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .12s; flex-shrink:0; }
  .bb-send:hover { background:#ea580c; }
  .bb-send:disabled { opacity:.5; cursor:not-allowed; }
  .bb-chips { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 12px; }
  .bb-chip { background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.22); border-radius:99px; padding:6px 12px; font-size:11px; color:#fb923c; cursor:pointer; transition:all .12s; }
  .bb-chip:hover { background:rgba(249,115,22,0.16); border-color:rgba(249,115,22,0.4); }
  .bb-retry { margin-top:6px; background:#2a1a12; border:1px solid #7c3a12; color:#fb923c; border-radius:8px; padding:4px 10px; font-size:11px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
  .bb-form { margin-top:10px; display:flex; flex-direction:column; gap:7px; }
  .bb-form-input { background:#141414; border:1px solid #333; border-radius:8px; padding:8px 11px; font-size:12px; color:#fff; font-family:inherit; outline:none; }
  .bb-form-input:focus { border-color:#f97316; }
  .bb-form-input::placeholder { color:#666; }
  .bb-form-btn { background:#f97316; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer; margin-top:2px; }
  .bb-form-btn:hover { background:#ea580c; }
  .bb-form-err { color:#f87171; font-size:10.5px; }
  .bb-cards { margin-top:10px; display:flex; flex-direction:column; gap:7px; }
  .bb-rcard { display:flex; align-items:center; gap:8px; background:#161616; border:1px solid #2c2c2c; border-radius:10px; padding:9px 11px; text-decoration:none; transition:border-color .12s, background .12s; }
  .bb-rcard:hover { border-color:#f97316; background:#1b1512; }
  .bb-rcard-title { font-size:12px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bb-rcard-sub { font-size:10.5px; color:#9a9a9a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bb-rcard-meta { font-size:11px; font-weight:700; color:#22c55e; flex-shrink:0; }
  .bb-rcard-cta { font-size:10.5px; font-weight:700; color:#fff; background:#f97316; border-radius:7px; padding:5px 9px; flex-shrink:0; }
  .bb-typing { display:inline-flex; gap:4px; align-items:center; padding:3px 2px; }
  .bb-typing span { width:6px; height:6px; border-radius:99px; background:#fff; opacity:0.5; animation:bb-bounce 1.2s infinite ease-in-out; }
  .bb-typing span:nth-child(2){ animation-delay:.2s; } .bb-typing span:nth-child(3){ animation-delay:.4s; }
  @keyframes bb-bounce { 0%,60%,100%{ transform:translateY(0); opacity:.4; } 30%{ transform:translateY(-4px); opacity:1; } }
  .bb-dot { width:7px; height:7px; border-radius:99px; display:inline-block; animation:bb-pulse 1.8s infinite; }
  @keyframes bb-pulse { 0%{ box-shadow:0 0 0 0 rgba(34,197,94,.5);} 70%{ box-shadow:0 0 0 6px rgba(34,197,94,0);} 100%{ box-shadow:0 0 0 0 rgba(34,197,94,0);} }
`;

/** Consume the /api/bazabot/chat SSE stream, invoking `on` per event. */
async function streamChat(
  payload: unknown,
  on: (event: string, data: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/bazabot/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep); buf = buf.slice(sep + 2);
      let event = "message", data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) { try { on(event, JSON.parse(data)); } catch { /* ignore malformed */ } }
    }
  }
}

export function BazaBotChat({ role = "public", onClose, style }: {
  role?: BazaBotRole;
  onClose?: () => void;
  style?: React.CSSProperties;
}) {
  const { t, language } = useLanguage();
  const [identity, setIdentity] = useState<Identity>(() => resolveIdentity());
  const userName = identity.name;
  const userEmail = identity.email;

  const welcome = useCallback(
    () => t("bazabot.welcome", { userName }) || `Hello ${userName}! I am BazaBot, your platform assistant. How can I help you today?`,
    [t, userName],
  );
  // Restore the visitor's chat from localStorage (auto-expires after 24h).
  const restored = useRef<StoredSession | null>(readSession());
  const [messages, setMessages] = useState<Msg[]>(
    () => (restored.current?.messages.length ? restored.current.messages : [{ sender: "bot", text: welcome() }]),
  );
  const [inputText, setInputText] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [agentTyping, setAgentTyping] = useState(false);
  const [escalated, setEscalated] = useState(false);

  // Session bookkeeping: when it started + which agent replies we've already shown.
  const sessionCreatedAt = useRef<number>(restored.current?.createdAt ?? Date.now());
  const seenAgentIds = useRef<Set<string>>(new Set(restored.current?.seenAgentIds ?? []));
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wasEscalated = useRef(false);
  const lastUserMsg = useRef<string>("");
  // The question awaiting a live agent once contact details are collected.
  const pendingHandoff = useRef<string>("");

  // Persist the chat client-side on every change (throttled by React batching).
  useEffect(() => {
    saveSession(messages, [...seenAgentIds.current], sessionCreatedAt.current);
  }, [messages]);

  // Keep the welcome message in sync with the active language.
  useEffect(() => {
    setMessages(prev => (prev.length && prev[0].sender === "bot"
      ? [{ ...prev[0], text: welcome() }, ...prev.slice(1)]
      : prev));
  }, [language, welcome]);

  // Pin to the latest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, agentTyping, botThinking]);

  // Poll the thread, typing state and conversation status (human-agent handoff).
  useEffect(() => {
    if (!userEmail) return;
    let mounted = true;

    const poll = async () => {
      try {
        const thread = await getContactThread(userEmail);
        if (!mounted) return;
        if (thread && thread.length > 0) {
          // Append only NEW agent replies: unseen id, and created during this
          // session (so a >24h-old escalated thread never re-populates the chat).
          const additions: Msg[] = [];
          for (const m of thread as any[]) {
            if (m.direction !== "OUTBOUND") continue;
            const id = String(m.id ?? m.body);
            if (seenAgentIds.current.has(id)) continue;
            seenAgentIds.current.add(id);
            const ts = m.createdAt ? new Date(m.createdAt).getTime() : Date.now();
            if (ts < sessionCreatedAt.current) continue; // pre-session (old) reply
            additions.push({ sender: "agent", text: m.body });
          }
          if (additions.length) {
            setMessages(prev => {
              const shown = new Set(prev.filter(m => m.sender === "agent").map(m => m.text));
              const fresh = additions.filter(a => !shown.has(a.text));
              return fresh.length ? [...prev, ...fresh] : prev;
            });
          }
        }

        const [typing, status] = await Promise.all([
          getContactTypingStatus(userEmail).catch(() => ({ agentTyping: false } as any)),
          getContactStatus(userEmail).catch(() => ({ escalated: false } as any)),
        ]);
        if (!mounted) return;
        setAgentTyping(!!typing?.agentTyping);

        const nowEsc = !!status?.escalated;
        setEscalated(nowEsc);
        if (wasEscalated.current && !nowEsc) {
          setMessages(prev => [...prev, {
            sender: "bot",
            text: t("bazabot.resumed") || "This conversation has been closed. I'm here again to help - feel free to ask me anything! 🤖",
          }]);
        }
        wasEscalated.current = nowEsc;
      } catch { /* transient */ }
    };

    poll();
    const id = setInterval(poll, 2500);
    return () => { mounted = false; clearInterval(id); };
  }, [userEmail, t]);

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

  const forwardToAgent = (text: string, who?: { name: string; email: string }) => {
    const name = who?.name ?? userName;
    const email = who?.email ?? userEmail;
    submitContact({
      name,
      email,
      subject: `BazaBot chat from ${name}`,
      message: text,
      // Chat handoff: the visitor is on the site reading replies in the widget, so
      // agent replies are shown here, never emailed (unlike the contact form).
      source: "BOT",
    }).catch(() => {});
  };

  /**
   * Start a live-agent hand-off. Signed-in users (real email) connect straight
   * away; guests are shown an inline name+email form first.
   */
  const beginHandoff = (question: string) => {
    pendingHandoff.current = question;
    if (!identity.guest && userEmail) {
      forwardToAgent(question);
      setEscalated(true);
      wasEscalated.current = true;
      setMessages(prev => [...prev, {
        sender: "bot",
        text: "Connecting you with a live agent - they'll reply here shortly. Please keep this tab open.",
      }]);
      return;
    }
    // Guest → collect real contact details before connecting.
    setMessages(prev => [...prev, { sender: "bot", text: ESCALATION_INTRO, form: true }]);
  };

  /** Guest submitted the hand-off form: save contact, create the agent message. */
  const submitHandoffForm = (name: string, email: string) => {
    const nm = name.trim();
    const em = email.trim();
    if (nm.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return false;

    const next: Identity = { name: nm, email: em, guest: true, token: identity.token };
    try { localStorage.setItem("bazabot_identity", JSON.stringify({ name: nm, email: em })); } catch {}
    // The poll under the new email appends the agent's replies (id + timestamp
    // deduped), so switching identity never wipes the visible chat.
    setIdentity(next);

    forwardToAgent(pendingHandoff.current || lastUserMsg.current, { name: nm, email: em });
    setEscalated(true);
    wasEscalated.current = true;

    // Consume the form and confirm.
    setMessages(prev => {
      const cleared = prev.map(m => (m.form ? { ...m, form: false } : m));
      return [...cleared, {
        sender: "bot",
        text: `Thanks, ${nm}! An agent will reply here shortly - please keep this tab open.`,
      }];
    });
    return true;
  };

  /** Ask the agent (streaming) and render the reply into a placeholder bubble. */
  const askAgent = useCallback(async (msg: string) => {
    setBotThinking(true);
    // Insert a streaming placeholder we progressively fill.
    setMessages(prev => [...prev, { sender: "bot", text: "", streaming: true }]);

    const fill = (updater: (m: Msg) => Msg) =>
      setMessages(prev => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].sender === "bot") { next[i] = updater(next[i]); break; }
        }
        return next;
      });

    try {
      const payload = {
        message: msg,
        token: identity.token,
        role,
        userName,
        sessionId: userEmail || "anon",
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
        language,
        history: messages
          .filter(m => m.sender === "bot" || m.sender === "user")
          .slice(-8)
          .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text })),
      };

      let started = false;
      setStatusText(t("bazabot.thinking") || "Thinking…");
      await streamChat(payload, (event, data) => {
        if (event === "delta") {
          if (!started) { started = true; setBotThinking(false); setStatusText(""); }
          fill(m => ({ ...m, text: m.text + (data.text ?? ""), streaming: true }));
        } else if (event === "done") {
          fill(m => ({ ...m, streaming: false, actions: data.actions, suggestions: data.suggestions, results: data.results }));
          if (data.escalate) beginHandoff(msg);
        } else if (event === "status") {
          if (!started) { setBotThinking(true); if (data.text) setStatusText(data.text); }
        } else if (event === "error") {
          fill(m => ({ ...m, streaming: false, error: true, text: m.text || (t("bazabot.error") || "Sorry, something went wrong.") }));
        }
      });
    } catch {
      fill(m => ({ ...m, streaming: false, error: true, text: m.text || (t("bazabot.error") || "Sorry, I couldn't reach the assistant. Please try again.") }));
    } finally {
      setBotThinking(false);
      setStatusText("");
    }
  // messages intentionally omitted: we snapshot history at call time via the setter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.token, role, userName, userEmail, language, t]);

  const handleSend = (text: string) => {
    const msg = text.trim();
    if (!msg || !userEmail) return;

    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    sendContactTyping(userEmail, "USER", false).catch(() => {});

    lastUserMsg.current = msg;
    setMessages(prev => [...prev, { sender: "user", text: msg }]);
    setInputText("");

    // While a human agent owns the conversation the bot stays silent and only
    // forwards the visitor's messages until the agent closes the chat.
    if (escalated) { forwardToAgent(msg); return; }

    askAgent(msg);
  };

  const retry = () => {
    if (!lastUserMsg.current) return;
    // Drop the errored bubble, then re-ask.
    setMessages(prev => {
      const next = [...prev];
      if (next.length && next[next.length - 1].sender === "bot" && next[next.length - 1].error) next.pop();
      return next;
    });
    askAgent(lastUserMsg.current);
  };

  const guestColor = avatarColor(userEmail || userName);

  // Suggestions come from the last completed bot message, else sensible defaults.
  const lastBot = [...messages].reverse().find(m => m.sender === "bot" && !m.streaming);
  const chips = (lastBot?.suggestions && lastBot.suggestions.length)
    ? lastBot.suggestions
    : defaultChips(role, t);

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
          const showTyping = m.sender === "bot" && m.streaming && !m.text;
          return (
            <div key={i} className={`bb-row ${m.sender}`}>
              {!isUser && (
                <div className="bb-avatar" style={{ background: m.sender === "agent" ? "#15803d" : "rgba(249,115,22,0.12)" }}>
                  <Bot size={13} color={m.sender === "agent" ? "#fff" : "#f97316"} />
                </div>
              )}
              <div className={`bb-bubble bb-${m.sender}`}>
                {showTyping
                  ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="bb-typing"><span /><span /><span /></span>
                      {statusText && <span style={{ fontSize: 11, color: "#9a9a9a" }}>{statusText}</span>}
                    </span>
                  )
                  : (isUser || m.sender === "agent") ? m.text : <Markdown text={m.text} />}
                {m.results && m.results.length > 0 && <ResultCards cards={m.results} />}
                {m.form && <HandoffForm onSubmit={submitHandoffForm} />}
                {m.actions && m.actions.some(a => a.ok) && (
                  <div className="bb-note"><Sparkles size={11} /> {actionNote(m.actions)}</div>
                )}
                {m.error && (
                  <button className="bb-retry" onClick={retry}><RotateCw size={11} /> {t("bazabot.retry") || "Retry"}</button>
                )}
              </div>
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

      {/* Suggestion chips - hidden while an agent is handling the chat */}
      {!escalated && (
        <div className="bb-chips">
          {chips.map(c => (
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
        <button className="bb-send" onClick={() => handleSend(inputText)} disabled={botThinking && !escalated} aria-label="Send">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

/** Actionable job/worker cards with a call-to-action button linking to the real page. */
function ResultCards({ cards }: { cards: ResultCard[] }) {
  return (
    <div className="bb-cards">
      {cards.map(c => (
        <a key={c.id} href={c.url} className="bb-rcard" target="_blank" rel="noreferrer">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="bb-rcard-title">{c.title}</div>
            {c.subtitle && <div className="bb-rcard-sub">{c.subtitle}</div>}
          </div>
          {c.meta && <span className="bb-rcard-meta">{c.meta}</span>}
          <span className="bb-rcard-cta">{c.cta}</span>
        </a>
      ))}
    </div>
  );
}

/** Inline name+email form shown when a guest is handed off to a live agent. */
function HandoffForm({ onSubmit }: { onSubmit: (name: string, email: string) => boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return null;

  const submit = () => {
    const ok = onSubmit(name, email);
    if (ok) setSent(true); else setError(true);
  };

  return (
    <div className="bb-form" onClick={e => e.stopPropagation()}>
      <input
        className="bb-form-input" placeholder="Your name" value={name}
        onChange={e => { setName(e.target.value); setError(false); }}
        onKeyDown={e => e.key === "Enter" && submit()}
      />
      <input
        className="bb-form-input" placeholder="Your email" type="email" value={email}
        onChange={e => { setEmail(e.target.value); setError(false); }}
        onKeyDown={e => e.key === "Enter" && submit()}
      />
      {error && <div className="bb-form-err">Please enter your name and a valid email.</div>}
      <button className="bb-form-btn" onClick={submit}>Connect me with an agent</button>
    </div>
  );
}

/** Join the assistant's successful action explanations into one short line. */
function actionNote(actions: AgentAction[]): string {
  const done = [...new Set(actions.filter(a => a.ok).map(a => a.explanation))];
  if (!done.length) return "";
  if (done.length === 1) return done[0];
  return done.slice(0, 2).join(" · ");
}
