// The Express adapter over the pure `consume` decision, mirroring the
// authorizeRequest / openSession idiom: it does the synchronous read-modify-write
// against the store and returns a boolean (true ⇒ allowed; false ⇒ limited, 429
// already sent). It owns the rate-limit headers, the `rate_limit.exceeded` event,
// and fail-open. See docs/adr/0005-rate-limit-store-seam.md.
import type { Request, Response } from "express";
import { logApiEvent } from "../lib/logging.ts";
import { consume, fullRefillMs, initialState } from "./rate-limit.ts";
import { createMemoryStore, type RateLimitStore } from "./memory-store.ts";
import { POLICIES, type KeyContext, type PolicyName } from "./policies.ts";

// One process-wide store. In-memory today; a Redis-backed store is the documented
// multi-server future. A periodic sweep bounds memory against key churn; unref so
// it never keeps the process alive. Injected via a default parameter (like
// judge(..., runner = hostRunner)) so tests can pass a fake.
const defaultStore = createMemoryStore();
const sweepTimer = setInterval(() => defaultStore.sweep(new Date()), 60_000);
(sweepTimer as { unref?: () => void }).unref?.();

function secondsUntil(when: Date, now: Date): number {
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / 1000));
}

function rateLimitRequest(
  req: Request,
  res: Response,
  policyName: PolicyName,
  store: RateLimitStore = defaultStore,
): boolean {
  try {
    const policy = POLICIES[policyName];
    const body = req.body as { email?: unknown } | undefined;
    const ctx: KeyContext = {
      userId: req.userId ?? undefined,
      ip: typeof req.ip === "string" ? req.ip : undefined,
      email: typeof body?.email === "string" ? body.email : undefined,
    };
    const key = policy.key(ctx);
    const now = new Date();

    // Synchronous read-modify-write — no `await` between get and set. This is
    // what makes the in-memory store race-free without an atomic script; do not
    // introduce an await into this critical section.
    const current = store.get(key, now) ?? initialState(policy, now);
    const { state: next, decision } = consume(current, now, policy);
    store.set(key, next, new Date(now.getTime() + fullRefillMs(policy)));

    res.setHeader("RateLimit-Reset", secondsUntil(decision.resetAt, now));

    if (!decision.ok) {
      res.setHeader("RateLimit-Remaining", 0);
      res.setHeader("Retry-After", decision.retryAfter);
      logApiEvent("rate_limit.exceeded", {
        policy: policyName,
        key,
        retryAfter: decision.retryAfter,
      });
      res.status(decision.status).json({
        error: decision.error,
        code: decision.code,
      });
      return false;
    }

    res.setHeader("RateLimit-Remaining", decision.remaining);
    return true;
  } catch (error) {
    // Fail-open: never block a student because the limiter itself threw.
    logApiEvent("rate_limit.error", {
      policy: policyName,
      message: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

export { rateLimitRequest };
