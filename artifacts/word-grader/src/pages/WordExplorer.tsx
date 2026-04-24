import { useState, useMemo } from "react";
import { WORD_RANK_MAP, bandToColor, WordBand } from "@/data/wordFrequency";

function rankToBand(rank: number): WordBand {
  if (rank <= 1000) return 1 as WordBand;
  if (rank <= 2000) return 2 as WordBand;
  if (rank <= 3000) return 3 as WordBand;
  if (rank <= 5000) return 4 as WordBand;
  return 5 as WordBand;
}

function rankLabel(rank: number): string {
  if (rank <= 1000) return "Top 1k";
  if (rank <= 2000) return "Top 2k";
  if (rank <= 3000) return "Top 3k";
  if (rank <= 5000) return "Top 5k";
  return "Top 10k";
}

const SORTED_WORDS: [string, number][] = Array.from(WORD_RANK_MAP.entries()).sort(
  (a, b) => a[1] - b[1],
);

const MAX_RESULTS = 300;

export default function WordExplorer({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [showCheckedOnly, setShowCheckedOnly] = useState(false);

  const q = search.toLowerCase().trim();

  const { rows, totalMatches } = useMemo(() => {
    if (showCheckedOnly) {
      const rows = SORTED_WORDS.filter(([w]) => pinned.has(w));
      return { rows, totalMatches: rows.length };
    }
    const pinnedList = SORTED_WORDS.filter(([w]) => pinned.has(w));
    if (!q) {
      const top = SORTED_WORDS.filter(([w]) => !pinned.has(w)).slice(0, MAX_RESULTS);
      return { rows: [...pinnedList, ...top], totalMatches: SORTED_WORDS.length - pinned.size };
    }
    const allMatches = SORTED_WORDS.filter(([w]) => w.includes(q) && !pinned.has(w));
    return {
      rows: [...pinnedList, ...allMatches.slice(0, MAX_RESULTS)],
      totalMatches: allMatches.length,
    };
  }, [q, pinned, showCheckedOnly]);

  const togglePin = (word: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const checkAllVisible = () => {
    setPinned((prev) => {
      const next = new Set(prev);
      rows.forEach(([w]) => next.add(w));
      return next;
    });
  };

  const clearAll = () => {
    setSearch("");
    setPinned(new Set());
    setShowCheckedOnly(false);
  };

  const statusText = showCheckedOnly
    ? `${pinned.size} checked word${pinned.size !== 1 ? "s" : ""}`
    : q
    ? totalMatches > MAX_RESULTS
      ? `Showing first ${MAX_RESULTS} of ${totalMatches} matches for "${q}"${pinned.size > 0 ? ` · ${pinned.size} checked` : ""}`
      : `${totalMatches} match${totalMatches !== 1 ? "es" : ""} for "${q}"${pinned.size > 0 ? ` · ${pinned.size} checked` : ""}`
    : `Showing top ${Math.min(MAX_RESULTS, SORTED_WORDS.length - pinned.size)} words — search to filter${pinned.size > 0 ? ` · ${pinned.size} checked` : ""}`;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <header className="border-b border-stone-200 bg-white px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-stone-500 hover:text-stone-800 transition text-sm flex items-center gap-1 font-medium"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Word Explorer</h1>
              <p className="text-sm text-stone-500 mt-0.5">
                Browse and compare frequency rankings for the top 10,000 words
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-6 flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            autoFocus
            className="flex-1 min-w-40 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 transition"
            placeholder="Search the 10,000 most common English words…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {pinned.size > 0 && (
            <button
              onClick={() => setShowCheckedOnly((v) => !v)}
              className="px-3 py-2 rounded-xl border text-xs font-semibold transition whitespace-nowrap"
              style={
                showCheckedOnly
                  ? { background: "hsl(142,60%,92%)", color: "hsl(142,60%,30%)", borderColor: "hsl(142,60%,70%)" }
                  : { background: "white", color: "hsl(0,0%,35%)", borderColor: "hsl(0,0%,78%)" }
              }
            >
              {showCheckedOnly ? "✓ Checked only" : "Show checked only"}
            </button>
          )}
          <button
            onClick={checkAllVisible}
            className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-600 hover:bg-stone-100 transition whitespace-nowrap"
          >
            Check all
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-600 hover:bg-stone-100 transition whitespace-nowrap"
          >
            Clear all
          </button>
        </div>

        <div className="text-xs text-stone-400">{statusText}</div>

        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          {rows.length === 0 ? (
            <div className="text-sm text-stone-400 text-center py-12">
              {showCheckedOnly ? "No words checked yet." : `No matches for "${q}" in the top 10,000 words.`}
            </div>
          ) : (
            rows.map(([word, rank], idx) => {
              const band = rankToBand(rank);
              const { bg } = bandToColor(band);
              const isPinned = pinned.has(word);
              return (
                <label
                  key={word}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-stone-50 transition-colors"
                  style={{
                    borderTop: idx === 0 ? "none" : "1px solid hsl(0,0%,93%)",
                    background: isPinned ? "hsl(0,0%,98%)" : undefined,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={() => togglePin(word)}
                    className="w-4 h-4 cursor-pointer flex-shrink-0"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: bg }}
                  />
                  <span className="flex-1 text-sm font-medium text-stone-800">{word}</span>
                  <span className="text-xs text-stone-400 tabular-nums">#{rank.toLocaleString()}</span>
                  <span
                    className="text-xs font-medium w-14 text-right"
                    style={{ color: bg === "hsl(142,76%,36%)" ? "hsl(142,60%,35%)" : "hsl(0,0%,50%)" }}
                  >
                    {rankLabel(rank)}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
