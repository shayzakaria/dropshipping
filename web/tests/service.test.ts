import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain/logic";
import { redeemCode } from "@/lib/domain/service";
import { businessStats, influencerStats } from "@/lib/domain/stats";
import { MemoryStore } from "@/lib/store/memory";

async function world(overrides: Partial<Parameters<MemoryStore["createCampaign"]>[0]> = {}) {
  const store = new MemoryStore();
  const owner = await store.createUser({ name: "דנה", email: "owner@test.co", role: "business" });
  const influencer = await store.createUser({ name: "נועה", email: "inf@test.co", role: "influencer" });
  const business = await store.createBusiness({ ownerId: owner.id, name: "חנות בדיקה" });
  const campaign = await store.createCampaign({
    businessId: business.id,
    title: "קמפיין בדיקה",
    buyerDiscountPct: 10,
    influencerPct: 7,
    platformPct: 3,
    newCustomersOnly: true,
    status: "active",
    ...overrides,
  });
  const code = await store.createCode({ campaignId: campaign.id, influencerId: influencer.id, status: "active" });
  return { store, owner, influencer, business, campaign, code };
}

describe("redeemCode — happy path", () => {
  it("records a valid API redemption with the right split", async () => {
    const { store, business, code, influencer, campaign } = await world();
    const r = await redeemCode(store, {
      code: code.code,
      orderAmount: 200,
      source: "api",
      apiSecret: business.apiSecret,
      customerRef: "buyer@x.com",
    });
    expect(r.buyerDiscount).toBe(20);
    expect(r.influencerCommission).toBe(14);
    expect(r.platformFee).toBe(6);
    expect(r.tier).toBe("BRONZE");
    expect(r.influencerId).toBe(influencer.id);
    expect(r.businessId).toBe(business.id);
    expect(r.campaignId).toBe(campaign.id);
  });

  it("accepts codes in any case and with whitespace", async () => {
    const { store, business, code } = await world();
    const r = await redeemCode(store, {
      code: `  ${code.code.toLowerCase()} `,
      orderAmount: 100,
      source: "api",
      apiSecret: business.apiSecret,
    });
    expect(r.orderAmount).toBe(100);
  });

  it("does not require an api secret for the simulator source", async () => {
    const { store, code } = await world();
    const r = await redeemCode(store, { code: code.code, orderAmount: 50, source: "simulator" });
    expect(r.source).toBe("simulator");
  });
});

describe("redeemCode — rejections", () => {
  it("rejects an unknown code", async () => {
    const { store } = await world();
    await expect(redeemCode(store, { code: "ZZZZ-ZZZZ", orderAmount: 100, source: "simulator" })).rejects.toMatchObject(
      { code: "CODE_NOT_FOUND" },
    );
  });

  it("rejects a wrong api secret with BAD_SECRET", async () => {
    const { store, code } = await world();
    await expect(
      redeemCode(store, { code: code.code, orderAmount: 100, source: "api", apiSecret: "wrong" }),
    ).rejects.toMatchObject({ code: "BAD_SECRET" });
  });

  it("rejects redemptions on a paused campaign", async () => {
    const { store, campaign, code } = await world();
    await store.setCampaignStatus(campaign.id, "paused");
    await expect(redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator" })).rejects.toMatchObject({
      code: "CAMPAIGN_INACTIVE",
    });
  });

  it("rejects non-positive amounts", async () => {
    const { store, code } = await world();
    for (const bad of [0, -10, NaN]) {
      await expect(redeemCode(store, { code: code.code, orderAmount: bad, source: "simulator" })).rejects.toMatchObject(
        { code: "INVALID_AMOUNT" },
      );
    }
  });

  it("blocks an influencer redeeming their own code (fraud guard)", async () => {
    const { store, code } = await world();
    await expect(
      redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator", customerRef: "INF@test.co" }),
    ).rejects.toMatchObject({ code: "SELF_REDEMPTION" });
  });

  it("enforces new-customers-only per business (cannibalization guard)", async () => {
    const { store, business, code } = await world();
    const buy = () =>
      redeemCode(store, {
        code: code.code,
        orderAmount: 100,
        source: "api",
        apiSecret: business.apiSecret,
        customerRef: "repeat@x.com",
      });
    await buy();
    await expect(buy()).rejects.toMatchObject({ code: "NOT_NEW_CUSTOMER" });
  });

  it("allows repeat customers when the campaign permits them", async () => {
    const { store, business, code } = await world({ newCustomersOnly: false });
    const buy = () =>
      redeemCode(store, {
        code: code.code,
        orderAmount: 100,
        source: "api",
        apiSecret: business.apiSecret,
        customerRef: "repeat@x.com",
      });
    await buy();
    await expect(buy()).resolves.toBeTruthy();
  });

  it("enforces the campaign's monthly redemption cap", async () => {
    const { store, code } = await world({ newCustomersOnly: false, maxRedemptionsPerMonth: 2 });
    await redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator" });
    await redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator" });
    await expect(redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator" })).rejects.toMatchObject({
      code: "MONTHLY_CAP_REACHED",
    });
  });
});

