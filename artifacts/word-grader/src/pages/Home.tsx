import { useState, useMemo, useEffect, useRef } from "react";
import { getWordBand, getWordRank, bandToColor, bandToGradientColor, bandLabel, bandRankRange, bandPenalty, WordBand } from "@/data/wordFrequency";

const IRREGULAR_PLURALS: Record<string, string> = {
  // Vowel-change plurals
  "men": "man", "women": "woman", "teeth": "tooth", "feet": "foot",
  "geese": "goose", "mice": "mouse", "lice": "louse",
  // -en plurals
  "oxen": "ox", "children": "child", "brethren": "brother",
  // -f → -ves
  "leaves": "leaf", "wolves": "wolf", "lives": "life", "knives": "knife",
  "wives": "wife", "halves": "half", "loaves": "loaf", "scarves": "scarf",
  "shelves": "shelf", "thieves": "thief", "calves": "calf", "selves": "self",
  "elves": "elf", "hooves": "hoof",
  // Latin/Greek
  "criteria": "criterion", "phenomena": "phenomenon", "data": "datum",
  "analyses": "analysis", "bases": "basis", "theses": "thesis",
  "indices": "index", "appendices": "appendix", "matrices": "matrix",
  "vertices": "vertex", "axes": "axis", "cacti": "cactus", "fungi": "fungus",
  "alumni": "alumnus", "syllabi": "syllabus", "formulae": "formula",
  "nuclei": "nucleus", "radii": "radius", "stimuli": "stimulus",
  // Other common irregulars
  "people": "person", "dice": "die", "pennies": "penny",
};

function stemPlural(word: string): string | null {
  const w = word.toLowerCase();
  if (IRREGULAR_PLURALS[w]) return IRREGULAR_PLURALS[w];
  // -ies → -y (e.g. "babies" → "baby")
  if (w.length > 3 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  // -es → remove -es (e.g. "boxes" → "box", "churches" → "church")
  if (w.length > 3 && w.endsWith("es") && !w.endsWith("ies"))
    return w.slice(0, -2);
  // -s → remove -s (e.g. "friends" → "friend")
  if (w.length > 2 && w.endsWith("s") && !w.endsWith("ss"))
    return w.slice(0, -1);
  return null;
}

// Returns candidate base forms to try after stripping common suffixes.
// We try all candidates and take the best (lowest) band found in the word lists.
function stemSuffix(word: string): string[] {
  const w = word.toLowerCase();
  const candidates: string[] = [];

  const push = (...stems: string[]) => candidates.push(...stems);

  // -iveness → -ive  (forgiveness→forgive, expensiveness→expensive)
  if (w.length > 8 && w.endsWith("iveness")) push(w.slice(0, -7) + "ive");

  // -ness → base  (kindness→kind, happiness→happy via -iness→-y)
  if (w.length > 5 && w.endsWith("ness")) {
    const s = w.slice(0, -4);
    push(s);
    if (s.endsWith("i")) push(s.slice(0, -1) + "y");    // happiness→happy
    // If stem ends in "n", the root may drop the "n" (forgiven→forgive)
    if (s.endsWith("n")) push(s.slice(0, -1));
  }

  // -ment → base  (movement→move, argument→argu → argume... just try)
  if (w.length > 5 && w.endsWith("ment")) push(w.slice(0, -4));

  // -ful → base   (helpful→help, beautiful→beauti→beauty via -iful)
  if (w.length > 5 && w.endsWith("iful")) {
    push(w.slice(0, -4) + "y");                          // beautiful→beauty
  } else if (w.length > 4 && w.endsWith("ful")) {
    push(w.slice(0, -3));
  }

  // -less → base  (hopeless→hope, careless→care)
  if (w.length > 5 && w.endsWith("less")) push(w.slice(0, -4));

  // -able/-ible → base  (readable→read, usable→use, possible→poss → try both)
  if (w.length > 5 && (w.endsWith("able") || w.endsWith("ible"))) {
    const s = w.slice(0, -4);
    push(s, s + "e");
  }

  // -ation → base or -ate  (creation→create, information→inform)
  if (w.length > 7 && w.endsWith("ation")) {
    const s = w.slice(0, -5);
    push(s, s + "e", s + "ate");
  }

  // -tion/-sion → base  (action→act, version→vers → try)
  if (w.length > 5 && (w.endsWith("tion") || w.endsWith("sion"))) {
    push(w.slice(0, -4));
  }

  // -ily → -y    (happily→happy, easily→easy, heavily→heavy)
  if (w.length > 4 && w.endsWith("ily")) push(w.slice(0, -3) + "y");

  // -ly → base   (quickly→quick, slowly→slow)
  // also -ly → -le  (gently→gentle, simply→simple)
  if (w.length > 3 && w.endsWith("ly")) {
    const s = w.slice(0, -2);
    push(s, s + "le");
  }

  // -er → base, +e, or double-consonant collapse  (teacher→teach, safer→safe, runner→run)
  if (w.length > 3 && w.endsWith("er")) {
    const s = w.slice(0, -2);
    push(s, s + "e");
    if (s.length > 1 && s[s.length - 1] === s[s.length - 2])
      push(s.slice(0, -1));                               // runner→run
  }

  // -est → base or +e  (fastest→fast, nicest→nice)
  if (w.length > 4 && w.endsWith("est")) {
    const s = w.slice(0, -3);
    push(s, s + "e");
  }

  // -ing → base, +e, or double-consonant collapse  (teaching→teach, hoping→hope, running→run)
  if (w.length > 4 && w.endsWith("ing")) {
    const s = w.slice(0, -3);
    push(s, s + "e");
    if (s.length > 1 && s[s.length - 1] === s[s.length - 2])
      push(s.slice(0, -1));
  }

  // -ed → base, +e, double-consonant, or -ied→-y  (walked→walk, hoped→hope, stopped→stop, tried→try)
  if (w.length > 3 && w.endsWith("ed")) {
    const s = w.slice(0, -2);
    push(s, s + "e");
    if (s.length > 1 && s[s.length - 1] === s[s.length - 2])
      push(s.slice(0, -1));
    if (w.endsWith("ied")) push(w.slice(0, -3) + "y");   // tried→try
  }

  return candidates;
}

const NUMBER_WORDS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
  "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
  "18": "eighteen", "19": "nineteen", "20": "twenty", "30": "thirty",
  "40": "forty", "50": "fifty", "60": "sixty", "70": "seventy",
  "80": "eighty", "90": "ninety", "100": "hundred", "1000": "thousand",
  "1000000": "million", "1000000000": "billion",
};

