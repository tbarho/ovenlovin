/**
 * Case-insensitive word/phrase matching with simple English plural tolerance.
 *
 * Used for custom / ingredient / diet rule targets and for Loves ranking.
 * Allergen checking still uses the taxonomy mapper — do not route peanut /
 * tree-nut safety through this helper.
 */

export function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stemWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
  if (
    (word.endsWith("ses") ||
      word.endsWith("xes") ||
      word.endsWith("zes") ||
      word.endsWith("ches") ||
      word.endsWith("shes")) &&
    word.length > 4
  ) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function phraseTokens(value: string): string[] {
  return normalizePhrase(value).split(" ").filter(Boolean).map(stemWord);
}

/**
 * True when `phrase` appears as a contiguous word/phrase in `line`.
 * "mushroom" matches "8 oz mushrooms, sliced"; "pine nut" matches "pine nuts".
 */
export function phraseMatchesLine(phrase: string, line: string): boolean {
  const needle = phraseTokens(phrase);
  const haystack = phraseTokens(line);
  if (needle.length === 0 || haystack.length === 0) return false;
  if (needle.length > haystack.length) return false;

  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export function phraseMatchesAny(phrase: string, lines: Iterable<string>): boolean {
  for (const line of lines) {
    if (phraseMatchesLine(phrase, line)) return true;
  }
  return false;
}
