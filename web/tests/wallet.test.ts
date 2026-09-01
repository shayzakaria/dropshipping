import { describe, expect, it } from "vitest";
import {
  COMMISSION_HOLD_DAYS,
  commissionState,
  holdUntilFor,
  MIN_PAYOUT_ILS,
} from "@/lib/domain/logic";
import { businessStats, influencerStats, walletStats } from "@/lib/domain/stats";
import type { Redemption } from "@/lib/domain/types";

const SOLD = new Date("2026-09-01T12:00:00Z");
const RELEASED = new Date("2026-09-15T12:00:00Z"); // 14 days later

function sale(over: Partial<Redemption> = {}): Redemption {
  return {
    id: crypto.randomUUID(),
    codeId: "code",
    campaignId: "campaign",
    businessId: "business",
    influencerId: "influencer",
    orderAmount: 300,
    buyerDiscount: 30,
    influencerCommission: 21,
    platformFee: 9,
    tier: "BRONZE",
    tierBonusPct: 0,
    status: "held",
    holdUntil: holdUntilFor(SOLD),
    source: "api",
    createdAt: SOLD.toISOString(),
    ...over,
  };
}

describe("holdUntilFor", () => {
  it("holds the commission for the return window", () => {
    expect(holdUntilFor(SOLD)).toBe("2026-09-15T12:00:00.000Z");
    expect(COMMISSION_HOLD_DAYS).toBe(14);
  });

  it("crosses month and year boundaries", () => {
    expect(holdUntilFor(new Date("2026-12-25T00:00:00Z"))).toBe("2027-01-08T00:00:00.000Z");
  });
});

describe("commissionState", () => {
  it("is pending inside the window and available once it closes", () => {
    const s = sale();
    expect(commissionState(s, SOLD)).toBe("pending");
    expect(commissionState(s, new Date("2026-09-14T23:59:59Z"))).toBe("pending");
    expect(commissionState(s, RELEASED)).toBe("available");
  });

  it("stays cancelled or paid regardless of the clock", () => {
    expect(commissionState(sale({ status: "cancelled" }), RELEASED)).toBe("cancelled");
    expect(commissionState(sale({ status: "paid" }), SOLD)).toBe("paid");
  });
});

describe("walletStats", () => {
  it("separates money that can be withdrawn from money that cannot", () => {
    const w = walletStats(
      [
        sale({ influencerCommission: 40 }),
        sale({ influencerCommission: 25, createdAt: "2026-08-01T00:00:00Z", holdUntil: "2026-08-15T00:00:00Z" }),
        sale({ influencerCommission: 15, status: "paid" }),
        sale({ influencerCommission: 99, status: "cancelled" }),
      ],
      SOLD,
    );
    expect(w.pending).toBe(40);
    expect(w.available).toBe(25);
    expect(w.paid).toBe(15);
    expect(w.cancelled).toBe(99);
  });

  it("reports when the earliest held commission unlocks", () => {
    const w = walletStats(
      [sale({ holdUntil: "2026-09-20T00:00:00Z" }), sale({ holdUntil: "2026-09-11T00:00:00Z" })],
      SOLD,
    );
    expect(w.nextReleaseAt).toBe("2026-09-11T00:00:00Z");
  });

  it("gates withdrawal on the minimum payout", () => {
    const below = walletStats([sale({ influencerCommission: MIN_PAYOUT_ILS - 1 })], RELEASED);
    expect(below.canWithdraw).toBe(false);
    const at = walletStats([sale({ influencerCommission: MIN_PAYOUT_ILS })], RELEASED);
    expect(at.canWithdraw).toBe(true);
  });

  it("is empty for an influencer with no sales", () => {
    const w = walletStats([], SOLD);
    expect(w).toMatchObject({ pending: 0, available: 0, paid: 0, cancelled: 0, canWithdraw: false });
    expect(w.nextReleaseAt).toBeUndefined();
  });
});

describe("a returned order", () => {
  it("stops counting as earnings for the influencer", () => {
    const rs = [sale({ influencerCommission: 21 }), sale({ influencerCommission: 50, status: "cancelled" })];
    const s = influencerStats(rs, SOLD);
    expect(s.totalEarnings).toBe(21);
    expect(s.totalCount).toBe(1);
    expect(s.monthEarnings).toBe(21);
  });

  it("stops counting as a sale or a cost for the business", () => {
    const rs = [sale(), sale({ status: "cancelled", orderAmount: 500, buyerDiscount: 50, influencerCommission: 35, platformFee: 15 })];
    const b = businessStats(rs, SOLD);
    expect(b.monthCount).toBe(1);
    expect(b.monthRevenue).toBe(300);
    expect(b.monthTotalCost).toBe(60);
  });
});
