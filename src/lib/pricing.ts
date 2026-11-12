export type Plan = {
  id: "starter" | "growth" | "practice";
  name: string;
  monthlyInr: number;
  maxClients: number;
  blurb: string;
  features: readonly string[];
  highlighted?: boolean;
};

export const plans: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyInr: 999,
    maxClients: 50,
    blurb: "For solo CAs getting monthly filings under control.",
    features: ["Up to 50 clients", "WhatsApp and email reminders", "Upload links for every client", "Pending-documents dashboard"],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyInr: 1999,
    maxClients: 150,
    blurb: "For growing firms with a small team.",
    features: ["Up to 150 clients", "Everything in Starter", "3 team members", "Custom document checklists"],
    highlighted: true,
  },
  {
    id: "practice",
    name: "Practice",
    monthlyInr: 2999,
    maxClients: 400,
    blurb: "For established practices with many filers.",
    features: ["Up to 400 clients", "Everything in Growth", "Unlimited team members", "Bulk CSV import and ZIP export"],
  },
];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Formats whole rupees the Indian way, e.g. 125000 → "₹1,25,000". */
export function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) throw new RangeError("amount must be a finite number");
  return inr.format(Math.round(amount));
}

/** The cheapest plan that covers `clientCount`, or null when it exceeds every plan. */
export function planForClients(clientCount: number): Plan | null {
  if (!Number.isInteger(clientCount) || clientCount < 0) throw new RangeError("clientCount must be a non-negative integer");
  return plans.find((plan) => clientCount <= plan.maxClients) ?? null;
}
