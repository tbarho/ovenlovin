/**
 * Small in-memory LRU. A Map keeps insertion order, so re-inserting on read
 * moves a key to the end and the first key is always the least recently used.
 * Every operation is O(1). Values must not be `undefined` (it means a miss).
 */
export class LruCache<K, V> {
  private readonly entries = new Map<K, V>();
  private hitCount = 0;
  private missCount = 0;

  constructor(readonly maxEntries: number) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError(`LruCache maxEntries must be a positive integer, got ${maxEntries}`);
    }
  }

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) {
      this.missCount++;
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, value);
    this.hitCount++;
    return value;
  }

  /** Membership only: does not refresh recency or count as a hit or miss. */
  has(key: K): boolean {
    return this.entries.has(key);
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value as K);
    }
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  stats() {
    return {
      size: this.entries.size,
      maxEntries: this.maxEntries,
      hits: this.hitCount,
      misses: this.missCount,
    };
  }
}
