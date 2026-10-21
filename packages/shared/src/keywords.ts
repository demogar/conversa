/**
 * Keyword matching for comments and messages.
 *
 * People type the same word in many ways: with or without accents, in any
 * case, with emoji or punctuation glued to it. Both the text and the keywords
 * go through the same normalisation, so "PRECIO!!" matches "precio" and
 * "info 🙏" matches "INFO". Accents are folded only on Latin letters: in other
 * scripts a combining mark changes the word, so it is kept.
 */

const MARK = /\p{M}/u;
const LATIN = /\p{Script=Latin}/u;
const NOT_WORD = /[^\p{L}\p{N}\p{M}]+/gu;

function foldLatinAccents(text: string): string {
  let out = '';
  let previousIsLatin = false;
  for (const char of text.normalize('NFD')) {
    if (MARK.test(char)) {
      if (!previousIsLatin) out += char;
      continue;
    }
    previousIsLatin = LATIN.test(char);
    out += char;
  }
  return out.normalize('NFC');
}

/** Lower-cases, folds Latin accents and reduces everything else to single spaces. */
export function normalizeText(text: string): string {
  return foldLatinAccents(text.normalize('NFKC')).toLowerCase().replace(NOT_WORD, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface KeywordMatch {
  matched: boolean;
  /** The keyword as configured, so logs show what the owner typed. */
  keyword: string | null;
}

const NO_MATCH: KeywordMatch = { matched: false, keyword: null };

/**
 * Returns the first keyword found in `text`. With `wholeWord`, a keyword must
 * not touch another letter or digit, so "info" does not match "information".
 */
export function matchKeywords(
  text: string,
  keywords: readonly string[],
  wholeWord = true,
): KeywordMatch {
  const haystack = normalizeText(text);
  if (!haystack) return NO_MATCH;

  for (const keyword of keywords) {
    const needle = normalizeText(keyword);
    if (!needle) continue;
    if (wholeWord) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`,
        'u',
      );
      if (pattern.test(haystack)) return { matched: true, keyword };
    } else if (haystack.includes(needle)) {
      return { matched: true, keyword };
    }
  }
  return NO_MATCH;
}
