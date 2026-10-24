import "server-only";

import type { AppUser } from "@/lib/auth";
import { UsageLimitError } from "@/lib/billing/errors";

/**
 * Client for rx-subscription's machine API (`/api/v1`).
 *
 * Users are addressed by their RxLab id (the access token `sub`, which is
 * `AppUser.id`). rx-subscription creates its own user record on first
 * reference, so nothing needs registering up front.
 */

function baseUrl() {
  const configured = process.env.RX_SUBSCRIPTION_URL?.trim();
  if (!configured) throw new Error("RX_SUBSCRIPTION_URL_NOT_CONFIGURED");
  return configured.replace(/\/+$/, "");
}

function apiKey() {
  const key = process.env.RX_SUBSCRIPTION_API_KEY?.trim();
  if (!key) throw new Error("RX_SUBSCRIPTION_API_KEY_NOT_CONFIGURED");
  return key;
}

export const subscriptionConfigured = Boolean(
  process.env.RX_SUBSCRIPTION_URL?.trim() && process.env.RX_SUBSCRIPTION_API_KEY?.trim(),
);

export class SubscriptionApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    description: string,
  ) {
    super(description);
    this.name = "SubscriptionApiError";
  }
}

type ErrorBody = { error?: string; error_description?: string };

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | undefined>; acceptStatuses?: number[] },
): Promise<{ status: number; body: T }> {
  const url = new URL(`${baseUrl()}/api/v1${path}`);
  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      "X-Api-Key": apiKey(),
      ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok || init?.acceptStatuses?.includes(response.status)) {
    return { status: response.status, body: (await response.json()) as T };
  }
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  throw new SubscriptionApiError(
    response.status,
    body?.error ?? `http_${response.status}`,
    body?.error_description ?? `rx-subscription ${path} failed`,
  );
}

export type UsageResult = {
  allowed: boolean;
  reason?: "limit_exceeded" | "insufficient_balance";
  used: number;
  limit: number | null;
  remaining: number | null;
  chargedUnits: number;
  periodEnd: string | null;
  duplicate: boolean;
};

/**
 * Record one metered event. rx-subscription keeps the usage log and decides
 * the limit: it answers 402 with `allowed: false` when the plan's allowance is
 * spent (`limit_exceeded`) or, for items that bill overage to a balance, when
 * the balance can't cover the call (`insufficient_balance`). Either becomes a
 * `UsageLimitError`.
 */
export async function recordUsage(input: {
  rxlabUserId: string;
  item: string;
  idempotencyKey: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}) {
  const { body } = await request<UsageResult>("/usage", {
    method: "POST",
    body: {
      rxlabUserId: input.rxlabUserId,
      item: input.item,
      amount: input.amount ?? 1,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    },
    acceptStatuses: [402],
  });
  if (!body.allowed) {
    throw new UsageLimitError(input.item, body.reason ?? "limit_exceeded", body.used ?? null, body.limit ?? null, body.periodEnd ?? null);
  }
  return body;
}

/**
 * Take `amount` from a user's balance. rx-subscription answers 409
 * `insufficient_balance` when the balance can't cover it, which becomes a
 * `UsageLimitError`.
 */
export async function debitBalance(input: {
  rxlabUserId: string;
  unit: string;
  idempotencyKey: string;
  description: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { body } = await request<{ entryId: string; duplicate: boolean; balanceAfter: number }>("/balances", {
      method: "POST",
      body: {
        rxlabUserId: input.rxlabUserId,
        unit: input.unit,
        amount: input.amount ?? 1,
        operation: "debit",
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      },
    });
    return body;
  } catch (error) {
    if (error instanceof SubscriptionApiError && error.code === "insufficient_balance") {
      throw new UsageLimitError(input.unit, "insufficient_balance", null, null, null);
    }
    throw error;
  }
}

export type ResolvedPlan = {
  pendingPlanChange?: { planId: string; planName: string; effectiveAt: string } | null;
  subscriptionId: string | null;
  planId: string;
  planKey: string;
  planName: string;
  planGroup: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingProvider: string;
};

export type Entitlements = {
  user: { id: string; rxlabUserId: string; level: number | null; levelKey: string | null };
  /** Plans the user subscribed to. */
  plans: ResolvedPlan[];
  /** Free plans rx-subscription assigns automatically while the user has no other plan in the group. */
  defaultPlans: ResolvedPlan[];
  complimentaryPlans: ResolvedPlan[];
  roles: string[];
  permissions: string[];
  balances: Array<{ unit: string; name: string; symbol: string | null; precision: number; amount: number; available: number }>;
  /** `limit` is the plan allowance only; calls past it may still be paid from a balance. */
  usage: Array<{
    key: string;
    name: string;
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string | null;
    resetPolicy: string;
  }>;
};

