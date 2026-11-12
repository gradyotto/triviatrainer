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

const PRO_ACCESS_STATUSES = new Set(["active", "trialing"]);
const PAYMENT_FAILURE_STATUSES = new Set(["past_due", "unpaid", "incomplete"]);

/** Only a current paid or trialing subscription grants Pro. */
export function planForSubscriptionStatus(status: string): PlanId {
  return PRO_ACCESS_STATUSES.has(status) ? "pro" : "free";
}

/** A failed charge that can still be fixed from the Customer Portal. */
export function isPaymentFailureStatus(status: string): boolean {
  return PAYMENT_FAILURE_STATUSES.has(status);
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
