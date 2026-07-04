# ADR-0005 — Rate limiting behind a store seam

- **Status:** Accepted
- **Date:** 2026-07-04

## Context

LabLock has no rate limiting. The only `429` in the codebase is a
per-`(attempt, violationType)` **dedup** in the violations handler — a
content-aware idempotency guard that protects proctoring-log *integrity*, not
request volume. Two surfaces are genuinely unprotected against volume abuse:

| surface | risk today |
|---|---|
| **login / signin** | unlimited password guesses — brute-force |
| **run / submit** | unlimited hits on the **Judge**, which runs untrusted code on the host with only a wall-clock timeout (ADR-0001) — no per-user cap |

The instinct (following a system-design walkthrough) was "add a token-bucket rate
limiter with Redis + atomic Lua, and replace the violation dedup with it." Grilling
the design surfaced three problems with taking that literally, each of which this ADR
resolves.

## Decision

Introduce a **rate-limit seam**, split the same way as the execution (ADR-0001),
authorization (ADR-0003) and exam-session (ADR-0004) seams: a **pure decision core**
plus a thin **stateful adapter**. Lives in `apps/api/src/rate-limit/`.

### The pure decision — `rate-limit/rate-limit.ts`

```ts
type Decision = { ok: true;  remaining: number; resetAt: Date }              // Allowed
              | { ok: false; status: 429; error: string; code: "RATE_LIMITED";
                  retryAfter: number; resetAt: Date };                       // Limited

function consume(state: BucketState, now: Date, policy: Policy):
  { state: BucketState; decision: Decision };
```

- **State is threaded through, not hidden.** Rate limiting is inherently stateful —
  unlike `authorize`/`evaluateSession`, which are pure functions of their inputs. We
  preserve the pure-core property by making the *current* state an **input** and the
  *next* state an **output**. `now` is injected (never `Date.now()` inside), exactly
  as `evaluateSession` takes `now`. The whole behaviour is then a table —
  `(state, now, policy) → (state, decision)` — which is the test surface.
- **Algorithm is a policy property**, switched inside `consume` (see the two policies
  below), the same way `authorize` keys rows by action.
- **Discriminated union on `ok`**, matching `Decision` (ADR-0003) and
  `Session | Refusal` (ADR-0004). `Allowed` carries `remaining`/`resetAt`; `Limited`
  carries `retryAfter`/`resetAt` and a stable `code`.

### Two policies, one table

