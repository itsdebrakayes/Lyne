/**
 * Lyne organisation pricing — the one copy the quote estimator reads.
 *
 * Source: "Lyne Competitive Pricing & Positioning Matrix" (pricing verified
 * September 4, 2026), section 4 "Proposed Lyne Packages". Every figure below is
 * copied from that table; change them there first, then here.
 *
 * Price depends on the number of locations only. Services per branch and how
 * busy the branches are do not change the price; the estimator still asks for
 * them because sales needs them to scope the deployment.
 *
 * The plan is the smallest one that covers the locations. A buyer may choose a
 * larger plan (Executive features at three locations, say) but never a smaller
 * one. Sixteen or more locations is a Government / Enterprise contract, which
 * is custom-priced: the document gives only its "from" figures.
 */

export type PlanId = "branch" | "operations" | "executive" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  /** One line for the plan picker. */
  detail: string;
  /** Most locations the plan includes. */
  maxLocations: number;
  /** US$ per month; null where the plan is custom-priced. */
  monthly: number | null;
  /** US$ per year when billed annually. For a custom plan, the "from" figure. */
  annual: number;
  /** One-time implementation, US$. For a custom plan, the "from" figure. */
  implementation: number;
  /** True for Government / Enterprise: figures are starting points, not prices. */
  custom: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "branch",
    name: "Lyne Branch",
    detail: "One location: queues, appointments, staff and branch reporting",
    maxLocations: 1,
    monthly: 1095,
    annual: 11950,
    implementation: 4500,
    custom: false,
  },
  {
    id: "operations",
    name: "Lyne Operations",
    detail: "Up to 5 locations, with cross-branch reporting and priority support",
    maxLocations: 5,
    monthly: 2795,
    annual: 29950,
    implementation: 8500,
    custom: false,
  },
  {
    id: "executive",
    name: "Lyne Executive",
    detail: "Up to 15 locations, with the executive dashboard and governance",
    maxLocations: 15,
    monthly: 5995,
    annual: 64950,
    implementation: 15000,
    custom: false,
  },
  {
    id: "enterprise",
    name: "Government / Enterprise",
    detail: "Large or national deployments, custom scope",
    maxLocations: Infinity,
    monthly: null,
    annual: 75000,
    implementation: 25000,
    custom: true,
  },
];

/** Shown in the summary; the document keeps messaging out of the subscription. */
export const MESSAGING_NOTE = "Usage-based, quoted with your contract";

/** The smallest plan that covers this many locations. */
export function minimumPlan(locations: number): Plan {
  return PLANS.find((p) => locations <= p.maxLocations) ?? PLANS[PLANS.length - 1];
}

/** The plan actually priced: the one chosen, raised to the minimum if it is too small. */
export function effectivePlan(locations: number, chosen: PlanId | null): Plan {
  const min = minimumPlan(locations);
  const pick = PLANS.find((p) => p.id === chosen) ?? min;
  return PLANS.indexOf(pick) >= PLANS.indexOf(min) ? pick : min;
}

export function planFits(plan: Plan, locations: number): boolean {
  return locations <= plan.maxLocations;
}

export interface Estimate {
  plan: Plan;
  monthly: number | null;
  annual: number;
  implementation: number;
  /** What paying annually saves against twelve monthly payments; null if custom. */
  annualSaving: number | null;
  /** Monthly price divided by locations; null if custom. */
  perLocationMonthly: number | null;
}

export function estimate(locations: number, chosen: PlanId | null): Estimate {
  const plan = effectivePlan(locations, chosen);
  return {
    plan,
    monthly: plan.monthly,
    annual: plan.annual,
    implementation: plan.implementation,
    annualSaving: plan.monthly === null ? null : plan.monthly * 12 - plan.annual,
    perLocationMonthly: plan.monthly === null ? null : Math.round(plan.monthly / Math.max(1, locations)),
  };
}

export const usd = (n: number) => `US$${n.toLocaleString("en-US")}`;

/** The figures as they appear on the page, for the sales email. */
export function estimateLines(e: Estimate): string[] {
  if (e.plan.custom) {
    return [
      `Plan: ${e.plan.name} (custom quote)`,
      `Subscription: from ${usd(e.annual)}/year`,
      `Implementation: from ${usd(e.implementation)} one-time`,
      `Messaging / SMS: ${MESSAGING_NOTE}`,
    ];
  }
  return [
    `Plan: ${e.plan.name}`,
    `Monthly: ${usd(e.monthly!)}/month`,
    `Annual: ${usd(e.annual)}/year`,
    `Implementation: ${usd(e.implementation)} one-time`,
    `Messaging / SMS: ${MESSAGING_NOTE}`,
  ];
}