// Maps contractions to their full component words so each part can be scored independently.
const CONTRACTIONS: Record<string, string[]> = {
  // to be
  "i'm": ["i", "am"], "you're": ["you", "are"], "he's": ["he", "is"],
  "she's": ["she", "is"], "it's": ["it", "is"], "we're": ["we", "are"],
  "they're": ["they", "are"], "that's": ["that", "is"], "there's": ["there", "is"],
  "what's": ["what", "is"], "who's": ["who", "is"], "here's": ["here", "is"],
  // to have
  "i've": ["i", "have"], "you've": ["you", "have"], "we've": ["we", "have"],
  "they've": ["they", "have"], "i'd": ["i", "would"], "you'd": ["you", "would"],
  "he'd": ["he", "would"], "she'd": ["she", "would"], "we'd": ["we", "would"],
  "they'd": ["they", "would"],
  // will
  "i'll": ["i", "will"], "you'll": ["you", "will"], "he'll": ["he", "will"],
  "she'll": ["she", "will"], "we'll": ["we", "will"], "they'll": ["they", "will"],
  "it'll": ["it", "will"], "that'll": ["that", "will"],
  // negatives (irregular: won't = will + not, can't = can + not)
  "can't": ["can", "not"], "won't": ["will", "not"], "don't": ["do", "not"],
  "doesn't": ["does", "not"], "didn't": ["did", "not"], "isn't": ["is", "not"],
  "aren't": ["are", "not"], "wasn't": ["was", "not"], "weren't": ["were", "not"],
  "hasn't": ["has", "not"], "haven't": ["have", "not"], "hadn't": ["had", "not"],
  "shouldn't": ["should", "not"], "wouldn't": ["would", "not"],
  "couldn't": ["could", "not"], "mustn't": ["must", "not"],
  "mightn't": ["might", "not"], "needn't": ["need", "not"],
  "shan't": ["shall", "not"], "daren't": ["dare", "not"],
  // misc
  "let's": ["let", "us"], "o'clock": ["of", "clock"],
};

