/**
 * BazaBot language + intent engine.
 *
 * Each keyword is tied to both a topic (what to answer) and a language (how to
 * answer). Scanning a message therefore tells us the reply content AND the reply
 * language, so the bot answers in whatever language the visitor wrote in —
 * independent of the app's selected language.
 */
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import sw from "@/locales/sw.json";
import kinyy from "@/locales/kinyy.json";

export type Lang = "en" | "fr" | "sw" | "kinyy";
const LOCALES: Record<Lang, any> = { en, fr, sw, kinyy };
const LANGS: Lang[] = ["en", "fr", "sw", "kinyy"];

/** Who is asking. owner = employer, seeker = worker, public = guest/unknown. */
export type Role = "owner" | "seeker" | "public";

export type Topic =
  | "greetings" | "feeling" | "quotes" | "business"
  | "escrow" | "fee" | "refund" | "payout" | "verify" | "job" | "complete" | "dispute"
  | "fallback";

/** Answer priority when several topics match — substantive topics beat small talk. */
const TOPIC_PRIORITY: Topic[] = [
  "escrow", "payout", "fee", "refund", "verify", "complete", "dispute", "job",
  "business", "quotes", "feeling", "greetings",
];

/** topic → language → trigger words/phrases. Short tokens (≤3 chars) match as whole words. */
const KEYWORDS: Record<Exclude<Topic, "fallback">, Record<Lang, string[]>> = {
  greetings: {
    en: ["hello", "hi", "hey", "good morning", "good evening", "howdy", "greetings"],
    fr: ["bonjour", "salut", "coucou", "bonsoir", "allo"],
    sw: ["jambo", "habari", "hujambo", "salama", "shikamoo", "hodi"],
    kinyy: ["muraho", "bite", "mwaramutse", "mwiriwe", "yambu"],
  },
  feeling: {
    en: ["how are you", "how's it going", "how do you feel", "are you okay", "you good", "whats up", "what's up"],
    fr: ["comment ça va", "ça va", "comment allez", "vas bien", "quoi de neuf"],
    sw: ["habari yako", "hali gani", "mambo vipi", "unaendeleaje", "uko poa"],
    kinyy: ["amakuru", "bite se", "umeze ute", "urakomeye", "uri gute"],
  },
  quotes: {
    en: ["quote", "motivation", "motivate", "inspire", "inspiration", "wisdom", "encourage"],
    fr: ["citation", "motivation", "inspiration", "sagesse", "encourage"],
    sw: ["methali", "motisha", "hekima", "nukuu", "kutia moyo"],
    kinyy: ["umugani", "inama", "ubwenge", "imvugo", "gushishikariza"],
  },
  business: {
    en: ["business", "company", "career", "entrepreneur", "invest", "startup", "boss", "market", "profit"],
    fr: ["entreprise", "affaires", "carrière", "patron", "marché", "investir", "profit"],
    sw: ["biashara", "kampuni", "mwajiri", "soko", "uwekezaji", "faida"],
    kinyy: ["ubucuruzi", "isosiyete", "umukoresha", "isoko", "ishoramari", "inyungu"],
  },
  escrow: {
    en: ["escrow", "deposit", "payment", "pay ", "paid", "paying", "money", "wallet", "balance", "transfer"],
    fr: ["dépôt", "depot", "paiement", "payer", "argent", "portefeuille", "solde", "virement"],
    sw: ["malipo", "amana", "pesa", "fedha", "mkoba", "salio", "lipa", "hela"],
    kinyy: ["ubwishyu", "amafaranga", "kwishyura", "kwishyurwa", "konti", "kohereza", "faranga"],
  },
  payout: {
    en: ["withdraw", "withdrawal", "cash out", "cashout", "payout", "pay out", "money to momo"],
    fr: ["retrait", "retirer", "retirez", "encaisser"],
    sw: ["toa pesa", "kutoa pesa", "ondoa pesa", "chukua pesa"],
    kinyy: ["kubikuza", "bikuza", "gukura amafaranga", "kwaka amafaranga"],
  },
  fee: {
    en: ["fee", "commission", "percent", "percentage", "deduction", "charge", "cut ", "rate"],
    fr: ["frais", "commission", "pourcentage", "déduction", "retenue", "coût"],
    sw: ["ada", "kamisheni", "asilimia", "makato", "gharama"],
    kinyy: ["komisiyo", "ijanisha", "serivisi", "ikiguzi", "amafaranga ya serivisi"],
  },
  refund: {
    en: ["refund", "cancel", "cancellation", "reimburse", "money back", "chargeback"],
    fr: ["remboursement", "annuler", "annulation", "rembourser"],
    sw: ["kurudishiwa", "ghairi", "futa", "rejesha", "sitisha"],
    kinyy: ["gusubizwa", "guhagarika", "kureka", "gusubiza amafaranga", "kwisubiraho"],
  },
  verify: {
    en: ["verify", "verified", "verification", "badge", "national id", " id ", "background check", "trust", "legit", "genuine"],
    fr: ["vérifier", "vérifié", "vérification", "badge", "identité", "contrôle", "fiable"],
    sw: ["thibitisha", "uthibitisho", "kitambulisho", "beji", "ukaguzi", "uaminifu"],
    kinyy: ["kugenzura", "kwemeza", "ikirango", "indangamuntu", "isuzuma", "kwizerwa"],
  },
  job: {
    en: ["job", "jobs", "hire", "hiring", "hired", "gig", "task", "employ", "recruit", "worker", "work "],
    fr: ["emploi", "travail", "embaucher", "recruter", "mission", "tâche", "ouvrier"],
    sw: ["kazi", "ajira", "ajiri", "kuajiri", "kibarua", "mradi", "mfanyakazi"],
    kinyy: ["akazi", "gukora", "gushaka umukozi", "umurimo", "umukozi", "guhemba"],
  },
  complete: {
    en: ["complete", "completion", "finish", "finished", "mark done", "qr", "confirm job", "sign off"],
    fr: ["terminer", "achever", "fini", "confirmer", "clôturer"],
    sw: ["kamilisha", "maliza", "kumaliza", "thibitisha kazi", "hitimisha"],
    kinyy: ["kurangiza", "gusoza", "kwemeza ko byarangiye", "guhagarika akazi"],
  },
  dispute: {
    en: ["dispute", "complaint", "complain", "problem", "issue", "conflict", "report", "scam", "fraud"],
    fr: ["litige", "plainte", "problème", "conflit", "signaler", "arnaque"],
    sw: ["mzozo", "malalamiko", "lalamika", "tatizo", "shida", "ripoti", "ulaghai"],
    kinyy: ["impaka", "ikibazo", "kwinuba", "ikirego", "amakimbirane", "uburiganya"],
  },
};

