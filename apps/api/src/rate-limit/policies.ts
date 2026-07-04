// The policy table — one row per protected surface, the rate-limit analogue of
// the authorization action table. Algorithm is a per-policy property (per threat
// model, not one-size-fits-all); `key` is the per-policy identity extractor.
// See ADR-0005 and CONTEXT.md.
import { assertValidPolicy, type Policy } from "./rate-limit.ts";

type PolicyName = "run" | "submit" | "login";

// Minimal identity inputs the adapter extracts from the request, so the policy
// table stays free of Express types.
type KeyContext = { userId?: string; ip?: string; email?: string };

type RateLimitPolicy = Policy & { key: (ctx: KeyContext) => string };

const POLICIES: Record<PolicyName, RateLimitPolicy> = {
  // run/submit protect the un-sandboxed Judge — burst-tolerant token buckets,
  // keyed per authenticated user. submit is tighter (heavier, graded path).
  run: {
    algorithm: "token-bucket",
    capacity: 10,
    refillPerMin: 10,
    key: (ctx) => `run:user:${ctx.userId}`,
  },
  submit: {
    algorithm: "token-bucket",
    capacity: 5,
    refillPerMin: 5,
    key: (ctx) => `submit:user:${ctx.userId}`,
  },
  // login is pre-auth brute-force defense — a fixed window (burst tolerance is a
  // bug here), keyed per IP+email so one email can't lock out globally and one IP
  // can't nuke a shared NAT wholesale.
  login: {
    algorithm: "fixed-window",
    limit: 5,
    windowMs: 15 * 60 * 1000,
    key: (ctx) => `login:${ctx.ip}:${ctx.email}`,
  },
};

// Fail loud at module load if any policy is misconfigured, rather than emitting
// NaN into headers at request time.
for (const policy of Object.values(POLICIES)) assertValidPolicy(policy);

export { POLICIES };
export type { PolicyName, KeyContext, RateLimitPolicy };
