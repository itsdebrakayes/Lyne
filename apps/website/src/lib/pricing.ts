/**
 * Lyne organisation pricing — the one copy the quote estimator reads.
 *
 * Source: the Lyne Meeting Deck (10 November 2026), slides 10 and 12. Every
 * figure below is copied from the deck; change it there first, then here.
 *
 * Yearly is twelve monthly payments with no discount for paying annually, so
 * there is no "you save" figure. Implementation is a starting price ("from"):
 * the final figure is scoped with the buyer.
 *
 * Price depends on the number of locations only. Services per branch and how
 * busy the branches are do not change the price; the estimator still asks for
 * them because sales needs them to scope the deployment.
 *
 * The plan is the smallest one that covers the locations. A buyer may choose a
 * larger plan (Executive features at three locations, say) but never a smaller
 * one. Eleven or more locations is a Government / Enterprise contract, which
 * is custom-priced.
 *
 * Government / Enterprise figures are deliberately NOT in this file. Sales
 * has an internal formula for them; they must never reach the
 * public site (anything here ships in the browser bundle), so the site only
 * ever says "Custom" and invites the buyer to contact us.
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
  /** US$ per year: twelve monthly payments, no annual discount; null where custom-priced. */
  annual: number | null;
  /** One-time implementation starting price ("from"), US$; null where custom-priced. */
  implementation: number | null;
  /** True for Government / Enterprise: no public price, scoped with sales. */
  custom: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "branch",
    name: "Lyne Branch",
    detail: "One location: queues, appointments, staff and branch reporting",
    maxLocations: 1,
    monthly: 4500,
    annual: 54000,
    implementation: 15000,
    custom: false,
  },
  {
    id: "operations",
    name: "Lyne Operations",
    detail: "Up to 5 locations, with cross-branch reporting and priority support",
    maxLocations: 5,
    monthly: 12500,
    annual: 150000,
    implementation: 50000,
    custom: false,
  },
  {
    id: "executive",
    name: "Lyne Executive",
    detail: "Up to 10 locations, with the executive dashboard and governance",
    maxLocations: 10,
    monthly: 25000,
    annual: 300000,
    implementation: 125000,
    custom: false,
  },
  {
    id: "enterprise",
    name: "Government / Enterprise",
    detail: "Large or national deployments, custom scope",
    maxLocations: Infinity,
    monthly: null,
    annual: null,
    implementation: null,
    custom: true,
  },
];

/** Shown in the summary; the document keeps messaging out of the subscription. */
export const MESSAGING_NOTE = "Usage-based, quoted with your contract";

/** What the figures leave out, word for word from the deck (slide 13). */
export const EXCLUSIONS_NOTE =
  "Figures exclude training, applicable taxes, messaging, hardware, travel, integrations and additional services.";

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
  annual: number | null;
  implementation: number | null;
  /** Monthly price divided by locations; null if custom. */
  perLocationMonthly: number | null;
  /** Twelve monthly payments plus the starting implementation amount; null if custom. */
  firstYear: number | null;
}

export function estimate(locations: number, chosen: PlanId | null): Estimate {
  const plan = effectivePlan(locations, chosen);
  return {
    plan,
    monthly: plan.monthly,
    annual: plan.annual,
    implementation: plan.implementation,
    perLocationMonthly: plan.monthly === null ? null : Math.round(plan.monthly / Math.max(1, locations)),
    firstYear: plan.annual === null || plan.implementation === null ? null : plan.annual + plan.implementation,
  };
}

export const usd = (n: number) => `US$${n.toLocaleString("en-US")}`;

/** The figures as they appear on the page, for the sales email. */
export function estimateLines(e: Estimate): string[] {
  if (e.plan.custom) {
    return [
      `Plan: ${e.plan.name} (custom quote)`,
      `Pricing: custom, to be scoped with Lyne`,
      `Messaging / SMS: ${MESSAGING_NOTE}`,
    ];
  }
  return [
    `Plan: ${e.plan.name}`,
    `Monthly: ${usd(e.monthly!)}/month`,
    `Yearly: ${usd(e.annual!)}/year (12 monthly payments)`,
    `Implementation: from ${usd(e.implementation!)} one-time`,
    `First year: from ${usd(e.firstYear!)} (12 monthly payments plus implementation)`,
    `Per location: ${usd(e.perLocationMonthly!)}/month`,
    `Messaging / SMS: ${MESSAGING_NOTE}`,
  ];
}
