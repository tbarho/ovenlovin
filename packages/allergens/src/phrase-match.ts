/**
 * Case-insensitive word/phrase matching with simple English plural tolerance.
 *
 * Used for allergen mapping against raw ingredient lines, custom / ingredient /
 * diet rule targets, and Loves ranking. Compound-food exclusions (olive vs
 * olive oil) apply unless callers opt out.
 */

import { compoundsExcludingPhrase } from "./compound-foods";

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

export function tokenSequenceStarts(haystack: string[], needle: string[]): number[] {
  if (needle.length === 0 || haystack.length === 0 || needle.length > haystack.length) {
    return [];
  }
  const starts: number[] = [];
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) starts.push(i);
  }
  return starts;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** True when this occurrence of `phrase` is only part of a different compound food. */
export function occurrenceIsCompoundFood(phrase: string, line: string, start: number): boolean {
  const needle = phraseTokens(phrase);
  const haystack = phraseTokens(line);
  const compounds = compoundsExcludingPhrase(phrase);
  if (needle.length === 0 || compounds.length === 0) return false;

  for (const compound of compounds) {
    const compoundTokens = phraseTokens(compound);
    if (compoundTokens.length === 0) continue;
    for (const compoundStart of tokenSequenceStarts(haystack, compoundTokens)) {
      if (
        rangesOverlap(
          start,
          start + needle.length,
          compoundStart,
          compoundStart + compoundTokens.length
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Token starts where `phrase` appears as a contiguous word/phrase in `line`,
 * after compound-food exclusions (olive vs olive oil).
 */
export function findPhraseStarts(
  phrase: string,
  line: string,
  options: { ignoreCompoundFoods?: boolean } = {}
): number[] {
  const needle = phraseTokens(phrase);
  const haystack = phraseTokens(line);
  return tokenSequenceStarts(haystack, needle).filter(
    (start) => options.ignoreCompoundFoods || !occurrenceIsCompoundFood(phrase, line, start)
  );
}

/**
 * True when `phrase` appears as a contiguous word/phrase in `line`.
 * "mushroom" matches "8 oz mushrooms, sliced"; "pine nut" matches "pine nuts".
 * "olive" does not match "olive oil".
 */
export function phraseMatchesLine(
  phrase: string,
  line: string,
  options: { ignoreCompoundFoods?: boolean } = {}
): boolean {
  return findPhraseStarts(phrase, line, options).length > 0;
}

export function phraseMatchesAny(phrase: string, lines: Iterable<string>): boolean {
  for (const line of lines) {
    if (phraseMatchesLine(phrase, line)) return true;
  }
  return false;
}
