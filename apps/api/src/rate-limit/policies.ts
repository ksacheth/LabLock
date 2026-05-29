// The policy table — one row per protected surface, the rate-limit analogue of
// the authorization action table. Algorithm is a per-policy property (per threat
// model, not one-size-fits-all); `key` is the per-policy identity extractor.
// `submit` and `login` rows land with #36 / #37. See ADR-0005 and CONTEXT.md.
import type { Policy } from "./rate-limit.ts";

type PolicyName = "run";

// Minimal identity inputs the adapter extracts from the request, so the policy
// table stays free of Express types.
type KeyContext = { userId?: string; ip?: string; email?: string };

type RateLimitPolicy = Policy & { key: (ctx: KeyContext) => string };

const POLICIES: Record<PolicyName, RateLimitPolicy> = {
  run: {
    algorithm: "token-bucket",
    capacity: 10,
    refillPerMin: 10,
    key: (ctx) => `run:user:${ctx.userId}`,
  },
};

export { POLICIES };
export type { PolicyName, KeyContext, RateLimitPolicy };
