import type { Item } from "./schemas";

/** Letters of a puzzle word: upper case, without spaces, hyphens or punctuation. */
export const puzzleLetters = (word: string) => [...word.toLocaleUpperCase("cs").replace(/[^\p{L}\p{N}]/gu, "")];

const plain = (letter: string) => letter.normalize("NFD").replace(/\p{M}/gu, "");

// ── Crossword with a secret word (křížovka s tajenkou) ──────────────────────

export type CrosswordRow = { letters: string[]; offset: number; secret: number };

/**
 * Rows shifted so the letters of the secret word line up in one column. Each item's
 * first option names its secret letter; a row whose answer lacks it starts at the column.
 */
export function crossword(items: Item[]) {
  const rows = items.map((item) => {
    const letters = puzzleLetters(item.answer);
    const wanted = puzzleLetters(item.options[0] ?? "")[0] ?? "";
    let secret = letters.indexOf(wanted);
    if (secret < 0 && wanted) secret = letters.findIndex((l) => plain(l) === plain(wanted));
    return { letters, secret };
  });
  const column = Math.max(0, ...rows.map((r) => Math.max(r.secret, 0)));
  const placed: CrosswordRow[] = rows.map((r) => ({ ...r, offset: column - Math.max(r.secret, 0) }));
  const width = Math.max(1, ...placed.map((r) => r.offset + r.letters.length));
  const solution = placed.map((r) => (r.secret >= 0 ? r.letters[r.secret] : "?")).join("");
  return { rows: placed, column, width, solution };
}

// ── Word search (osmisměrka) ────────────────────────────────────────────────

export type WordSearch = { grid: string[][]; placed: { word: string; cells: [number, number][] }[]; missing: string[] };

const EASY: [number, number][] = [
  [0, 1],
  [1, 0],
];
const ALL: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];

function random(seed: number) {
  let state = seed % 2147483647 || 1;
  return () => (state = (state * 48271) % 2147483647) / 2147483647;
}

const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7);

/**
 * A square grid with the words hidden in it, the same for the same words every time.
 * Easy grids (for the youngest) run only left to right and top to bottom.
 */
export function wordSearch(items: Item[], easy: boolean): WordSearch {
  const words = items.map((item) => puzzleLetters(item.prompt)).filter((w) => w.length > 0);
  const directions = easy ? EASY : ALL;
  const longest = Math.max(0, ...words.map((w) => w.length));
  const letters = words.reduce((n, w) => n + w.length, 0);
  // Longest words first: they are the hardest to fit.
  const order = words.map((w, i) => ({ w, i })).sort((a, b) => b.w.length - a.w.length);
  const alphabet = [...new Set(words.flat())];

  for (let size = Math.max(8, longest + 1, Math.ceil(Math.sqrt(letters * (easy ? 2.6 : 2)))); size <= 20; size++) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const rand = random(hash(words.map((w) => w.join("")).join("|")) + size * 101 + attempt);
      const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
      const placed: WordSearch["placed"] = [];
      let ok = true;
      for (const { w } of order) {
        let done = false;
        for (let tries = 0; tries < 300 && !done; tries++) {
          const [dr, dc] = directions[Math.floor(rand() * directions.length)];
          const r0 = Math.floor(rand() * size);
          const c0 = Math.floor(rand() * size);
          const cells: [number, number][] = w.map((_, k) => [r0 + dr * k, c0 + dc * k]);
          const fits = cells.every(
            ([r, c], k) => r >= 0 && c >= 0 && r < size && c < size && (grid[r][c] === "" || grid[r][c] === w[k]),
          );
          if (!fits) continue;
          cells.forEach(([r, c], k) => (grid[r][c] = w[k]));
          placed.push({ word: w.join(""), cells });
          done = true;
        }
        if (!done) {
          ok = false;
          break;
        }
      }
      if (!ok && size < 20) continue;
      for (const row of grid)
        for (let c = 0; c < size; c++) if (row[c] === "") row[c] = alphabet[Math.floor(rand() * alphabet.length)] ?? "A";
      const found = new Set(placed.map((p) => p.word));
      return { grid, placed, missing: words.map((w) => w.join("")).filter((w) => !found.has(w)) };
    }
  }
  return { grid: [], placed: [], missing: words.map((w) => w.join("")) };
}
