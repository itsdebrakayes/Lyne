/**
 * trn.ts — find a Taxpayer Registration Number in recognised text.
 *
 * A TRN is nine digits, usually printed 123-456-789 or 123 456 789, beside a
 * "TRN" or "Taxpayer Registration Number" label. Recognisers also read a
 * printed 0 as O, 1 as I or l, 5 as S and 8 as B now and then, so a run that
 * is almost all digits is repaired before it is judged.
 *
 * Returns the number formatted 123-456-789, or null when there is no single
 * convincing candidate. Null is an answer, not a failure: the screen tells the
 * person the photo could not be read and offers a retake or typing it in,
 * rather than guessing and pre-filling the wrong number.
 */

const LABEL = /\b(T\s*R\s*N|TAX\s*PAYER|TAXPAYER|REGISTRATION\s*(NO|NUMBER|#))\b/i;
const CONFUSABLE: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', i: '1', S: '5', s: '5', B: '8', Z: '2', z: '2', G: '6' };

// Nine characters in three groups, optionally separated; groups may hold a
// confusable letter, which repair() turns back into a digit.
const CANDIDATE = /(?<![\dA-Za-z])([\dOoDQIl|iSsBZzG]{3})[\s.\-–—]?([\dOoDQIl|iSsBZzG]{3})[\s.\-–—]?([\dOoDQIl|iSsBZzG]{3})(?![\dA-Za-z])/g;

function repair(chars: string): string | null {
  const fixed = chars.split('').map(c => (/\d/.test(c) ? c : CONFUSABLE[c] ?? '')).join('');
  if (fixed.length !== 9) return null;
  // Mostly digits already; a run of letters is a word, not a misread number.
  const digits = chars.replace(/\D/g, '').length;
  return digits >= 7 ? fixed : null;
}

export function formatTrn(digits: string): string {
  const d = digits.replace(/\D/g, '');
  return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

export function isValidTrn(value: string): boolean {
  return /^\d{9}$/.test(value.replace(/[\s-]/g, ''));
}

export function extractTrn(lines: string[]): string | null {
  const found: Array<{ value: string; labelled: boolean }> = [];
  lines.forEach((line, i) => {
    const nearLabel = LABEL.test(line) || (i > 0 && LABEL.test(lines[i - 1]));
    for (const m of line.matchAll(CANDIDATE)) {
      const value = repair(m[1] + m[2] + m[3]);
      if (value) found.push({ value, labelled: nearLabel });
    }
  });
  if (!found.length) return null;

  const labelled = [...new Set(found.filter(f => f.labelled).map(f => f.value))];
  if (labelled.length === 1) return formatTrn(labelled[0]);
  if (labelled.length > 1) return null; // two different numbers beside the label: do not guess

  const all = [...new Set(found.map(f => f.value))];
  return all.length === 1 ? formatTrn(all[0]) : null;
}