// Ordered longest-first so longer prefixes are tried before shorter overlapping ones.
const PREFIXES = ["counter", "under", "inter", "over", "anti", "non", "out", "mis", "pre", "dis", "re", "un"];

function stemPrefix(word: string): string[] {
  const w = word.toLowerCase();
  const candidates: string[] = [];
  for (const p of PREFIXES) {
    // Require at least 3 chars remaining after the prefix to avoid nonsense stems.
    if (w.startsWith(p) && w.length > p.length + 3) {
      candidates.push(w.slice(p.length));
    }
  }
  return candidates;
}

// Contraction suffixes that may appear as bare tokens when the apostrophe
// is an unrecognised variant (e.g. U+FF07) that the tokenizer didn't capture.
// Maps the suffix to the word it should be scored as.
const CONTRACTION_SUFFIXES: Record<string, string> = {
  "ve": "have",   // I've → ve → have
  "re": "are",    // you're → re → are
  "ll": "will",   // they'll → ll → will
  "nt": "not",    // don't → nt → not   (n + 't splits as nt when ' missed)
  "m": "am",      // I'm → m → am
};

// Recursively resolve a word to its most-common base form.
// visited prevents cycles; returns the best {band, rank} found anywhere in the tree.
function getSmart(word: string, visited: Set<string> = new Set()): { band: WordBand; rank: number | null } {
  // Normalize all known apostrophe variants to straight ASCII '
  // so the CONTRACTIONS map always matches.
  const w = word.toLowerCase().replace(/[\u2018\u2019\u02bc\uff07]/g, "'");
  if (visited.has(w) || w.length < 1) return { band: 6 as WordBand, rank: null };
  visited.add(w);

  // Bare contraction suffix — score as its full word instead of as an unknown fragment.
  if (CONTRACTION_SUFFIXES[w]) {
    return getSmart(CONTRACTION_SUFFIXES[w], visited);
  }

  let bestBand = getWordBand(w) as WordBand;
  let bestRank = getWordRank(w);
  if (bestBand === 1) return { band: 1, rank: bestRank };

  const update = (candidate: string) => {
    if (bestBand === 1 || !candidate || candidate.length < 2) return;
    const r = getSmart(candidate, visited);
    if (r.band < bestBand) { bestBand = r.band; bestRank = r.rank; }
  };

  // Contractions → expand to component words (e.g. "shouldn't" → "should" + "not")
  const contractionParts = CONTRACTIONS[w];
  if (contractionParts) {
    for (const part of contractionParts) update(part);
  }

  // Generic apostrophe fallback → score the pre-apostrophe stem (e.g. "car's" → "car")
  const apostropheIdx = w.search(/['']/);
  if (apostropheIdx > 0) update(w.slice(0, apostropheIdx));

  // Plural → singular
  const singular = stemPlural(w);
  if (singular) update(singular);

  // Suffix stripping (one layer — recursion handles the rest)
  for (const c of stemSuffix(w)) update(c);

  // Prefix stripping (one layer — recursion handles the rest)
  for (const c of stemPrefix(w)) update(c);

  return { band: bestBand, rank: bestRank };
}

function getWordBandSmart(word: string): WordBand {
  const digitsOnly = word.replace(/[,]/g, "");
  if (/^\d+$/.test(digitsOnly) && NUMBER_WORDS[digitsOnly]) {
    return getWordBand(NUMBER_WORDS[digitsOnly]);
  }
  return getSmart(word).band;
}

function getWordRankSmart(word: string): number | null {
  const digitsOnly = word.replace(/[,]/g, "");
  if (/^\d+$/.test(digitsOnly) && NUMBER_WORDS[digitsOnly]) {
    return getWordRank(NUMBER_WORDS[digitsOnly]);
  }
  return getSmart(word).rank;
}

// Returns true if the word (or its singular stem) matches anything in the exempt set.
function isWordExempt(word: string, exemptSet: Set<string>): boolean {
  const w = word.toLowerCase();
  if (exemptSet.has(w)) return true;
  const singular = stemPlural(w);
  if (singular && exemptSet.has(singular)) return true;
  return false;
}

