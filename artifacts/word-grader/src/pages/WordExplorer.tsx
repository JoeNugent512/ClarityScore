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

const PAGE_SIZE = 200;

export default function WordExplorer({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [showCheckedOnly, setShowCheckedOnly] = useState(false);
  const [page, setPage] = useState(0);

  const q = search.toLowerCase().trim();

  const { pinnedList, restList } = useMemo(() => {
    if (showCheckedOnly) {
      return { pinnedList: SORTED_WORDS.filter(([w]) => pinned.has(w)), restList: [] as [string, number][] };
    }
    const pinnedList = SORTED_WORDS.filter(([w]) => pinned.has(w));
    const restList = q
      ? SORTED_WORDS.filter(([w]) => w.includes(q) && !pinned.has(w))
      : SORTED_WORDS.filter(([w]) => !pinned.has(w));
    return { pinnedList, restList };
  }, [q, pinned, showCheckedOnly]);

  const usePagination = !q && !showCheckedOnly;
  const totalPages = usePagination ? Math.ceil(restList.length / PAGE_SIZE) : 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleRest = usePagination
    ? restList.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
    : restList;
  const visibleRows = showCheckedOnly ? pinnedList : [...pinnedList, ...visibleRest];

  const rangeStart = usePagination ? safePage * PAGE_SIZE + 1 : 1;
  const rangeEnd = usePagination ? safePage * PAGE_SIZE + visibleRest.length : restList.length;

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const handleCheckedOnly = () => {
    setShowCheckedOnly((v) => !v);
    setPage(0);
  };

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
      visibleRows.forEach(([w]) => next.add(w));
      return next;
    });
  };

  const clearAll = () => {
    setSearch("");
    setPinned(new Set());
    setShowCheckedOnly(false);
    setPage(0);
  };

  const statusText = showCheckedOnly
    ? `${pinnedList.length} checked word${pinnedList.length !== 1 ? "s" : ""}`
    : q
    ? `${restList.length} match${restList.length !== 1 ? "es" : ""} for "${q}"${pinned.size > 0 ? ` · ${pinned.size} checked` : ""}`
    : `${SORTED_WORDS.length.toLocaleString()} words · showing ${rangeStart}–${rangeEnd + (pinnedList.length > 0 && safePage === 0 ? pinnedList.length : 0)}${pinned.size > 0 ? ` · ${pinned.size} checked` : ""}`;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <header className="border-b border-stone-200 bg-white px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
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
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-6 flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            autoFocus
            className="flex-1 min-w-40 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 transition"
            placeholder="Search the 10,000 most common English words…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {pinned.size > 0 && (
            <button
              onClick={handleCheckedOnly}
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

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-stone-400">{statusText}</div>
          {usePagination && totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
              >
                ← Prev
              </button>
              <span className="text-stone-500 tabular-nums">
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          {visibleRows.length === 0 ? (
            <div className="text-sm text-stone-400 text-center py-12">
              {showCheckedOnly
                ? "No words checked yet."
                : `No matches for "${q}" in the top 10,000 words.`}
            </div>
          ) : (
            visibleRows.map(([word, rank], idx) => {
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
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: bg }} />
                  <span className="flex-1 text-sm font-medium text-stone-800">{word}</span>
                  <span className="text-xs text-stone-400 tabular-nums">#{rank.toLocaleString()}</span>
                  <span className="text-xs font-medium w-14 text-right text-stone-400">
                    {rankLabel(rank)}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {usePagination && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 text-xs pb-4">
            <button
              onClick={() => { setPage(0); window.scrollTo(0, 0); }}
              disabled={safePage === 0}
              className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
            >
              ← First
            </button>
            <button
              onClick={() => { setPage((p) => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
              disabled={safePage === 0}
              className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
            >
              ← Prev
            </button>
            <span className="text-stone-500 tabular-nums px-2">
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); window.scrollTo(0, 0); }}
              disabled={safePage >= totalPages - 1}
              className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
            >
              Next →
            </button>
            <button
              onClick={() => { setPage(totalPages - 1); window.scrollTo(0, 0); }}
              disabled={safePage >= totalPages - 1}
              className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
            >
              Last →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
