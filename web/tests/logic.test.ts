import { describe, expect, it } from "vitest";
import {
  computeSplit,
  DomainError,
  generateCode,
  monthKey,
  nextTier,
  normalizeCode,
  tierForMonthlySales,
  validateCampaignSplit,
} from "@/lib/domain/logic";

const campaign = { buyerDiscountPct: 10, influencerPct: 7, platformPct: 3 };
const round2 = (n: number) => Math.round(n * 100) / 100;

describe("computeSplit", () => {
  it("splits a 300₪ order at 10/7/3", () => {
    const s = computeSplit(300, campaign);
    expect(s.buyerDiscount).toBe(30);
    expect(s.influencerCommission).toBe(21);
    expect(s.platformFee).toBe(9);
    expect(s.businessTotalCost).toBe(60);
  });

  it("keeps the business cost identical across tiers — bonuses come from the platform share", () => {
    const base = computeSplit(300, campaign, 0);
    const gold = computeSplit(300, campaign, 2);
    expect(gold.businessTotalCost).toBe(base.businessTotalCost);
    expect(gold.buyerDiscount).toBe(base.buyerDiscount);
    expect(gold.influencerCommission).toBe(27); // 7% + 2% bonus
    expect(gold.platformFee).toBe(3); // 3% - 2% bonus
  });

  it("caps the tier bonus so the platform share never goes negative", () => {
    const s = computeSplit(100, campaign, 10);
    expect(s.platformFee).toBe(0);
    expect(s.influencerCommission).toBe(10); // 7% + capped 3%
    expect(s.businessTotalCost).toBe(20);
  });

  it("parts always sum exactly to the business cost (rounding invariant)", () => {
    const amounts = [1, 9.99, 49.5, 123.45, 777.77, 1234.56, 99999.99];
    for (const amount of amounts) {
      for (const bonus of [0, 1, 2]) {
        const s = computeSplit(amount, campaign, bonus);
        const sum = Math.round((s.buyerDiscount + s.influencerCommission + s.platformFee) * 100);
        expect(sum).toBe(Math.round(s.businessTotalCost * 100));
        expect(s.platformFee).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("rejects non-positive and non-finite amounts", () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(() => computeSplit(bad, campaign)).toThrow(DomainError);
    }
  });
});

describe("validateCampaignSplit", () => {
  it("accepts a sane split", () => {
    expect(() => validateCampaignSplit({ buyerDiscountPct: 10, influencerPct: 7, platformPct: 3 })).not.toThrow();
  });
  it("requires at least 1% for each part", () => {
    expect(() => validateCampaignSplit({ buyerDiscountPct: 0, influencerPct: 7, platformPct: 3 })).toThrow(/הנחת הקונה/);
    expect(() => validateCampaignSplit({ buyerDiscountPct: 10, influencerPct: 0.5, platformPct: 3 })).toThrow(/עמלת המשפיען/);
    expect(() => validateCampaignSplit({ buyerDiscountPct: 10, influencerPct: 7, platformPct: 0 })).toThrow(/דמי הפלטפורמה/);
  });
  it("rejects a total benefit above 50%", () => {
    expect(() => validateCampaignSplit({ buyerDiscountPct: 30, influencerPct: 15, platformPct: 6 })).toThrow(/50%/);
  });
  it("rejects non-numeric percentages", () => {
    expect(() => validateCampaignSplit({ buyerDiscountPct: NaN, influencerPct: 7, platformPct: 3 })).toThrow(DomainError);
  });
});

describe("tiers", () => {
  it("maps monthly sales to the right tier", () => {
    expect(tierForMonthlySales(0).name).toBe("BRONZE");
    expect(tierForMonthlySales(9).name).toBe("BRONZE");
    expect(tierForMonthlySales(10).name).toBe("SILVER");
    expect(tierForMonthlySales(29).name).toBe("SILVER");
    expect(tierForMonthlySales(30).name).toBe("GOLD");
    expect(tierForMonthlySales(500).name).toBe("GOLD");
  });
  it("knows the next tier to aim for", () => {
    expect(nextTier(0)?.name).toBe("SILVER");
    expect(nextTier(15)?.name).toBe("GOLD");
    expect(nextTier(30)).toBeNull();
  });
});

describe("codes", () => {
  it("generates XXXX-XXXX codes without ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });
  it("is deterministic given a seeded random source", () => {
    const mkRand = () => {
      let i = 0;
      return () => (i++ % 10) / 10;
    };
    expect(generateCode(mkRand())).toBe(generateCode(mkRand()));
  });
  it("normalizes user input", () => {
    expect(normalizeCode("  ab2c-9xyz ")).toBe("AB2C-9XYZ");
  });
});

describe("monthKey", () => {
  it("formats year-month with padding", () => {
    expect(monthKey(new Date("2026-03-05T10:00:00Z"))).toBe("2026-03");
    expect(monthKey(new Date("2026-11-30T23:59:59Z"))).toBe("2026-11");
  });
});

describe("computeSplit — the platform share can never go negative", () => {
  // A regression the earlier test missed by only ever checking ₪100, the one
  // amount whose split cannot round badly.
  it("handles the exact case that produced -0.01", () => {
    const s = computeSplit(4258.19, { buyerDiscountPct: 10, influencerPct: 7, platformPct: 1 }, 2);
    expect(s.platformFee).toBe(0);
    expect(s.buyerDiscount).toBe(425.82);
    expect(s.influencerCommission).toBe(340.65);
    expect(round2(s.buyerDiscount + s.influencerCommission + s.platformFee)).toBe(s.businessTotalCost);
  });

  it("holds across the whole range of amounts, splits and tier bonuses", () => {
    const splits = [
      { buyerDiscountPct: 10, influencerPct: 7, platformPct: 1 },
      { buyerDiscountPct: 10, influencerPct: 7, platformPct: 2 },
      { buyerDiscountPct: 10, influencerPct: 7, platformPct: 3 },
      { buyerDiscountPct: 12, influencerPct: 5, platformPct: 3 },
      { buyerDiscountPct: 1, influencerPct: 1, platformPct: 1 },
      { buyerDiscountPct: 25, influencerPct: 20, platformPct: 5 },
    ];
    let checked = 0;
    for (const split of splits) {
      for (const bonus of [0, 1, 2, 5]) {
        for (let cents = 1; cents <= 500_000; cents += 977) {
          const s = computeSplit(cents / 100, split, bonus);
          expect(s.platformFee).toBeGreaterThanOrEqual(0);
          expect(s.influencerCommission).toBeGreaterThanOrEqual(0);
          expect(round2(s.buyerDiscount + s.influencerCommission + s.platformFee)).toBe(
            s.businessTotalCost,
          );
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10_000);
  });
});