/** Every plan the user is on, including the auto-assigned free tier. */
export function activePlans(entitlements: Entitlements) {
  return [...entitlements.plans, ...entitlements.complimentaryPlans, ...entitlements.defaultPlans];
}

export async function getEntitlements(user: AppUser) {
  const { body } = await request<Entitlements>("/entitlements", {
    query: { rxlabUserId: user.id, email: user.email || undefined },
  });
  return body;
}

export type CatalogPlan = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  planGroup: string | null;
  billingInterval: string | null;
  intervalCount: number | null;
  priceAmountCents: number;
  currency: string;
  trialDays: number | null;
  /** Assigned by rx-subscription itself; it can't be bought through checkout. */
  autoSubscribe: boolean;
};

export type CatalogTopup = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  unit: string | null;
  amount: number;
  grants?: Array<{ unit: string; name: string; amount: number }>;
  priceAmountCents: number;
  currency: string;
  eligible: boolean | null;
  blockedBy: Array<{ ruleType: "requires_any_plan" | "requires_active_plan" | "requires_role" | "purchase_limit"; planId: string | null; roleId: string | null }> | null;
};

export type UsageBucket = { start: string; amount: number; eventCount: number; chargedUnits: number };

/**
 * Usage of one item over `[from, to]`, zero-filled. rx-subscription answers
 * 404 for a user it has never seen, which simply means no usage yet.
 */
export async function getUsageStatistics(input: { user: AppUser; item: string; from: Date; to: Date; granularity: "hour" | "day" }) {
  try {
    const { body } = await request<{ totals: UsageBucket[] }>("/usage/statistics", {
      query: {
        rxlabUserId: input.user.id,
        item: input.item,
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        granularity: input.granularity,
      },
    });
    return body.totals;
  } catch (error) {
    if (error instanceof SubscriptionApiError && error.code === "user_not_found") return [];
    throw error;
  }
}

export type LedgerEntry = {
  id: string;
  kind: string;
  unit: string;
  delta: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
};

/** Balance movements, newest first: top-ups, and the calls paid for from the balance. */
export async function getBalanceLedger(input: { user: AppUser; unit?: string; page: number; pageSize?: number }) {
  const { body } = await request<{ entries: LedgerEntry[]; total: number; page: number; pageCount: number }>("/balances/ledger", {
    query: {
      rxlabUserId: input.user.id,
      unit: input.unit,
      page: String(input.page),
      pageSize: String(input.pageSize ?? 50),
    },
  });
  return body;
}

export async function getCatalog(user?: AppUser) {
  const { body } = await request<{ plans: CatalogPlan[]; topups: CatalogTopup[] }>("/catalog", {
    query: { rxlabUserId: user?.id },
  });
  return body;
}

export async function createCheckout(input: {
  user: AppUser;
  kind: "plan" | "topup";
  productId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const { body } = await request<{ checkoutUrl: string; sessionId: string }>("/checkout", {
    method: "POST",
    body: {
      rxlabUserId: input.user.id,
      email: input.user.email || undefined,
      displayName: input.user.name || undefined,
      kind: input.kind,
      planId: input.kind === "plan" ? input.productId : undefined,
      topupId: input.kind === "topup" ? input.productId : undefined,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    },
  });
  return body;
}

export async function createBillingPortalSession(input: { user: AppUser; returnUrl: string }) {
  const { body } = await request<{ url: string }>("/checkout", {
    method: "POST",
    body: {
      rxlabUserId: input.user.id,
      email: input.user.email || undefined,
      kind: "portal",
      returnUrl: input.returnUrl,
    },
  });
  return body;
}

/** Creates a hosted review session; opening it does not change or charge a plan. */
export async function createPlanChangeSession(input: {
  user: AppUser; subscriptionId: string; planId: string; returnUrl: string; timing?: "immediate" | "next_period";
}) {
  const { body } = await request<{ url: string }>("/plan-changes", {
    method: "POST",
    body: { rxlabUserId: input.user.id, subscriptionId: input.subscriptionId,
      planId: input.planId, returnUrl: input.returnUrl, timing: input.timing ?? "immediate" },
  });
  return body;
}