/** Function words used only as a tie-breaker for language detection. */
const STOPWORDS: Record<Lang, string[]> = {
  en: ["the", "is", "for", "with", "how", "what", "why", "please", "thanks", "can", "do", "want", "need"],
  fr: ["le", "la", "les", "je", "vous", "comment", "est", "pour", "avec", "merci", "oui", "pourquoi", "quoi"],
  sw: ["na", "ya", "kwa", "ni", "asante", "ndiyo", "hapana", "tafadhali", "nini", "vipi", "gani", "nataka"],
  kinyy: ["mu", "cyangwa", "murakoze", "yego", "oya", "gute", "iki", "nshaka", "ese", "ndashaka", "nkeneye"],
};

function normalize(raw: string): string {
  return ` ${raw.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
}

function matches(hay: string, word: string): boolean {
  return word.length <= 3 ? hay.includes(` ${word.trim()} `) : hay.includes(word);
}

/** Detect the topic to answer and the language to answer in. */
export function analyze(raw: string, fallbackLang: Lang): { topic: Topic; lang: Lang } {
  const hay = normalize(raw);
  const votes: Record<Lang, number> = { en: 0, fr: 0, sw: 0, kinyy: 0 };
  const hits: { topic: Topic; weight: number }[] = [];

  (Object.keys(KEYWORDS) as Exclude<Topic, "fallback">[]).forEach(topic => {
    LANGS.forEach(lang => {
      KEYWORDS[topic][lang].forEach(word => {
        if (matches(hay, word)) {
          votes[lang] += 2;
          hits.push({ topic, weight: word.trim().length });
        }
      });
    });
  });

  LANGS.forEach(lang => {
    STOPWORDS[lang].forEach(word => { if (hay.includes(` ${word} `)) votes[lang] += 1; });
  });

  let topic: Topic = "fallback";
  if (hits.length) {
    hits.sort((a, b) =>
      (TOPIC_PRIORITY.indexOf(a.topic) - TOPIC_PRIORITY.indexOf(b.topic)) || (b.weight - a.weight));
    topic = hits[0].topic;
  }

  let lang: Lang = fallbackLang;
  let best = 0;
  LANGS.forEach(L => { if (votes[L] > best) { best = votes[L]; lang = L; } });
  if (best === 0) lang = fallbackLang;

  return { topic, lang };
}

/** Look up a bazabot string in a specific language, falling back to English. Returns null if absent. */
function trOrNull(lang: Lang, key: string, vars?: Record<string, string | number>): string | null {
  const read = (L: Lang) => {
    let cur: any = LOCALES[L]?.bazabot;
    for (const p of key.split(".")) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p]; else return null;
    }
    return typeof cur === "string" ? cur : null;
  };
  let text = read(lang) ?? read("en");
  if (text == null) return null;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text!.replace(new RegExp(`{${k}}`, "g"), String(v));
  return text;
}

function tr(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  return trOrNull(lang, key, vars) ?? "";
}

/** First of several candidate keys that resolves — used for role → shared fallback. */
function pick(lang: Lang, keys: string[], vars?: Record<string, string | number>): string {
  for (const k of keys) {
    const v = trOrNull(lang, k, vars);
    if (v != null) return v;
  }
  return "";
}

/**
 * Build the reply for a topic in the chosen language, tailored to the asker's
 * role. Each part resolves the role-specific text (`<topic>.<role>.<part>`) and
 * falls back to the shared text (`<topic>.<part>`), so every role — including a
 * guest — always gets a complete answer in the visitor's language.
 */
export function respond(topic: Topic, lang: Lang, userName: string, role: Role = "public"): string {
  if (topic === "greetings" || topic === "feeling" || topic === "quotes" || topic === "business") {
    return tr(lang, topic);
  }
  if (topic === "fallback") {
    return [tr(lang, "fallback.overview"), tr(lang, "fallback.process"), tr(lang, "fallback.guidelines")]
      .filter(Boolean).join("\n\n");
  }
  const starter = tr(lang, `starter${1 + Math.floor(Math.random() * 5)}`);
  const vars = { name: userName, time: new Date().toLocaleTimeString(), fee: topic === "fee" ? "25%" : "5%" };
  const body = ["overview", "process", "guidelines"]
    .map(p => pick(lang, [`${topic}.${role}.${p}`, `${topic}.${p}`], vars))
    .filter(Boolean).join("\n\n");
  return [starter, body].filter(Boolean).join("\n\n").trim();
}
