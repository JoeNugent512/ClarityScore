import { useState, useMemo } from "react";
import { WORD_RANK_MAP, bandToColor, WordBand } from "@/data/wordFrequency";

function rankToBand(rank: number): WordBand {
  if (rank <= 1000) return 1 as WordBand;
  if (rank <= 2000) return 2 as WordBand;
  if (rank <= 3000) return 3 as WordBand;
  if (rank <= 5000) return 4 as WordBand;
  return 5 as WordBand;
}

const SORTED_WORDS: [string, number][] = Array.from(WORD_RANK_MAP.entries()).sort(
  (a, b) => a[1] - b[1],
);

const MAX_RESULTS = 300;

export default function WordExplorer({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  const q = search.toLowerCase().trim();

  const { pinnedList, matchList, totalMatches } = useMemo(() => {
    const pinnedList = SORTED_WORDS.filter(([w]) => pinned.has(w));
    if (!q) {
      const top = SORTED_WORDS.filter(([w]) => !pinned.has(w)).slice(0, MAX_RESULTS);
      return { pinnedList, matchList: top, totalMatches: SORTED_WORDS.length - pinned.size };
    }
    const allMatches = SORTED_WORDS.filter(([w]) => w.includes(q) && !pinned.has(w));
    return { pinnedList, matchList: allMatches.slice(0, MAX_RESULTS), totalMatches: allMatches.length };
  }, [q, pinned]);

  const visible = [...pinnedList, ...matchList];

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
      visible.forEach(([w]) => next.add(w));
      return next;
    });
  };

  const clearAll = () => {
    setSearch("");
    setPinned(new Set());
  };

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
          {pinned.size > 0 && (
            <div className="text-xs text-stone-400 tabular-nums">
              {pinned.size} checked
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-6 flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 transition"
            placeholder="Search within the 10,000 most common words…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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

        <div className="text-xs text-stone-400">
          {q
            ? totalMatches > MAX_RESULTS
              ? `Showing first ${MAX_RESULTS} of ${totalMatches} matches for "${q}"`
              : `${totalMatches} match${totalMatches !== 1 ? "es" : ""} for "${q}"`
            : `Showing top ${Math.min(MAX_RESULTS, SORTED_WORDS.length - pinned.size)} words — search to filter`}
          {pinned.size > 0 && ` · ${pinned.size} checked`}
        </div>

        <div className="flex flex-wrap gap-2">
          {visible.map(([word, rank]) => {
            const band = rankToBand(rank);
            const { bg, text: textColor } = bandToColor(band);
            const isPinned = pinned.has(word);
            return (
              <label
                key={word}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all select-none"
                style={{
                  background: bg,
                  color: textColor,
                  outline: isPinned ? "2px solid rgba(0,0,0,0.5)" : "none",
                  outlineOffset: "1px",
                }}
              >
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={() => togglePin(word)}
                  className="w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                />
                <span className="text-sm font-medium">{word}</span>
                <span className="text-xs opacity-60 tabular-nums">#{rank.toLocaleString()}</span>
              </label>
            );
          })}
        </div>

        {visible.length === 0 && q && (
          <div className="text-sm text-stone-400 text-center py-12">
            No matches for "{q}" in the top 10,000 words.
          </div>
        )}
      </main>
    </div>
  );
}
