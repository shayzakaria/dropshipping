import { describe, expect, it } from "vitest";
import { MemoryStore } from "../lib/store/memory";
import { redeemCode } from "../lib/domain/service";

const PERIOD = { start: "2026-09-01", end: "2026-10-01" };
let seq = 0;

async function shop(store: MemoryStore, name = "חנות") {
  const owner = await store.createUser({ name: "בעלים", email: `o${seq++}@x.co`, role: "business" });
  const inf = await store.createUser({ name: "משפיען", email: `i${seq++}@x.co`, role: "influencer" });
  const business = await store.createBusiness({ ownerId: owner.id, name });
  const campaign = await store.createCampaign({
    businessId: business.id,
    title: "ק",
    buyerDiscountPct: 10,
    influencerPct: 7,
    platformPct: 3,
    newCustomersOnly: false,
    status: "active",
    codeSource: "generated",
  });
  const code = await store.createCode({ campaignId: campaign.id, influencerId: inf.id, status: "active" });
  return { business, inf, campaign, code };
}

/**
 * A sale old enough that its hold window has closed — made by moving the
 * clock, not by reaching into the store, so it goes through the same path a
 * real sale does.
 */
async function releasedSale(store: MemoryStore, w: Awaited<ReturnType<typeof shop>>, amount: number) {
  return redeemCode(store, {
    code: w.code.code,
    orderAmount: amount,
    source: "manual",
    actingBusinessId: w.business.id,
    now: new Date("2020-01-01T00:00:00.000Z"),
  });
}

describe("billing a business for what it owes", () => {
  it("bills released sales, and nothing that is still on hold", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    await releasedSale(store, w, 300); // 21 commission + 9 fee
    await redeemCode(store, {
      code: w.code.code,
      orderAmount: 1000,
      source: "manual",
      actingBusinessId: w.business.id,
    }); // still inside its 14 days

    const [s] = await store.issueSettlements(PERIOD);
    expect(s.commissions).toBe(21);
    expect(s.platformFees).toBe(9);
    expect(s.total).toBe(30);
    expect(s.salesCount).toBe(1);
  });

  it("never bills the same sale twice", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    await releasedSale(store, w, 300);

    const first = await store.issueSettlements(PERIOD);
    expect(first).toHaveLength(1);

    // A second run for a later period finds nothing left to bill.
    const second = await store.issueSettlements({ start: "2026-10-01", end: "2026-11-01" });
    expect(second).toHaveLength(0);
  });

  it("refuses to issue a second statement for the same period", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    await releasedSale(store, w, 300);
    await store.issueSettlements(PERIOD);
    await releasedSale(store, w, 500);

    // Same period again: the guard is the period, not just the stamped sales.
    expect(await store.issueSettlements(PERIOD)).toHaveLength(0);
  });

  it("leaves a cancelled sale out of the bill", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    const kept = await releasedSale(store, w, 300);
    const returned = await releasedSale(store, w, 900);
    await store.setRedemptionStatus(returned.id, "cancelled", {
      at: new Date().toISOString(),
      reason: "returned",
    });

    const [s] = await store.issueSettlements(PERIOD);
    expect(s.salesCount).toBe(1);
    expect(s.total).toBe(30);
    expect(kept.orderAmount).toBe(300);
  });

  it("bills each business separately", async () => {
    const store = new MemoryStore();
    const a = await shop(store, "חנות א");
    const b = await shop(store, "חנות ב");
    await releasedSale(store, a, 300);
    await releasedSale(store, b, 1000);

    const issued = await store.issueSettlements(PERIOD);
    expect(issued).toHaveLength(2);
    const forA = issued.find((s) => s.businessId === a.business.id)!;
    const forB = issued.find((s) => s.businessId === b.business.id)!;
    expect(forA.total).toBe(30);
    expect(forB.total).toBe(100);
  });

  it("skips a business with nothing to bill", async () => {
    const store = new MemoryStore();
    await shop(store, "חנות שקטה");
    expect(await store.issueSettlements(PERIOD)).toHaveLength(0);
  });
});

describe("what a business sees before it is billed", () => {
  it("counts released, unbilled sales", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    await releasedSale(store, w, 300);
    await releasedSale(store, w, 200);

    expect(await store.unbilledTotals(w.business.id)).toEqual({
      commissions: 35,
      platformFees: 15,
      count: 2,
    });
  });

  it("drops to nothing once the bill is issued", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    await releasedSale(store, w, 300);
    await store.issueSettlements(PERIOD);

    expect((await store.unbilledTotals(w.business.id)).count).toBe(0);
  });
});

describe("closing a statement", () => {
  it("records payment", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    await releasedSale(store, w, 300);
    const [s] = await store.issueSettlements(PERIOD);

    await store.setSettlementStatus(s.id, "paid", "העברה 8823");
    const after = await store.getSettlement(s.id);
    expect(after?.status).toBe("paid");
    expect(after?.note).toBe("העברה 8823");
    expect(after?.paidAt).toBeTruthy();
  });

  it("puts the money back on the next bill when a statement is cancelled", async () => {
    const store = new MemoryStore();
    const w = await shop(store);
    await releasedSale(store, w, 300);
    const [s] = await store.issueSettlements(PERIOD);
    expect((await store.unbilledTotals(w.business.id)).count).toBe(0);

    // A bill sent in error must not swallow the debt it named.
    await store.setSettlementStatus(s.id, "cancelled", "הופק בטעות");
    expect((await store.unbilledTotals(w.business.id)).count).toBe(1);

    const reissued = await store.issueSettlements({ start: "2026-10-01", end: "2026-11-01" });
    expect(reissued).toHaveLength(1);
    expect(reissued[0].total).toBe(30);
  });
});
