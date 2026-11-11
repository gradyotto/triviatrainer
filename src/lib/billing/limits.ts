import {
  getPlanConfig,
  limitFor,
  type PlanConfig,
  type PlanId,
  type UsageKind,
} from "@/config/plans";

export type LimitDecision = {
  allowed: boolean;
  plan: PlanId;
  kind: UsageKind;
  used: number;
  limit: number | null;
  remaining: number | null;
};

const PRO_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planForSubscriptionStatus(status: string): PlanId {
  return PRO_ACCESS_STATUSES.has(status) ? "pro" : "free";
}

export function evaluateDailyLimit(input: {
  plan: PlanId;
  kind: UsageKind;
  used: number;
  config?: PlanConfig;
}): LimitDecision {
  const used = Math.max(0, Math.trunc(input.used));
  const limit = limitFor(input.plan, input.kind, input.config ?? getPlanConfig());
  if (limit == null) {
    return {
      allowed: true,
      plan: input.plan,
      kind: input.kind,
      used,
      limit: null,
      remaining: null,
    };
  }
  return {
    allowed: used < limit,
    plan: input.plan,
    kind: input.kind,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
