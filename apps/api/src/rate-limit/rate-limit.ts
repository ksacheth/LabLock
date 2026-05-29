// The pure rate-limit decision core. State is threaded through (input → output),
// `now` is injected — no I/O, no clock read — so the whole behaviour is a table,
// the test surface. See docs/adr/0005-rate-limit-store-seam.md and CONTEXT.md.

type TokenBucketPolicy = {
  algorithm: "token-bucket";
  capacity: number;
  refillPerMin: number;
};

type Policy = TokenBucketPolicy;

type BucketState = {
  tokens: number;
  lastRefill: Date;
};

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

// A fresh client starts with a full bucket.
function initialState(policy: Policy, now: Date): BucketState {
  return { tokens: policy.capacity, lastRefill: now };
}

// How long an idle bucket takes to refill to capacity — after this it is
// indistinguishable from a fresh full bucket, so the store may evict it.
function fullRefillMs(policy: Policy): number {
  return (policy.capacity / policy.refillPerMin) * 60_000;
}

function consume(
  state: BucketState,
  now: Date,
  policy: Policy,
): { state: BucketState; decision: Decision } {
  const elapsedMs = Math.max(0, now.getTime() - state.lastRefill.getTime());
  const refilled = (elapsedMs / 60_000) * policy.refillPerMin;
  const tokens = Math.min(policy.capacity, state.tokens + refilled);

  if (tokens < 1) {
    // seconds until one token accrues at the refill rate.
    const retryAfter = Math.ceil(((1 - tokens) / policy.refillPerMin) * 60);
    const resetAt = new Date(now.getTime() + retryAfter * 1000);
    // a denied request consumes nothing; keep the accrued tokens.
    return {
      state: { tokens, lastRefill: now },
      decision: {
        ok: false,
        status: 429,
        error: "Too many requests. Please slow down.",
        code: "RATE_LIMITED",
        retryAfter,
        resetAt,
      },
    };
  }

  const next: BucketState = { tokens: tokens - 1, lastRefill: now };
  // resetAt = when the bucket refills back to capacity from here.
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

export { consume, initialState, fullRefillMs };
export type { Policy, BucketState, Decision, Allowed, Limited };