function tokenize(text: string, exemptSet: Set<string>) {
  // Match words (with optional contractions/possessives), numbers (with commas),
  // then any other non-whitespace character, then whitespace runs.
  // Apostrophe class covers: straight ' (U+0027), curly ' (U+2018/2019), modifier ʼ (U+02BC), fullwidth ＇ (U+FF07)
  const re = /[a-zA-Z]+(?:[\u0027\u2018\u2019\u02bc\uff07][a-zA-Z]+)?|\d[\d,]*|\S|\s+/g;
  const tokens: Array<{ text: string; band: WordBand; rank: number | null; isPunctuation: boolean; isExempt: boolean }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const part = match[0];
    const isWord = /[a-zA-Z\d]/.test(part);
    const isPunctuation = !isWord;
    let band: WordBand = 1;
    let rank: number | null = null;
    const isExempt = !isPunctuation && exemptSet.size > 0 && isWordExempt(part, exemptSet);
    if (!isPunctuation && !isExempt) {
      const digitsOnly = part.replace(/[,]/g, "");
      if (/^\d+$/.test(digitsOnly) && NUMBER_WORDS[digitsOnly]) {
        band = getWordBand(NUMBER_WORDS[digitsOnly]);
        rank = getWordRank(NUMBER_WORDS[digitsOnly]);
      } else {
        const smart = getSmart(part);
        band = smart.band;
        rank = smart.rank;
      }
    }
    tokens.push({ text: part, band, rank, isPunctuation, isExempt });
  }
  return tokens;
}

function scoreText(words: { text: string; band: WordBand; isPunctuation: boolean; isExempt: boolean }[]) {
  // Exempt words are excluded entirely — they don't pad the score or penalise it.
  const real = words.filter((w) => !w.isPunctuation && !w.isExempt && w.text.replace(/[^a-z]/gi, "").length > 0);
  const total = real.length;
  if (total === 0) return { total: 0, common: 0, uncommon: 0, rare: 0, exempt: 0, score: 100 };
  // common = top 1k–2k (bands 1–2), uncommon = top 3k–10k (bands 3–5), rare = outside top 10k (band 6)
  const common   = real.filter((w) => w.band <= 2).length;
  const uncommon = real.filter((w) => w.band >= 3 && w.band <= 5).length;
  const rare     = real.filter((w) => w.band === 6).length;
  const exempt   = words.filter((w) => w.isExempt).length;
  // Gradient penalty: every band above the top 1k costs something,
  // with words outside the top 10k costing the most.
  const penalty = real.reduce((sum, w) => sum + bandPenalty(w.band), 0);
  // Length damper: a short pitch is judged less harshly than a long essay
  // so one unusual word doesn't disproportionately tank a 30-word sentence.
  const lengthMod = total < 100 ? 0.7 : total < 200 ? 0.85 : 1.0;
  const score = Math.max(0, Math.round(100 - (penalty / total) * 100 * lengthMod));
  return { total, common, uncommon, rare, exempt, score };
}

const DEFAULT_TEXT = "The quick brown fox jumps over the lazy dog.";

const SIMPLIFY_THRESHOLD = 80;

