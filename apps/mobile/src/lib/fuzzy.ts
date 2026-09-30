/**
 * fuzzy.ts — forgiving search over a small, fixed set of names.
 *
 * Search was `name.toLowerCase().includes(term)`. That is exact-substring only,
 * and the names people are searching are the worst possible case for it:
 *
 *   "Passport, Immigration and Citizenship Agency"
 *   "Tax Administration Jamaica"
 *   "Kingston & St Andrew Parish Court — Traffic Division"
 *
 * Typed on a phone, one-handed, in a queue. "passpot" found nothing. So did
 * "halfway tree", because the branch is recorded as "Half Way Tree" and a
 * substring test does not know those are the same words. The person concludes
 * the agency is not on Lyne and closes the app.
 *
 * DELIBERATELY NOT A TRIE. The usual answer to fuzzy search is a trie walked
 * with a bounded edit distance, and it is the right answer at a million rows.
 * There are about thirty branches. Scoring every one of them on every keystroke
 * is a few hundred microseconds — far below a frame — and the straightforward
 * version is the one that stays correct when someone edits it in a year. Revisit
 * if this list ever reaches the low thousands; see SCALING.md.
 *
 * Ranking matters as much as matching. A fuzzy hit must never outrank a real
 * one, or typing an exact branch name pushes it below something that merely
 * looks like it.
 */

/** Match quality, best first. Lower sorts earlier. */
export enum MatchRank {
  StartsWith = 0,
  Substring = 1,
  Normalized = 2,
  TokenPrefix = 3,
  Fuzzy = 4,
  None = 99,
}

/**
 * Fold a name to its comparable form: lowercase, accents stripped, everything
 * that is not a letter or digit removed.
 *
 * Removing separators entirely is what makes "halfway tree" match "Half Way
 * Tree", and "st andrew" match "St. Andrew". It also collapses the ampersand in
 * "Kingston & St Andrew", which people type as "and" about half the time.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Split into comparable words, for prefix and per-word typo matching. */
export function tokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Edit distance, abandoned as soon as it exceeds `max`.
 *
 * The bound is the whole point: we never care *how* different two words are,
 * only whether they are within one or two edits. Stopping early turns the
 * common case — comparing against a word that is obviously unrelated — into a
 * couple of comparisons instead of a full matrix.
 *
 * This counts a TRANSPOSITION as one edit, not two (Damerau / optimal string
 * alignment). That is not a refinement, it is the difference between working
 * and not: swapping two adjacent letters is the single most common typing
 * error, and plain Levenshtein charges 2 for it. Measured against the real
 * branch list, "housing trsut" and "credit unoin" both found nothing until
 * this was added — a five-letter word only gets a budget of 1, so the whole
 * query failed on one swapped pair.
 */
export function boundedDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  /* Three rows, because a transposition looks two rows back. */
  let prev2: number[] = new Array(b.length + 1).fill(0);
  let prev: number[] = new Array(b.length + 1);
  let curr: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowBest = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      // Adjacent pair swapped — "trsut" for "trust". One edit, not two.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + cost);
      }
      curr[j] = value;
      if (value < rowBest) rowBest = value;
    }
    /* Every remaining row can only add to the best value on this one, so once
       the whole row is past the bound the answer cannot come back under it. */
    if (rowBest > max) return max + 1;
    const rotate = prev2; prev2 = prev; prev = curr; curr = rotate;
  }
  return prev[b.length];
}

/**
 * How much of a typo to forgive, by word length.
 *
 * Short words get no slack on purpose. At two edits, "taj" is within reach of
 * "tax", "raj" and "tab" at once — the result is noise, and on an acronym-heavy
 * list (TAJ, NHT, PICA, CFC) that noise lands exactly where precision matters.
 */
function allowedEdits(word: string): number {
  if (word.length <= 3) return 0;
  if (word.length <= 6) return 1;
  return 2;
}

/**
 * Score one record against a query. Returns MatchRank.None when it does not
 * match at all.
 *
 * `fields` is every searchable string on the record — branch name, organisation,
 * city, parish. The best rank across all of them wins.
 */
export function rankMatch(query: string, fields: Array<string | null | undefined>): MatchRank {
  const raw = query.trim();
  if (!raw) return MatchRank.None;

  const present = fields.filter((f): f is string => typeof f === 'string' && f.length > 0);
  if (!present.length) return MatchRank.None;

  const qLower = raw.toLowerCase();
  const qNorm = normalize(raw);
  if (!qNorm) return MatchRank.None;
  const qTokens = tokens(raw);

  let best = MatchRank.None;
  const take = (rank: MatchRank) => { if (rank < best) best = rank; };

  for (const field of present) {
    const fLower = field.toLowerCase();

    /* Tier 1 & 2 — what the old behaviour did, kept exactly, so nothing that
       used to be found stops being found or slips down the list. */
    if (fLower.startsWith(qLower)) { take(MatchRank.StartsWith); continue; }
    if (fLower.includes(qLower)) { take(MatchRank.Substring); }

    // Tier 3 — separators removed: "halfway tree" finds "Half Way Tree".
    if (normalize(field).includes(qNorm)) take(MatchRank.Normalized);

    const fTokens = tokens(field);

    /* Tier 4 — every query word begins some word in the field, in any order.
       This is what makes "tax admin" and "admin tax" both find Tax
       Administration Jamaica. */
    if (qTokens.length && qTokens.every(qt => fTokens.some(ft => ft.startsWith(qt)))) {
      take(MatchRank.TokenPrefix);
    }

    /* Tier 5 — the typo tier. Every query word has to land within its edit
       budget of some word in the field. Requiring ALL of them keeps a long
       query from matching on one lucky word. */
    if (qTokens.length) {
      const everyWordClose = qTokens.every(qt => {
        const budget = allowedEdits(qt);
        if (budget === 0) return fTokens.some(ft => ft.startsWith(qt));
        return fTokens.some(ft => boundedDistance(qt, ft, budget) <= budget);
      });
      if (everyWordClose) take(MatchRank.Fuzzy);
    }
  }

  return best;
}

/** Convenience: does this record match at all? */
export function matches(query: string, fields: Array<string | null | undefined>): boolean {
  return rankMatch(query, fields) !== MatchRank.None;
}
