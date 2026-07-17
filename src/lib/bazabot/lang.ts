/**
 * Kinyarwanda detector.
 *
 * Free hosted LLMs cannot reliably generate Kinyarwanda (they drift to Swahili),
 * so Kinyarwanda turns are routed to the curated rule engine, which has real
 * human-written Kinyarwanda answers. The generic keyword language detector gets
 * fooled by English loanwords ("escrow", "platform") inside Kinyarwanda
 * sentences, so this is a dedicated, high-recall check for that one routing
 * decision. It is deliberately biased toward Kinyarwanda-specific tokens that do
 * NOT appear in Swahili/English/French, to avoid false positives.
 */

// Strong markers: seeing ONE is enough — these are unmistakably Kinyarwanda.
const STRONG = [
  "nigute", "muraho", "mwaramutse", "mwiriwe", "amakuru", "ndashaka", "nshaka",
  "nkeneye", "cyangwa", "murakoze", "kwishyura", "kwishyurwa", "umukoresha",
  "byanjye", "wanjye", "yanjye", "ikihe", "ninde", "uburyo", "ndagushaka",
  "mfite", "ufite", "nabonye", "ntabwo", "sinshobora", "gushakisha",
];

// Weaker markers: need at least TWO together to call it Kinyarwanda.
const WEAK = [
  "gute", "ese", "kuri", "iyi", "iyo", "uyu", "hano", "aha", "kandi", "ariko",
  "gukora", "ikora", "kubona", "nabona", "konti", "akazi", "umukozi", "yego",
  "oya", "kuki", "rwose", "neza", "cyane", "gusaba", "gutanga",
];

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

/** True when a message is (very likely) Kinyarwanda. */
export function looksKinyarwanda(message: string): boolean {
  const words = new Set(tokens(message));
  if (STRONG.some(w => words.has(w))) return true;
  let weak = 0;
  for (const w of WEAK) if (words.has(w)) weak++;
  return weak >= 2;
}
