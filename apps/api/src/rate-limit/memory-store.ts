// In-memory RateLimitStore: the current default, single-process. Race-free
// without atomic scripts because the adapter's read-modify-write runs
// synchronously with no `await` between get and set — the single-threaded
// runtime makes the sequence atomic. A Redis adapter (multi-server) is the
// documented, unbuilt future. See docs/adr/0005-rate-limit-store-seam.md.
import type { BucketState } from "./rate-limit.ts";

// A store entry expires when its bucket has fully refilled — at that point it is
// indistinguishable from a fresh full bucket, so it carries no information and is
// safe to evict (lazy on get, plus a periodic sweep). expiresAt is supplied by
// the adapter, which knows the policy's full-refill time.
interface RateLimitStore {
  get(key: string, now: Date): BucketState | undefined;
  set(key: string, state: BucketState, expiresAt: Date): void;
  sweep(now: Date): void;
}

function createMemoryStore(): RateLimitStore {
  const entries = new Map<string, { state: BucketState; expiresAt: Date }>();

  return {
    get(key, now) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (now.getTime() >= entry.expiresAt.getTime()) {
        entries.delete(key);
        return undefined;
      }
      return entry.state;
    },
    set(key, state, expiresAt) {
      entries.set(key, { state, expiresAt });
    },
    sweep(now) {
      for (const [key, entry] of entries) {
        if (now.getTime() >= entry.expiresAt.getTime()) entries.delete(key);
      }
    },
  };
}

export { createMemoryStore };
export type { RateLimitStore };
