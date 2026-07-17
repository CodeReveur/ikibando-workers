/**
 * Rule-engine bridge.
 *
 * Wraps the existing multilingual intent engine (bazabot-brain) and FAQ matcher
 * (bazabot-knowledge) so BazaBot keeps working — in all four languages, with
 * role awareness and human-agent escalation — whenever AI mode is unavailable.
 * This is what makes "no model configured" a graceful degradation rather than an
 * outage.
 */
import { analyze, respond, type Lang, type Topic } from "@/components/support/bazabot-brain";
import { matchKnowledge } from "@/components/support/bazabot-knowledge";
import { looksKinyarwanda } from "./lang";
import type { BazaBotConfig } from "./config";
import type { AgentRequest, AgentResult, Suggestion } from "./types";
import { analytics } from "./analytics/analytics";

const CONVERSATIONAL: Topic[] = ["greetings", "feeling", "quotes", "business"];

function suggestionsFor(role: string): Suggestion[] {
  if (role === "seeker") return [
    { label: "How do I get paid?", query: "How do I get paid?" },
    { label: "How do I get more jobs?", query: "How do I get more jobs?" },
  ];
  if (role === "owner") return [
    { label: "How does escrow work?", query: "How does escrow work?" },
    { label: "How do I request a refund?", query: "How do I request a refund?" },
  ];
  return [
    { label: "How does escrow work?", query: "How does escrow work?" },
    { label: "Are workers verified?", query: "Are workers verified?" },
  ];
}

/** Run the legacy engine and adapt it to an AgentResult. */
export function runRuleEngine(req: AgentRequest, _cfg: BazaBotConfig): AgentResult {
  const started = Date.now();
  const { message, context } = req;
  const role = context.role;
  const userName = context.userName ?? "there";

  const analyzed = analyze(message, context.language as Lang);
  const topic = analyzed.topic;
  // Force Kinyarwanda when our dedicated detector flags it — the generic keyword
  // detector is fooled by English loanwords ("escrow", "platform") and would
  // otherwise answer a Kinyarwanda question in English.
  const lang: Lang = looksKinyarwanda(message) ? "kinyy" : analyzed.lang;

  const base = (reply: string, source: AgentResult["source"], escalate = false): AgentResult => {
    const latencyMs = Date.now() - started;
    void analytics.turn(source, topic, latencyMs, escalate);
    return {
      reply, source, intent: topic, lang,
      actions: [], suggestions: escalate ? [] : suggestionsFor(role),
      escalate, latencyMs,
    };
  };

  // 1) Small talk answers immediately, in the visitor's language.
  if (CONVERSATIONAL.includes(topic)) {
    return base(respond(topic, lang, userName, role), "rules");
  }

  // 2) Precise, role-aware FAQ.
  const kb = matchKnowledge(message, role);
  if (kb) {
    void analytics.knowledge(true);
    return base(kb, "knowledge");
  }
  void analytics.knowledge(false);

  // 3) Coarse multilingual intent (mainly for non-English visitors).
  if (topic !== "fallback") {
    return base(respond(topic, lang, userName, role), "rules");
  }

  // 4) Nothing matched — escalate to a human agent.
  return base(respond("fallback", lang, userName, role), "escalation", true);
}