function parsePreserveWords(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getRareWordsForPrompt(tokens: Array<{ text: string; band: WordBand; isPunctuation: boolean; isExempt: boolean }>): string[] {
  const seen = new Set<string>();
  return tokens
    .filter((t) => t.band === 6 && !t.isPunctuation && !t.isExempt)
    .map((t) => t.text)
    .filter((w) => {
      const k = w.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

function buildSimplifyPrompt(
  score: number,
  audienceLabel: string,
  rareWords: string[],
  preserveList: string[],
  text: string,
): string {
  const rareSection = rareWords.length > 0 ? rareWords.join(", ") : "None specifically listed.";
  const preserveSection = preserveList.length > 0 ? preserveList.join(", ") : "None provided.";
  return `Please rewrite the following text to make it easier to read while preserving its meaning, tone, and important details.

Goals:
- Keep the original meaning accurate
- Keep the tone appropriate to the original
- Prefer common, familiar words where possible
- Shorten or simplify long sentences where possible
- Reduce unnecessary jargon
- Improve readability without flattening useful nuance
- If a technical or domain-specific word is necessary, keep it

Current Clarity Score: ${score}/100
Audience Level: ${audienceLabel}

Rare or difficult words detected:
${rareSection}

Words to preserve / do not simplify unless absolutely necessary:
${preserveSection}

Text to revise:
${text}

Please provide:
1. A clearer rewritten version
2. A short bullet list of the biggest clarity improvements you made`;
}

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-900">About Vocabulary Grader</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition text-xl leading-none font-light"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 text-sm text-stone-700">
          <section>
            <h3 className="font-semibold text-stone-900 mb-1.5">What is this?</h3>
            <p className="leading-relaxed">
              Vocabulary Grader scores how accessible your writing is to English speakers.
              Paste any text and every word gets highlighted on a color scale — from common everyday words
              to rare vocabulary that may trip up a general audience. The score reflects how likely an average
              English speaker (not necessarily a native one) is to understand your text without difficulty.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-stone-900 mb-1.5">Where does the word list come from?</h3>
            <p className="leading-relaxed">
              The frequency rankings are based on{" "}
              <a
                href="https://norvig.com/ngrams/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                Peter Norvig's English word frequency corpus
              </a>
              , compiled from a large sample of English text across the web, books, and news. The top 10,000 most
              common words are divided into six bands (top 1k, 2k, 3k, 5k, 10k, and rare). Words outside
              the top 10,000 are treated as "rare" and carry the highest penalty.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-stone-900 mb-2">How to use it</h3>
            <ol className="flex flex-col gap-2.5 list-none">
              {[
                ["1", "Paste your text", "Click the text area and paste (or type) whatever you want to score — an email, essay, slide, job posting, anything."],
                ["2", "Read the highlights", "Each word is colored by rarity. Green = common, yellow = moderately common, orange/red = uncommon, purple-red = rare."],
                ["3", "Check the score", "The number in the top right corner is your clarity score out of 100. Higher means more people can easily understand your text."],
                ["4", "Exempt known terms", "If your audience already knows certain names or jargon (e.g. a brand name, a technical term), add them to the exempt fields so they don't drag your score down."],
                ["5", "Click any word", "Tap a highlighted word to see its exact frequency rank and which band it falls in."],
              ].map(([num, title, desc]) => (
                <li key={num} className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                    style={{ background: "hsl(142,60%,35%)" }}
                  >
                    {num}
                  </span>
                  <div>
                    <span className="font-semibold text-stone-800">{title} — </span>
                    <span className="text-stone-600">{desc}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="bg-stone-50 rounded-xl px-4 py-3 border border-stone-200">
            <h3 className="font-semibold text-stone-800 mb-1">Score guide</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600">
              {[
                ["92 – 100", "Any English speaker"],
                ["85 – 91", "Most English speakers"],
                ["75 – 84", "Fluent speakers"],
                ["62 – 74", "Advanced speakers"],
                ["0 – 61", "Near-native speakers"],
              ].map(([range, label]) => (
                <div key={range} className="flex justify-between gap-2 py-0.5 border-b border-stone-100 last:border-0">
                  <span className="font-mono font-semibold text-stone-700">{range}</span>
                  <span className="text-right">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [inputText, setInputText] = useState(DEFAULT_TEXT);
  const [isDefault, setIsDefault] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [promptCopyFailed, setPromptCopyFailed] = useState(false);

  const [exemptNames, setExemptNames] = useState("");
  const [exemptNouns, setExemptNouns] = useState("");
  const [preserveWords, setPreserveWords] = useState<string>(
    () => {
      try { return localStorage.getItem("cs_preserve_words") ?? ""; }
      catch { return ""; }
    }
  );

  const exemptSet = useMemo(() => {
    const parse = (s: string) =>
      s.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    return new Set([...parse(exemptNames), ...parse(exemptNouns)]);
  }, [exemptNames, exemptNouns]);

  type TooltipInfo = { word: string; band: WordBand; rank: number | null; isExempt: boolean; x: number; y: number };
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem("cs_preserve_words", preserveWords); }
    catch { /* storage unavailable */ }
  }, [preserveWords]);

  useEffect(() => {
    const dismiss = (e: MouseEvent) => {
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) return;
      setTooltip(null);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  // When the default placeholder is showing, don't analyse anything.
  const analysisText = isDefault ? "" : inputText;
  const tokens = useMemo(() => tokenize(analysisText, exemptSet), [analysisText, exemptSet]);
  const { total, common, uncommon, rare, exempt, score } = useMemo(() => scoreText(tokens), [tokens]);

  // Gradient penalty + length damper: good texts land in the high 80s–90s.
  const scoreColor =
    score >= 88 ? "hsl(142,76%,30%)"
    : score >= 78 ? "hsl(68,78%,35%)"
    : score >= 65 ? "hsl(30,88%,38%)"
    : score >= 50 ? "hsl(8,78%,34%)"
    : "hsl(315,65%,28%)";

  const audienceLabel =
    score >= 92 ? "Any English speaker"
    : score >= 85 ? "Most English speakers"
    : score >= 75 ? "Fluent speakers"
    : score >= 62 ? "Advanced speakers"
    : "Near-native speakers";

  const copyScore = () => {
    const lengthMod = total < 100 ? "0.7 (short text)" : total < 200 ? "0.85 (medium text)" : "1.0 (long text)";
    const namesList  = exemptNames.trim()  ? exemptNames.split(",").map(s => s.trim()).filter(Boolean) : [];
    const topicsList = exemptNouns.trim() ? exemptNouns.split(",").map(s => s.trim()).filter(Boolean) : [];
    const lines = [
      `Clarity Score: ${score}/100 — ${audienceLabel}`,
      ``,
      `${common} common    (top 1,000–2,000)`,
      `${uncommon} uncommon  (top 3,000–10,000)`,
      `${rare} rare       (outside top 10,000)`,
      exempt > 0 ? `${exempt} exempt    (excluded from scoring)` : null,
      `${total} total words`,
      namesList.length  > 0 ? `  Exempt names:  ${namesList.join(", ")}` : null,
      topicsList.length > 0 ? `  Exempt topics: ${topicsList.join(", ")}` : null,
      ``,
      `Formula: score = 100 − (word penalties ÷ ${total} words) × 100 × ${lengthMod}`,
      `  Bands: top 1k = 0 penalty · top 2k = 0.15 · top 3k = 0.35`,
      `         top 5k = 0.65 · top 10k = 0.88 · rare = 1.0`,
      `  Length modifier reduces penalties for short texts (<100 words = ×0.7, <200 = ×0.85)`,
      ``,
      `Scored with Vocabulary Grader — joenugent512.github.io/ClarityScore`,
    ].filter((l): l is string => l !== null).join("\n");

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copySimplifyPrompt = () => {
    const rareWords = getRareWordsForPrompt(tokens);
    const preserveList = parsePreserveWords(preserveWords);
    const prompt = buildSimplifyPrompt(score, audienceLabel, rareWords, preserveList, analysisText);
    setPromptCopyFailed(false);
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }).catch(() => {
      setPromptCopyFailed(true);
      setTimeout(() => setPromptCopyFailed(false), 4000);
    });
  };

  // Word frequency bar: green → yellow → orange → dark-red → purple-red
  const gradientCss = [
    "hsl(142,76%,36%)",   // top 1k  – dark green
    "hsl(100,65%,38%)",   // top 2k  – green
    "hsl(68,78%,42%)",    // top 3k  – yellow  (good boundary)
    "hsl(30,88%,44%)",    // top 5k  – orange
    "hsl(8,78%,38%)",     // top 10k – dark red
    "hsl(315,65%,28%)",   // rare    – purple-red
  ].join(", ");

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      <header className="border-b border-stone-200 bg-white px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Vocabulary Grader</h1>
              <p className="text-sm text-stone-500 mt-0.5">
                Highlights words by how common they are in English
              </p>
            </div>
            <button
              onClick={() => setShowInfo(true)}
              className="flex-shrink-0 w-6 h-6 rounded-full border border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition flex items-center justify-center text-xs font-bold leading-none"
              aria-label="About this app"
              title="About & how to use"
            >
              ?
            </button>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-baseline gap-1.5">
              <div
                className="text-3xl font-bold tabular-nums"
                style={{ color: isDefault ? "hsl(0,0%,75%)" : scoreColor }}
                data-testid="score-value"
              >
                {isDefault ? "—" : score}
              </div>
              {!isDefault && <div className="text-xs text-stone-400 uppercase tracking-wide">/ 100</div>}
            </div>
            <div className="text-xs font-semibold" style={{ color: isDefault ? "hsl(0,0%,65%)" : scoreColor }}>
              {isDefault ? "Paste your text to score" : audienceLabel}
            </div>
            {/* Score gradient bar with pointer */}
            <div className="relative w-44">
              {/* Downward triangle marker */}
              <div
                className="absolute"
                style={{
                  left: `${score}%`,
                  top: -6,
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `7px solid ${scoreColor}`,
                }}
              />
              <div
                className="h-3 rounded-full"
                style={{
                  background: `linear-gradient(to right, hsl(315,65%,28%), hsl(8,78%,38%), hsl(30,88%,44%), hsl(68,78%,42%), hsl(100,65%,38%), hsl(142,76%,36%))`,
                }}
              />
              <div className="flex justify-between mt-1 text-xs text-stone-400">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-8">
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Word frequency scale</span>
            <span className="text-xs text-stone-400">Words past 10,000 are penalised</span>
          </div>
          <div
            className="h-4 rounded-full w-full"
            style={{ background: `linear-gradient(to right, ${gradientCss})` }}
          />
          <div className="flex justify-between mt-1.5 text-xs text-stone-500">
            <span>Top 1,000</span>
            <span>Top 3,000</span>
            <span>Top 5,000</span>
            <span>Top 10,000</span>
            <span className="text-red-500 font-medium">Rare</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold text-stone-700">Your text</label>
          <textarea
            data-testid="input-text"
            className={`w-full h-36 resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 transition ${isDefault ? "text-stone-400 italic" : "text-stone-800"}`}
            placeholder="Type or paste your text here…"
            value={inputText}
            onFocus={() => {
              if (isDefault) {
                setInputText("");
                setIsDefault(false);
              }
            }}
            onBlur={() => {
              if (inputText.trim() === "") {
                setInputText(DEFAULT_TEXT);
                setIsDefault(true);
                setExemptNames("");
                setExemptNouns("");
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setInputText(val);
              setIsDefault(false);
              if (val.trim() === "") {
                setExemptNames("");
                setExemptNouns("");
              }
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: "hsla(210,75%,55%,0.35)", border: "1px solid hsla(210,75%,45%,0.5)" }}
                />
                Exempt names
              </label>
              <input
                type="text"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                placeholder="Joe, Alice, …"
                value={exemptNames}
                onChange={(e) => setExemptNames(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: "hsla(210,75%,55%,0.35)", border: "1px solid hsla(210,75%,45%,0.5)" }}
                />
                Exempt topic words
              </label>
              <input
                type="text"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                placeholder="battery, electrode, …"
                value={exemptNouns}
                onChange={(e) => setExemptNouns(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
              Words to preserve
              <span className="normal-case font-normal text-stone-400">(for AI simplify prompt)</span>
            </label>
            <input
              type="text"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
              placeholder="ERDC, PEPR, API, Power Platform, …"
              value={preserveWords}
              onChange={(e) => setPreserveWords(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-stone-700">Highlighted output</span>
            <span className="text-xs text-stone-400 flex items-center gap-2 flex-wrap">
              {!isDefault && total > 0 && score < SIMPLIFY_THRESHOLD && (
                <button
                  onClick={copySimplifyPrompt}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition"
                  style={copiedPrompt
                    ? { background: "hsl(142,60%,92%)", color: "hsl(142,60%,30%)", borderColor: "hsl(142,60%,70%)" }
                    : { background: "hsl(48,95%,95%)", color: "hsl(32,80%,28%)", borderColor: "hsl(40,70%,60%)" }
                  }
                  title="Copy AI simplify prompt to clipboard"
                >
                  {copiedPrompt ? "✓ Copied!" : "Copy AI Simplify Prompt"}
                </button>
              )}
              {!isDefault && total > 0 && (
                <button
                  onClick={copyScore}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition"
                  style={copied
                    ? { background: "hsl(142,60%,92%)", color: "hsl(142,60%,30%)", borderColor: "hsl(142,60%,70%)" }
                    : { background: "white", color: "hsl(0,0%,40%)", borderColor: "hsl(0,0%,80%)" }
                  }
                  title="Copy score summary to clipboard"
                >
                  {copied ? "✓ Copied" : "Copy score"}
                </button>
              )}
              {total} word{total !== 1 ? "s" : ""}
              {exempt > 0 && (
                <span className="font-medium" style={{ color: "hsl(210,70%,45%)" }}>
                  &bull; {exempt} exempt
                </span>
              )}
              <span className="text-red-500 font-medium">&bull; {rare} rare</span>
            </span>
          </div>
          <div
            data-testid="highlighted-output"
            className="min-h-36 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-9 text-stone-800 shadow-inner whitespace-pre-wrap break-words"
          >
            {tokens.length === 0 ? (
              <span className="text-stone-400">Your highlighted text will appear here…</span>
            ) : (
              tokens.map((token, i) => {

                if (token.isPunctuation || /^\s+$/.test(token.text)) {
                  return <span key={i}>{token.text}</span>;
                }
                const exemptStyle = {
                  backgroundColor: "hsla(210,75%,55%,0.18)",
                  color: "hsl(210,70%,30%)",
                  border: "1px solid hsla(210,75%,55%,0.4)",
                };
                const { bg, text } = bandToColor(token.band);
                const style = token.isExempt ? exemptStyle : {
                  backgroundColor: bg,
                  color: text,
                  border: `1px solid ${bg}`,
                };
                return (
                  <span
                    key={i}
                    data-testid={`word-${i}`}
                    style={{
                      ...style,
                      borderRadius: "4px",
                      padding: "1px 3px",
                      display: "inline-block",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTooltip(t =>
                        t?.word === token.text && t?.band === token.band ? null : {
                          word: token.text,
                          band: token.band,
                          rank: token.rank,
                          isExempt: token.isExempt,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        }
                      );
                    }}
                  >
                    {token.text}
                  </span>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 text-sm text-stone-600 shadow-sm">
          <p className="leading-relaxed">
            <span className="font-semibold text-stone-800">How scoring works:</span>{" "}
            Words above the top 1,000 carry a small penalty that grows with rarity — words outside the top 10,000 (shown in{" "}
            <span style={{ color: "hsl(315,55%,35%)" }} className="font-medium">dark purple-red</span>) hurt the most.
            A length damper means a short pitch is judged less harshly than a long essay, so one unusual word won't tank a 30-word sentence.
            A score of <span className="font-semibold">92+</span> means any English speaker should follow easily.{" "}
            <span className="font-semibold">85–91</span> is accessible to most speakers.{" "}
            Below 75, vocabulary is creating real friction for a general audience.{" "}
            <span className="font-semibold text-stone-800">Exempt names and topic words</span>{" "}
            (shown in <span style={{ color: "hsl(210,70%,40%)" }} className="font-medium">blue</span>) are excluded from scoring entirely — use these for proper nouns or technical terms your audience already knows.
          </p>
        </div>
      </main>

      {/* Word tooltip */}
      {tooltip && (() => {
        const { bg, text: textColor } = tooltip.isExempt
          ? { bg: "hsla(210,75%,55%,0.3)", text: "hsl(210,70%,30%)" }
          : bandToColor(tooltip.band);
        return (
          <div
            ref={tooltipRef}
            style={{
              position: "fixed",
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
              zIndex: 50,
              pointerEvents: "auto",
            }}
            className="rounded-lg shadow-xl border border-stone-200 bg-white px-3 py-2.5 text-xs min-w-[160px]"
          >
            {/* Colour chip + word */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: bg }}
              />
              <span className="font-bold text-stone-800 text-sm">{tooltip.word}</span>
            </div>
            {tooltip.isExempt ? (
              <>
                <div className="font-semibold" style={{ color: "hsl(210,70%,40%)" }}>Exempt word</div>
                <div className="text-stone-400 mt-0.5">Not counted in your score</div>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold" style={{ color: textColor === "hsl(0, 0%, 97%)" ? "hsl(315,65%,28%)" : textColor }}>
                    {bandLabel(tooltip.band)}
                  </div>
                  {tooltip.rank !== null && (
                    <div className="text-stone-500 font-mono font-semibold text-xs tabular-nums">
                      #{tooltip.rank.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-stone-400 mt-0.5">
                  {tooltip.rank !== null ? bandRankRange(tooltip.band) : "Not in top 10,000"}
                </div>
              </>
            )}
            {/* tiny caret */}
            <div
              style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid white",
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
