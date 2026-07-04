import { test, expect } from "bun:test";
import { consume, type Policy } from "../rate-limit.ts";

// run policy from ADR-0005 / #35: token bucket, capacity 10, refill 10/min.
const runPolicy: Policy = {
  algorithm: "token-bucket",
  capacity: 10,
  refillPerMin: 10,
};

test("a full bucket allows the request and decrements remaining", () => {
  const now = new Date("2026-07-04T00:00:00.000Z");
  const state = { tokens: 10, lastRefill: now };

  const { state: next, decision } = consume(state, now, runPolicy);

  expect(decision.ok).toBe(true);
  if (decision.ok) expect(decision.remaining).toBe(9);
  expect(next.tokens).toBe(9);
});

test("tokens accrue with elapsed time at the refill rate", () => {
  const drainedAt = new Date("2026-07-04T00:00:00.000Z");
  const state = { tokens: 0, lastRefill: drainedAt };
  // 30s later at 10/min → 5 tokens accrued, one consumed → 4 remaining.
  const now = new Date("2026-07-04T00:00:30.000Z");

  const { state: next, decision } = consume(state, now, runPolicy);

  expect(decision.ok).toBe(true);
  if (decision.ok) expect(decision.remaining).toBe(4);
  expect(next.tokens).toBe(4);
});

test("an allow reports resetAt as the time the bucket refills to full", () => {
  const now = new Date("2026-07-04T00:00:00.000Z");
  const state = { tokens: 10, lastRefill: now };

  const { decision } = consume(state, now, runPolicy);

  // after consuming one, 9 remain; refilling 1 token at 10/min takes 6s.
  expect(decision.ok).toBe(true);
  if (decision.ok) {
    expect(decision.resetAt).toEqual(new Date("2026-07-04T00:00:06.000Z"));
  }
});

test("an empty bucket denies with 429 and a retry-after", () => {
  const now = new Date("2026-07-04T00:00:00.000Z");
  const state = { tokens: 0, lastRefill: now };

  const { state: next, decision } = consume(state, now, runPolicy);

  expect(decision.ok).toBe(false);
  if (!decision.ok) {
    expect(decision.status).toBe(429);
    expect(decision.code).toBe("RATE_LIMITED");
    // at 10 tokens/min, one token accrues in 6s.
    expect(decision.retryAfter).toBe(6);
    expect(decision.resetAt).toEqual(new Date("2026-07-04T00:00:06.000Z"));
  }
  // a denied request consumes nothing.
  expect(next.tokens).toBe(0);
});

test("refill never exceeds capacity", () => {
  const drainedAt = new Date("2026-07-04T00:00:00.000Z");
  const state = { tokens: 3, lastRefill: drainedAt };
  // an hour later would accrue far past capacity — clamp at 10, minus one.
  const now = new Date("2026-07-04T01:00:00.000Z");

  const { decision } = consume(state, now, runPolicy);

  expect(decision.ok).toBe(true);
  if (decision.ok) expect(decision.remaining).toBe(9);
});
