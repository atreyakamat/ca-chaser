import { describe, expect, it } from "vitest";
import { formatInr, planForClients, plans } from "@/lib/pricing";

describe("formatInr", () => {
  it("uses Indian digit grouping", () => {
    expect(formatInr(125000)).toBe("₹1,25,000");
    expect(formatInr(999)).toBe("₹999");
  });

  it("rejects non-finite amounts", () => {
    expect(() => formatInr(Number.NaN)).toThrow(RangeError);
  });
});

describe("planForClients", () => {
  it("picks the cheapest plan that fits", () => {
    expect(planForClients(0)?.id).toBe("starter");
    expect(planForClients(50)?.id).toBe("starter");
    expect(planForClients(51)?.id).toBe("growth");
    expect(planForClients(400)?.id).toBe("practice");
  });

  it("returns null above the largest plan", () => {
    expect(planForClients(401)).toBeNull();
  });

  it("rejects invalid counts", () => {
    expect(() => planForClients(-1)).toThrow(RangeError);
    expect(() => planForClients(2.5)).toThrow(RangeError);
  });

  it("keeps plans ordered by size and price", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].maxClients).toBeGreaterThan(plans[i - 1].maxClients);
      expect(plans[i].monthlyInr).toBeGreaterThan(plans[i - 1].monthlyInr);
    }
  });
});
