# rate-limit — throttling seam

## Purpose

Per-surface request throttling (ADR-0005). Pieces:

- `rate-limit.ts` — pure token-bucket core: `consume(state, now, policy) → {state, decision}`.
- `policies.ts` — one-row-per-surface policy table (currently only `run` is wired;
  `submit`/`login` rows are documented in ADR-0005 but not yet present).
- `memory-store.ts` — in-memory `Map`-backed `RateLimitStore` (single-process; lazy +
  periodic eviction).
- `rate-limit-request.ts` — Express adapter (`rateLimitRequest`): extracts key, consumes,
  sets `RateLimit-*` / `Retry-After` headers.

## Ownership

Owns rate-limit policy and enforcement. A distributed store (e.g. Redis) would be a new
`RateLimitStore` implementation swapped in here — the core and adapter stay unchanged.

## Local Contracts

- **The store's read-modify-write must stay synchronous — no `await` between get and set.**
  Race-freedom depends entirely on this. Do not introduce async work inside the
  consume path.
- **Fail open:** if the store throws, allow the request. Never lock a student out due to
  a limiter bug. Log `rate_limit.error` via `logApiEvent`.
- Store is injected as a parameter (`rateLimitRequest(..., store = defaultStore)`).
- New surfaces are added as rows in `policies.ts`, not as new code paths.

## Verification

`bun test` in the seam's `__tests__`; the pure `consume` core is the test surface.