describe("redeemCode — tier progression", () => {
  it("upgrades the influencer to SILVER after 10 monthly sales, funded by the platform", async () => {
    const { store, code } = await world({ newCustomersOnly: false });
    for (let i = 0; i < 10; i++) {
      const r = await redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator" });
      expect(r.tier).toBe("BRONZE");
      expect(r.influencerCommission).toBe(7);
      expect(r.platformFee).toBe(3);
    }
    const eleventh = await redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator" });
    expect(eleventh.tier).toBe("SILVER");
    expect(eleventh.tierBonusPct).toBe(1);
    expect(eleventh.influencerCommission).toBe(8); // 7% + 1%
    expect(eleventh.platformFee).toBe(2); // 3% - 1%
    // The business cost per 100₪ sale is 20₪ in both tiers
    expect(eleventh.buyerDiscount + eleventh.influencerCommission + eleventh.platformFee).toBe(20);
  });
});

describe("stats", () => {
  it("aggregates business and influencer monthly numbers", async () => {
    const { store, business, influencer, code } = await world({ newCustomersOnly: false });
    await redeemCode(store, { code: code.code, orderAmount: 100, source: "simulator" });
    await redeemCode(store, { code: code.code, orderAmount: 200, source: "simulator" });

    const b = businessStats(await store.listRedemptionsByBusiness(business.id), new Date());
    expect(b.monthCount).toBe(2);
    expect(b.monthRevenue).toBe(300);
    expect(b.monthBuyerDiscounts).toBe(30);
    expect(b.monthCommissions).toBe(21);
    expect(b.monthPlatformFees).toBe(9);
    expect(b.monthTotalCost).toBe(60);
    expect(b.costPctOfRevenue).toBe(20);

    const i = influencerStats(await store.listRedemptionsByInfluencer(influencer.id), new Date());
    expect(i.monthCount).toBe(2);
    expect(i.monthEarnings).toBe(21);
    expect(i.totalEarnings).toBe(21);
  });
});

describe("MemoryStore specifics", () => {
  it("returns the same code when an influencer joins a campaign twice", async () => {
    const { store, campaign, influencer, code } = await world();
    const again = await store.createCode({ campaignId: campaign.id, influencerId: influencer.id, status: "active" });
    expect(again.id).toBe(code.id);
  });

  it("rejects duplicate emails", async () => {
    const store = new MemoryStore();
    await store.createUser({ name: "א", email: "dup@x.com", role: "influencer" });
    await expect(store.createUser({ name: "ב", email: "DUP@x.com", role: "influencer" })).rejects.toThrow("EMAIL_TAKEN");
  });

  it("matches customer history case-insensitively", async () => {
    const { store, business, code } = await world({ newCustomersOnly: false });
    await redeemCode(store, {
      code: code.code,
      orderAmount: 100,
      source: "api",
      apiSecret: business.apiSecret,
      customerRef: "Someone@X.com",
    });
    expect(await store.hasCustomerBoughtBefore(business.id, "someone@x.com")).toBe(true);
    expect(await store.hasCustomerBoughtBefore(business.id, "other@x.com")).toBe(false);
  });
});

describe("DomainError", () => {
  it("carries a stable machine code and a Hebrew message", () => {
    const e = new DomainError("X", "הודעה");
    expect(e.code).toBe("X");
    expect(e.message).toBe("הודעה");
    expect(e).toBeInstanceOf(Error);
  });
});
