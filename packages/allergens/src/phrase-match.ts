/**
 * Case-insensitive word/phrase matching with simple English plural tolerance.
 *
 * Used for allergen mapping against raw ingredient lines, custom / ingredient /
 * diet rule targets, and Loves ranking. Compound-food exclusions (olive vs
 * olive oil) apply unless callers opt out.
 */

import { compoundsExcludingPhrase, falseFriendCompounds } from "./compound-foods";

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

export type PhraseMatchOptions = {
  ignoreCompoundFoods?: boolean;
  ignoreFalseFriends?: boolean;
  ignoreNegation?: boolean;
};

function phraseTokenKey(phrase: string): string {
  return phraseTokens(phrase).join(" ");
}

/** Multi-word allergen phrases (almond extract, pine nut) used to bind X-free / free of X. */
const negationCompounds: string[][] = [];
const seenNegationCompounds = new Set<string>();

export function registerNegationCompounds(phrases: Iterable<string>): void {
  for (const phrase of phrases) {
    const tokens = phraseTokens(phrase);
    if (tokens.length < 2) continue;
    const key = tokens.join("\0");
    if (seenNegationCompounds.has(key)) continue;
    seenNegationCompounds.add(key);
    negationCompounds.push(tokens);
  }
}

function spanIsNegated(haystack: string[], start: number, end: number): boolean {
  if (haystack[end] === "free") return true;
  const before = haystack[start - 1];
  if (before === "no" || before === "without") return true;
  if (before === "of" && haystack[start - 2] === "free") return true;
  if (before === "from" && haystack[start - 2] === "free") return true;
  return false;
}

let cachedHaystackKey = "";
let cachedNegatedRanges: Array<[number, number]> = [];

function negatedCompoundRanges(haystack: string[]): Array<[number, number]> {
  const key = haystack.join("\0");
  if (key === cachedHaystackKey) return cachedNegatedRanges;
  const ranges: Array<[number, number]> = [];
  for (const compound of negationCompounds) {
    for (const start of tokenSequenceStarts(haystack, compound)) {
      const end = start + compound.length;
      if (spanIsNegated(haystack, start, end)) ranges.push([start, end]);
    }
  }
  cachedHaystackKey = key;
  cachedNegatedRanges = ranges;
  return ranges;
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

/** True when this occurrence sits inside a false-friend compound (butternut squash, water chestnut). */
export function occurrenceIsFalseFriend(phrase: string, line: string, start: number): boolean {
  const needle = phraseTokens(phrase);
  const haystack = phraseTokens(line);
  if (needle.length === 0) return false;
  const phraseKey = phraseTokenKey(phrase);

  for (const entry of falseFriendCompounds) {
    const compoundTokens = phraseTokens(entry.compound);
    if (compoundTokens.length === 0) continue;
    for (const compoundStart of tokenSequenceStarts(haystack, compoundTokens)) {
      if (
        !rangesOverlap(
          start,
          start + needle.length,
          compoundStart,
          compoundStart + compoundTokens.length
        )
      ) {
        continue;
      }
      if (!entry.suppress || entry.suppress.length === 0) return true;
      if (entry.suppress.some((item) => phraseTokenKey(item) === phraseKey)) return true;
    }
  }
  return false;
}

/** True when this occurrence is "X-free", "free of X", "no X", or "without X". */
export function occurrenceIsNegated(phrase: string, line: string, start: number): boolean {
  const needle = phraseTokens(phrase);
  const haystack = phraseTokens(line);
  if (needle.length === 0) return false;
  const end = start + needle.length;
  if (spanIsNegated(haystack, start, end)) return true;
  for (const [rangeStart, rangeEnd] of negatedCompoundRanges(haystack)) {
    if (rangesOverlap(start, end, rangeStart, rangeEnd)) return true;
  }
  return false;
}

function shouldKeepOccurrence(
  phrase: string,
  line: string,
  start: number,
  options: PhraseMatchOptions
): boolean {
  if (!options.ignoreCompoundFoods && occurrenceIsCompoundFood(phrase, line, start)) return false;
  if (!options.ignoreFalseFriends && occurrenceIsFalseFriend(phrase, line, start)) return false;
  if (!options.ignoreNegation && occurrenceIsNegated(phrase, line, start)) return false;
  return true;
}

/**
 * Token starts where `phrase` appears as a contiguous word/phrase in `line`,
 * after compound-food exclusions (olive vs olive oil), false friends, and
 * "X-free" / "free of X" / "no X" / "without X" negation (including multi-word
 * allergen phrases such as almond extract-free).
 */
export function findPhraseStarts(
  phrase: string,
  line: string,
  options: PhraseMatchOptions = {}
): number[] {
  const needle = phraseTokens(phrase);
  const haystack = phraseTokens(line);
  return tokenSequenceStarts(haystack, needle).filter((start) =>
    shouldKeepOccurrence(phrase, line, start, options)
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
  options: PhraseMatchOptions = {}
): boolean {
  return findPhraseStarts(phrase, line, options).length > 0;
}

export function phraseMatchesAny(phrase: string, lines: Iterable<string>): boolean {
  for (const line of lines) {
    if (phraseMatchesLine(phrase, line)) return true;
  }
  return false;
}
