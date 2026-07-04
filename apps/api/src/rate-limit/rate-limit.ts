// The pure rate-limit decision core. State is threaded through (input → output),
// `now` is injected — no I/O, no clock read — so the whole behaviour is a table,
// the test surface. Switches on the policy's algorithm: token bucket (burst-
// tolerant, for run/submit) or fixed window (brute-force, for login).
// See docs/adr/0005-rate-limit-store-seam.md and CONTEXT.md.

type TokenBucketPolicy = {
  algorithm: "token-bucket";
  capacity: number;
  refillPerMin: number;
};
type FixedWindowPolicy = {
  algorithm: "fixed-window";
  limit: number;
  windowMs: number;
};
type Policy = TokenBucketPolicy | FixedWindowPolicy;

type TokenBucketState = { tokens: number; lastRefill: Date };
type FixedWindowState = { count: number; windowStart: Date };
type BucketState = TokenBucketState | FixedWindowState;

type Allowed = { ok: true; remaining: number; resetAt: Date };
type Limited = {
  ok: false;
  status: 429;
  error: string;
  code: "RATE_LIMITED";
  retryAfter: number;
  resetAt: Date;
};
type Decision = Allowed | Limited;

const LIMITED_ERROR = "Too many requests. Please slow down.";

// Reject a misconfigured policy loudly at the call that builds the table, rather
// than silently emitting NaN into HTTP headers when a rate is <= 0.
function assertValidPolicy(policy: Policy): void {
  const bad =
    policy.algorithm === "token-bucket"
      ? policy.capacity <= 0 || policy.refillPerMin <= 0
      : policy.limit <= 0 || policy.windowMs <= 0;
  if (bad) {
    throw new Error(
      `Invalid rate-limit policy: ${JSON.stringify(policy)} — rates must be > 0`,
    );
  }
}

// A fresh client starts unthrottled: a full bucket, or an empty window at `now`.
function initialState(policy: Policy, now: Date): BucketState {
  return policy.algorithm === "token-bucket"
    ? { tokens: policy.capacity, lastRefill: now }
    : { count: 0, windowStart: now };
}

// How long an idle entry stays meaningful — after this it is indistinguishable
// from a fresh entry, so the store may evict it. Token bucket: refill-to-full
// time; fixed window: the window length.
function fullRefillMs(policy: Policy): number {
  return policy.algorithm === "token-bucket"
    ? (policy.capacity / policy.refillPerMin) * 60_000
    : policy.windowMs;
}

function consumeTokenBucket(
  state: TokenBucketState,
  now: Date,
  policy: TokenBucketPolicy,
): { state: TokenBucketState; decision: Decision } {
  const elapsedMs = Math.max(0, now.getTime() - state.lastRefill.getTime());
  const refilled = (elapsedMs / 60_000) * policy.refillPerMin;
  const tokens = Math.min(policy.capacity, state.tokens + refilled);

  if (tokens < 1) {
    const retryAfter = Math.ceil(((1 - tokens) / policy.refillPerMin) * 60);
    return {
      state: { tokens, lastRefill: now },
      decision: {
        ok: false,
        status: 429,
        error: LIMITED_ERROR,
        code: "RATE_LIMITED",
        retryAfter,
        resetAt: new Date(now.getTime() + retryAfter * 1000),
      },
    };
  }

  const next: TokenBucketState = { tokens: tokens - 1, lastRefill: now };
  const secondsToFull = Math.ceil(
    ((policy.capacity - next.tokens) / policy.refillPerMin) * 60,
  );
  return {
    state: next,
    decision: {
      ok: true,
      remaining: Math.floor(next.tokens),
      resetAt: new Date(now.getTime() + secondsToFull * 1000),
    },
  };
}

function consumeFixedWindow(
  state: FixedWindowState,
  now: Date,
  policy: FixedWindowPolicy,
): { state: FixedWindowState; decision: Decision } {
  const expired = now.getTime() >= state.windowStart.getTime() + policy.windowMs;
  const windowStart = expired ? now : state.windowStart;
  const count = expired ? 0 : state.count;
  const resetAt = new Date(windowStart.getTime() + policy.windowMs);

  if (count >= policy.limit) {
    const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
    // a denied request does not increment the window.
    return {
      state: { count, windowStart },
      decision: {
        ok: false,
        status: 429,
        error: LIMITED_ERROR,
        code: "RATE_LIMITED",
        retryAfter,
        resetAt,
      },
    };
  }

  return {
    state: { count: count + 1, windowStart },
    decision: { ok: true, remaining: policy.limit - (count + 1), resetAt },
  };
}

function consume(
  state: BucketState,
  now: Date,
  policy: Policy,
): { state: BucketState; decision: Decision } {
  return policy.algorithm === "token-bucket"
    ? consumeTokenBucket(state as TokenBucketState, now, policy)
    : consumeFixedWindow(state as FixedWindowState, now, policy);
}

export { consume, initialState, fullRefillMs, assertValidPolicy };
export type { Policy, BucketState, Decision, Allowed, Limited };