Per-**policy** rows (not per-**role** tiers — run/submit are `STUDENT`-only, and
login's role is unknown pre-auth, so role tiering would be dead config):

| policy | algorithm | limit | key | consume when |
|---|---|---|---|---|
| `login` | **fixed-window** | 5 / 15 min | `login:${ip}:${email}` | on **failed** credentials only |
| `run` | **token-bucket** | cap 10, refill 10/min | `user:${id}` | every request |
| `submit` | **token-bucket** | cap 5, refill 5/min | `user:${id}` | every request |

- **Algorithm per threat model, not one-size-fits-all.** Token bucket is *burst
  tolerant* — right for run/submit, where a student legitimately bursts while
  debugging. That same burst tolerance is a *bug* for login: it would hand an attacker
  a capacity's worth of instant guesses each refill. Brute-force defense wants the
  opposite shape — a hard fixed-window count. So login uses fixed-window.
- **Identity extractor is per-policy.** run/submit key on the authenticated
  `user.id`. login fires pre-auth (no `req.user`), so it keys on **IP + submitted
  email** — the pair, because IP-only throttles shared NATs and email-only lets an
  attacker lock out a victim. login also **consumes only on a failed attempt**, so a
  user logging in correctly never burns budget.
- No **role exemptions**: an admin login is the highest-value brute-force target, so
  it is throttled hardest, not spared.

### The store seam — `RateLimitStore`

```ts
interface RateLimitStore { get(key): BucketState | undefined; set(key, state): void }
```

- **In-memory `Map` adapter — current default**, single-process. A **Redis adapter is
  documented but unbuilt**, the multi-server drop-in — parallel to Runner's `host`
  (default) vs unbuilt `sandbox` (ADR-0001).
- **Race-freedom without atomic scripts.** The classic lost-update race
  (two workers read the same count, both increment, one write is lost) exists **only
  across separate processes sharing a store**. In one Bun/Node process the adapter's
  **read → `consume` → write is synchronous with no `await` between read and write**,
  so the event loop cannot interleave another request mid-sequence. The atomicity a
  Redis adapter would need a Lua script for is provided **free** by the single-threaded
  runtime. This is a **hard constraint on the adapter**: it must not `await` between
  reading and writing the Map. (When the Redis adapter is built, that free atomicity is
  gone and the Lua script becomes mandatory — noted for the future.)
- **Eviction lives in the store**, never the core: lazy (a fully-refilled bucket /
  expired window carries no information, so it is treated as absent and overwritten)
  plus a cheap periodic sweep, bounding memory against key churn (rotated IPs/emails).

### The adapter — `rate-limit/rate-limit-request.ts`

```ts
rateLimitRequest(req, res, policyName): Actor | null   // null ⇒ limited (429 sent)
```

- Extracts the policy key, does the **synchronous** read-modify-write against the
  store, and on `Limited` **sends `429`** with `Retry-After` / `RateLimit-Remaining` /
  `RateLimit-Reset` headers and returns `null`; on `Allowed` returns the actor — the
  same `null`-means-rejected idiom as `authorizeRequest` / `openSession`.
- **Owns rate-limit logging.** On `Limited` it emits one uniform `rate_limit.exceeded`
  event (`{ policy, key, retryAfter }`) via `logApiEvent` — the analytics substitute
  for not recording throttled run/submit as attempts (see below).
- **Fail-open.** If the read-modify-write throws, it **logs and allows**. For an exam
  platform, briefly weakened throttling beats locking a legitimate student out of an
  exam because the limiter had a bug.

### Placement & composition

- **Per-handler call, no global middleware** — consistent with `authorizeRequest` /
  `openSession`, and *required*: run/submit key on `user.id` (unknown until after
  auth) and login consumes only after the credential check, so blanket `app.use`
  cannot express either.
- **Order for run/submit:** `authorize → rateLimit → openSession → judge` — after the
  role-gate (needs `user.id`; no point limiting a non-student), before the expensive
  Judge and even the session DB queries.
- **login:** consulted at the end of the signin handler, on failed credentials.

## Consequences

- **Positive:** two real holes (login brute-force, un-capped Judge) close; the policy
  is one table, table-tested without a DB or real clock; `Allowed | Limited` joins the
  discriminated-result family; the store seam makes Redis a drop-in when multi-server
  arrives; the in-memory/no-Lua reasoning is captured so a reader doesn't "fix" it by
  bolting on Redis prematurely.
- **Negative (accepted for v1):** in-memory state **resets on restart** (a restart
  refills every bucket) and is **per-instance** if ever scaled horizontally — both
  closed later by the Redis adapter. A rate-limited run/submit is throttled **before**
  `openSession`, so it is **not recorded as an attempt**; throughput-protection wins,
  and the `rate_limit.exceeded` log is the analytics trail.
- **Out of scope:** the Redis adapter and its Lua atomicity; hot-reloadable policy
  config (a future config source); the proctoring dedup, which stays a separate
  integrity guard.

## Related

- [ADR-0001](0001-execution-runner-seam.md) — the pure-core + adapter split and the
  `host` / unbuilt `sandbox` store-adapter pattern this mirrors.
- [ADR-0003](0003-authorization-decision-seam.md) — `Decision`, the discriminated
  result and `authorizeRequest` idiom.
- [ADR-0004](0004-exam-session-seam.md) — `Session | Refusal` and `openSession`; the
  `authorize → openSession` chain this inserts `rateLimit` into.
- Glossary: **RateLimit**, **consume**, **Policy**, **Allowed / Limited**,
  **RateLimitStore**, **rateLimitRequest**, **Proctoring dedup** in `CONTEXT.md`.
