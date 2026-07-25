/**
 * Escalation heuristics - deciding when BazaBot should hand off to a live agent.
 *
 * Two triggers:
 *  1. The user explicitly asks for a human ("talk to an agent", "real person").
 *  2. The composed answer signals the bot couldn't actually help.
 *
 * When either fires, the turn is marked escalate:true; the UI then collects the
 * user's name + email and creates a contact message for the live agent.
 */

const HUMAN_PATTERNS = [
  /\b(human|real person|live (agent|person|support|chat|rep))\b/i,
  /\b(talk|speak|chat|connect)\s+(to|with)\s+(a\s+)?(person|someone|agent|human|support|rep|representative)\b/i,
  /\b(customer\s+(service|support|care)|support\s+agent|help\s?desk)\b/i,
  /\b(agent|representative)\b/i,
];

const UNCERTAINTY_PATTERNS = [
  /\bnot\s+(sure|certain)\b/i,
  /\bi\s+(don'?t|do not)\s+(know|have)\b/i,
  /\bcouldn'?t\s+(find|answer|help)\b/i,
  /\bconnect\s+you\s+with\s+(a\s+)?(support|live|human)\s+agent\b/i,
  /\bunable to (help|answer|find)\b/i,
];

/** Chip offered (never auto-triggered) so the user can reach a human on demand. */
export const AGENT_SUGGESTION = { label: "Talk to a live agent", query: "Talk to a live agent" };

/** True when the user is explicitly asking to reach a human agent. */
export function wantsHuman(message: string): boolean {
  return HUMAN_PATTERNS.some(p => p.test(message));
}

/** True when a composed answer suggests the bot did not actually resolve the ask. */
export function looksUncertain(reply: string): boolean {
  return UNCERTAINTY_PATTERNS.some(p => p.test(reply));
}
