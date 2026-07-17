/**
 * Intent detection.
 *
 * Replaces bare keyword matching with a two-tier classifier:
 *  1. LLM classification into a fixed intent set with structured parameter
 *     extraction (category, quantity, date, location, …), when a model is up.
 *  2. Heuristic fallback that reuses the legacy multilingual engine
 *     (bazabot-brain) plus light regex slot-filling, so intent is always
 *     available even with no model.
 *
 * The result feeds the reasoning loop's tool selection and the reply language.
 */
import type { AIProvider } from "../providers";
import type { Lang } from "../types";
import { analyze } from "@/components/support/bazabot-brain";
import { log } from "../logger";

export const INTENTS = [
  "search_worker", "search_job", "search_employer", "create_job", "cancel_booking", "check_wallet",
  "check_transactions", "check_notifications", "explain_policy", "verify_account",
  "payment_help", "technical_support", "recommendation", "complaint", "greeting",
  "navigation_help", "check_profile", "update_profile", "unknown",
] as const;
export type Intent = (typeof INTENTS)[number];

export interface DetectedIntent {
  intent: Intent;
  lang: Lang;
  /** Extracted slots, e.g. { category: "Cleaning", quantity: 2, location: "Kigali" }. */
  params: Record<string, string | number>;
  /** 0..1 confidence. Heuristic path is capped lower than a clean LLM parse. */
  confidence: number;
}

/** Map the legacy brain's coarse topic → an intent, as a fallback. */
const TOPIC_TO_INTENT: Record<string, Intent> = {
  greetings: "greeting", feeling: "greeting", quotes: "greeting", business: "recommendation",
  escrow: "explain_policy", fee: "explain_policy", refund: "payment_help", payout: "payment_help",
  verify: "verify_account", job: "search_job", complete: "technical_support", dispute: "complaint",
  fallback: "unknown",
};

/** Very small, language-agnostic slot extraction for the heuristic path. */
function extractSlots(message: string): Record<string, string | number> {
  const slots: Record<string, string | number> = {};
  const qty = message.match(/\b(\d{1,3})\b/);
  if (qty) slots.quantity = Number(qty[1]);
  if (/\btomorrow\b/i.test(message)) slots.date = "tomorrow";
  else if (/\btoday\b/i.test(message)) slots.date = "today";
  // Common Rwandan locations mentioned inline.
  const loc = message.match(/\b(Kigali|Gasabo|Kicukiro|Nyarugenge|Musanze|Huye|Rubavu|Muhanga|Rwamagana)\b/i);
  if (loc) slots.location = loc[1];
  return slots;
}

function heuristic(message: string, fallbackLang: Lang): DetectedIntent {
  const { topic, lang } = analyze(message, fallbackLang);
  return {
    intent: TOPIC_TO_INTENT[topic] ?? "unknown",
    lang,
    params: extractSlots(message),
    confidence: topic === "fallback" ? 0.2 : 0.55,
  };
}

const SYSTEM = `You are an intent classifier for a workforce-platform assistant.
Return ONLY minified JSON: {"intent": <one of the list>, "lang": "en"|"fr"|"sw"|"kinyy", "params": {}}.
Valid intents: ${INTENTS.join(", ")}.
Extract into params any of: category, quantity (number), date, location, badgeId, status.
"lang" is the language the user wrote in. No prose, no code fences.`;

function safeJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/**
 * Classify a message.
 *
 * The curated keyword engine (bazabot-brain) is purpose-built for this platform
 * and more reliable than a lightweight LLM at labelling platform topics, so it
 * is the PRIMARY source of the intent label. The LLM is used to (a) enrich
 * structured params and (b) classify only when the heuristic is "unknown". This
 * keeps intent accurate on small models while still extracting rich slots.
 */
export async function detectIntent(
  message: string,
  fallbackLang: Lang,
  provider: AIProvider | null
): Promise<DetectedIntent> {
  const base = heuristic(message, fallbackLang);
  if (!provider) return base;

  try {
    const raw = await provider.chat(
      [{ role: "system", content: SYSTEM }, { role: "user", content: message }],
      { json: true, temperature: 0, maxTokens: 160 }
    );
    const parsed = safeJson(raw);
    const llmIntent: Intent | null = parsed && INTENTS.includes(parsed.intent) ? parsed.intent : null;
    const llmParams = parsed?.params && typeof parsed.params === "object" ? parsed.params : {};
    const llmLang: Lang | null = parsed && ["en", "fr", "sw", "kinyy"].includes(parsed.lang) ? parsed.lang : null;

    // Heuristic wins the label when it recognised the topic; LLM only fills the
    // gap. Params merge (LLM slots enrich the heuristic's regex slots).
    const intent: Intent = base.intent !== "unknown" ? base.intent : (llmIntent ?? "unknown");
    return {
      intent,
      lang: base.params && base.confidence >= 0.5 ? base.lang : (llmLang ?? base.lang),
      params: { ...base.params, ...llmParams },
      confidence: base.intent !== "unknown" ? Math.max(base.confidence, 0.7) : (llmIntent ? 0.7 : 0.2),
    };
  } catch (e) {
    log.warn("intent LLM enrichment failed, using heuristic", { message: (e as Error)?.message });
    return base;
  }
}
